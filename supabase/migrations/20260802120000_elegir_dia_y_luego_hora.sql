-- ============================================================================
-- Apúntate Fácil: elegir es en dos pasos, primero el día
-- ----------------------------------------------------------------------------
-- Un botón que dice "mar 4 ago, 17:30" mete DOS decisiones dentro. Si el día te
-- vale pero la hora no, ese botón no te sirve y no tienes forma de decirlo sin
-- ponerte a escribir. Le pasó a Mario probándolo:
--
--   él        "Me viene bien el martes pero no a esa hora"
--   nosotros  (otra terna cualquiera, sin martes)
--   él        "No me entiendes o que"
--
-- Y el día es además la decisión que de verdad bloquea ("el martes no puedo,
-- trabajo"): la hora casi siempre es negociable dentro del día. Así que se
-- pregunta primero el día y después se enseñan las horas REALES de ese día.
--
-- Aquí abajo solo hace falta una cosa: entender el botón del día. Su
-- identificador lleva la fecha dentro (`c:<conversacion>:d:2026-08-06`), igual
-- que el de un horario lleva su posición, así que al volver no hay que adivinar
-- a qué contestaba.
-- ============================================================================

alter table public.interview_jobs drop constraint interview_jobs_kind_check;
alter table public.interview_jobs add constraint interview_jobs_kind_check check (kind in (
  'recordatorio_24h', 'recordatorio_2h', 'marcar_realizada', 'avisar_intervencion',
  'enviar_invitacion', 'enviar_horarios', 'reofertar_horarios',
  'enviar_horas',        -- ha elegido día: ahora las horas de ese día
  'enviar_confirmacion', 'enviar_despedida', 'enviar_texto',
  'clasificar_texto', 'conversar', 'responder_duda', 'mensaje_no_leible'
));

create or replace function public.process_whatsapp_inbound(
  p_phone_number_id text,
  p_wa_id           text,
  p_provider_id     text,
  p_tipo            text,
  p_texto           text default null,
  p_opcion_id       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender public.whatsapp_senders;
  v_conv   public.candidate_conversations;
  v_slot   int;
  v_dia    text;
  v_cuerpo text;
begin
  select * into v_sender from public.whatsapp_senders
   where phone_number_id = p_phone_number_id and active;
  if not found then return jsonb_build_object('status', 'sender_desconocido'); end if;

  select * into v_conv from public.candidate_conversations
   where sender_id = v_sender.id and wa_id = p_wa_id and agent_state <> 'cerrada'
   order by created_at desc
   limit 1
   for update;
  if not found then return jsonb_build_object('status', 'sin_conversacion'); end if;

  v_cuerpo := case
    when p_tipo <> 'no_soportado' then left(coalesce(p_texto, ''), 4000)
    when p_texto = 'audio'    then '(te ha mandado un audio)'
    when p_texto = 'image'    then '(te ha mandado una foto)'
    when p_texto = 'document' then '(te ha mandado un archivo)'
    else '(te ha mandado algo que no sabemos leer)'
  end;

  begin
    insert into public.candidate_messages
      (conversation_id, company_id, candidate_id, direction, author, body, provider_message_id,
       delivery_status, payload)
    values
      (v_conv.id, v_conv.company_id, v_conv.candidate_id, 'entrante', 'candidato',
       v_cuerpo, p_provider_id, 'recibido',
       jsonb_build_object(
         'tipo', p_tipo,
         'opcion_id', p_opcion_id,
         'clase', case when p_tipo = 'no_soportado' then p_texto end));
  exception when unique_violation then
    return jsonb_build_object('status', 'duplicado');
  end;

  update public.candidate_conversations
     set last_inbound_at = now(), window_expires_at = now() + interval '24 hours'
   where id = v_conv.id;

  -- La baja, antes que cualquier interpretación y sin esperar. Es un derecho.
  if p_tipo = 'texto' and public.es_peticion_de_baja(p_texto) then
    insert into public.whatsapp_opt_outs (wa_id, motivo) values (p_wa_id, 'peticion')
      on conflict (wa_id) do nothing;
    update public.candidate_conversations
       set opted_out = true, agent_state = 'cerrada'
     where id = v_conv.id;
    update public.interviews set status = 'rechazada'
     where id = v_conv.interview_id
       and status in ('invitada', 'proponiendo');
    return jsonb_build_object('status', 'baja', 'conversation_id', v_conv.id);
  end if;

  if v_conv.handover = 'persona' then
    return jsonb_build_object('status', 'humano', 'conversation_id', v_conv.id);
  end if;

  if p_tipo = 'no_soportado' then
    perform public.programar_conversacion(
      v_conv.id, v_conv.agent_epoch, v_conv.company_id, v_conv.interview_id);
    return jsonb_build_object('status', 'esperando', 'conversation_id', v_conv.id);
  end if;

  -- Los BOTONES no esperan: pulsar es una respuesta completa, no una frase a
  -- medias.
  if p_tipo = 'opcion' then
    -- Una HORA concreta: se reserva.
    if p_opcion_id like 'c:' || v_conv.id::text || ':s:%' then
      v_slot := nullif(regexp_replace(p_opcion_id, '^.*:s:', ''), '')::int;
      return public.book_interview_slot(v_conv.id, v_slot, v_conv.agent_epoch);
    end if;

    -- Un DÍA: el paso 1. Se le enseñan las horas de ese día.
    if p_opcion_id like 'c:' || v_conv.id::text || ':d:%' then
      v_dia := regexp_replace(p_opcion_id, '^.*:d:', '');
      if v_dia !~ '^\d{4}-\d{2}-\d{2}$' then
        return jsonb_build_object('status', 'dia_invalido', 'conversation_id', v_conv.id);
      end if;
      perform public.enqueue_interview_job('enviar_horas',
        jsonb_build_object('dia', v_dia), now(),
        'horas:' || v_conv.id::text || ':' || v_dia || ':' || v_conv.agent_epoch::text,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      return jsonb_build_object('status', 'ofrecer_horas', 'conversation_id', v_conv.id);
    end if;

    if p_opcion_id like 'c:' || v_conv.id::text || ':ver%' then
      perform public.enqueue_interview_job('enviar_horarios', '{}'::jsonb, now(),
        'horarios:' || v_conv.id::text || ':' || v_conv.agent_epoch::text,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      update public.candidate_conversations set agent_state = 'proponiendo_horarios' where id = v_conv.id;
      return jsonb_build_object('status', 'ofrecer_horarios', 'conversation_id', v_conv.id);
    end if;

    if p_opcion_id like 'c:' || v_conv.id::text || ':no%' then
      update public.candidate_conversations set agent_state = 'cerrada' where id = v_conv.id;
      update public.interviews set status = 'rechazada'
       where id = v_conv.interview_id and status in ('invitada', 'proponiendo');
      perform public.enqueue_interview_job('enviar_despedida', '{}'::jsonb, now(),
        'fin:' || v_conv.id::text, v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      return jsonb_build_object('status', 'rechazada', 'conversation_id', v_conv.id);
    end if;

    if p_opcion_id like 'c:' || v_conv.id::text || ':pregunta%' then
      perform public.enqueue_interview_job('responder_duda', '{}'::jsonb, now(),
        'duda:' || v_conv.id::text || ':' || v_conv.agent_epoch::text,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      return jsonb_build_object('status', 'duda', 'conversation_id', v_conv.id);
    end if;
  end if;

  -- Todo lo demás (texto y botones caducados) abre o alarga la espera.
  perform public.programar_conversacion(
    v_conv.id, v_conv.agent_epoch, v_conv.company_id, v_conv.interview_id);
  return jsonb_build_object('status', 'esperando', 'conversation_id', v_conv.id);
end
$$;
revoke all on function public.process_whatsapp_inbound(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.process_whatsapp_inbound(text, text, text, text, text, text) to service_role;
