-- ============================================================================
-- Apúntate Fácil: esperar lo que haga falta, y ni un segundo más
-- ----------------------------------------------------------------------------
-- Medido en producción con la espera fija de 20 s:
--
--   encolado   vencía     contestó   espera   latido+modelo
--   17:08:56   17:09:16   17:09:22     20 s        6 s
--   17:11:11   17:11:31   17:11:49     20 s       18 s
--
-- O sea 26-38 segundos, y el grueso era una espera fija que la mayoría de los
-- mensajes no necesitaban: llegan enteros. Dos cambios, uno por cada mitad:
--
--   1. La espera deja de ser fija y la decide el TEXTO (`interviews/ritmo.ts`,
--      con pruebas): un "hola" suelto espera 18 s porque casi seguro que viene
--      más; "¿qué horas tienes el jueves?" espera 5 porque ya está dicho. La
--      calcula el webhook y la manda aquí; esta función solo obedece.
--   2. El latido deja de ser la fuente del retraso. El webhook devuelve cuánto
--      falta y se despierta él mismo en ese momento exacto (ver
--      whatsapp-webhook). pg_cron se queda de red por si esa espera se pierde.
-- ============================================================================

create or replace function public.programar_conversacion(
  p_conversation uuid,
  p_epoch        bigint,
  p_company      uuid,
  p_interview    uuid,
  p_espera_s     int default 9
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_key text; v_id bigint; v_espera interval; v_run timestamptz;
begin
  v_key := 'conversa:' || p_conversation::text || ':' || coalesce(p_epoch, 0)::text;
  -- Acotada aquí también: quien llama manda, pero no puede pedir una espera
  -- absurda por un fallo suyo.
  v_espera := make_interval(secs => least(greatest(coalesce(p_espera_s, 9), 2), 60));

  insert into public.interview_jobs as j
    (kind, payload, run_at, dedupe_key, company_id, interview_id, conversation_id, agent_epoch)
  values
    ('conversar', '{}'::jsonb, now() + v_espera, v_key,
     p_company, p_interview, p_conversation, p_epoch)
  on conflict (dedupe_key) where dedupe_key is not null and status in ('pendiente', 'en_curso')
  do update
     -- La ventana se REINICIA con cada mensaje suyo (si sigue escribiendo,
     -- seguimos esperando) pero con tope desde el primero: quien escribe sin
     -- parar merece una respuesta igual, no un silencio indefinido.
     set run_at = least(now() + v_espera, j.created_at + interval '2 minutes'),
         updated_at = now()
   where j.status = 'pendiente'
  returning id, run_at into v_id, v_run;

  if v_id is null then
    -- El trabajo con el que choca se está EJECUTANDO ahora mismo, así que ya no
    -- va a leer este mensaje. Se encola otro aparte: perder lo que ha escrito un
    -- candidato porque llegó en el segundo malo no es una opción aceptable.
    insert into public.interview_jobs
      (kind, payload, run_at, dedupe_key, company_id, interview_id, conversation_id, agent_epoch)
    values
      ('conversar', '{}'::jsonb, now() + v_espera,
       v_key || ':' || clock_timestamp()::text,
       p_company, p_interview, p_conversation, p_epoch)
    returning id, run_at into v_id, v_run;
  end if;

  -- `falta_ms` es lo que el webhook necesita para despertarse en el momento
  -- justo en vez de esperar al siguiente latido.
  return jsonb_build_object(
    'job', v_id,
    'falta_ms', greatest(0, round(extract(epoch from v_run - now()) * 1000))::bigint);
end
$$;
revoke all on function public.programar_conversacion(uuid, bigint, uuid, uuid, int)
  from public, anon, authenticated;
grant execute on function public.programar_conversacion(uuid, bigint, uuid, uuid, int) to service_role;

drop function if exists public.programar_conversacion(uuid, bigint, uuid, uuid);

-- ----------------------------------------------------------------------------
-- La entrada pasa la espera y devuelve lo que falta
-- ----------------------------------------------------------------------------
create or replace function public.process_whatsapp_inbound(
  p_phone_number_id text,
  p_wa_id           text,
  p_provider_id     text,
  p_tipo            text,
  p_texto           text default null,
  p_opcion_id       text default null,
  p_espera_s        int  default 9
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
  v_prog   jsonb;
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
    v_prog := public.programar_conversacion(
      v_conv.id, v_conv.agent_epoch, v_conv.company_id, v_conv.interview_id, p_espera_s);
    return jsonb_build_object('status', 'esperando', 'conversation_id', v_conv.id,
                              'falta_ms', v_prog -> 'falta_ms');
  end if;

  -- Los BOTONES no esperan NADA: pulsar es una respuesta completa y cerrada, no
  -- una frase a medias. Es donde la conversación tiene que ir instantánea.
  if p_tipo = 'opcion' then
    if p_opcion_id like 'c:' || v_conv.id::text || ':s:%' then
      v_slot := nullif(regexp_replace(p_opcion_id, '^.*:s:', ''), '')::int;
      return public.book_interview_slot(v_conv.id, v_slot, v_conv.agent_epoch);
    end if;

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

  v_prog := public.programar_conversacion(
    v_conv.id, v_conv.agent_epoch, v_conv.company_id, v_conv.interview_id, p_espera_s);
  return jsonb_build_object('status', 'esperando', 'conversation_id', v_conv.id,
                            'falta_ms', v_prog -> 'falta_ms');
end
$$;
revoke all on function public.process_whatsapp_inbound(text, text, text, text, text, text, int)
  from public, anon, authenticated;
grant execute on function public.process_whatsapp_inbound(text, text, text, text, text, text, int)
  to service_role;

drop function if exists public.process_whatsapp_inbound(text, text, text, text, text, text);
