-- ============================================================================
-- Apúntate Fácil: el aviso de la víspera, con botones
-- ----------------------------------------------------------------------------
-- Hasta ahora solo salía un recordatorio, dos horas antes. Ese avisa, pero
-- cuando ya no da tiempo a nada: si al candidato le ha surgido algo, a esas
-- horas lo único que puede hacer es no presentarse. Y no presentarse es la
-- queja número uno de quien contrata.
--
-- El de la víspera hace otra cosa distinta: PREGUNTA, con un día por delante.
-- "¿Sigue en pie o lo movemos?" con dos botones. Quien no puede lo dice, el
-- hueco se libera y se vuelve a ofrecer; quien sí puede lo confirma de un toque.
-- Por eso conviven los dos y no sobra ninguno.
--
-- Tres decisiones que se notan:
--
--   1. NO va 24 horas justas antes. Una cita a las 09:00 del lunes mandaría un
--      WhatsApp a las 09:00 del domingo. Va la VÍSPERA a las 18:00 de la hora
--      del puesto, que es cuando lo mandaría una persona.
--   2. Si esa hora ya pasó (se cerró la cita anoche para hoy), no se manda
--      nada. Recordar "mañana" cuando ese ayer ya no existe es imposible, y el
--      de las 2 horas sigue cubriendo el caso.
--   3. Sale por PLANTILLA. A un día vista la ventana de 24 h está cerrada casi
--      siempre y una plantilla es lo único que WhatsApp deja entrar. Hay que
--      darla de alta en Meta (`recordatorio_vispera`, ver docs/whatsapp-meta.md):
--      hasta que esté aprobada, este envío falla con 132000.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Que quede constancia de que confirmó
-- ----------------------------------------------------------------------------
-- Es la mitad útil de todo esto para el empresario: saber si la persona ha
-- dicho que va. Columna propia y no un evento suelto, para poder pintarlo en la
-- ficha y ordenar por ello.
alter table public.interviews
  add column if not exists reconfirmed_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2) Los trabajos nuevos
-- ----------------------------------------------------------------------------
alter table public.interview_jobs drop constraint interview_jobs_kind_check;
alter table public.interview_jobs add constraint interview_jobs_kind_check check (kind in (
  'recordatorio_24h', 'recordatorio_2h', 'marcar_realizada', 'avisar_intervencion',
  'recordatorio_vispera',  -- la víspera, con botones de confirmar o mover
  'acuse_asistencia',      -- ha pulsado "Ahí estaré" y se le contesta
  'enviar_invitacion', 'enviar_horarios', 'enviar_horas', 'reofertar_horarios',
  'enviar_confirmacion', 'enviar_despedida', 'enviar_texto',
  'clasificar_texto',
  'conversar',
  'responder_duda',
  'mensaje_no_leible'
));

-- ----------------------------------------------------------------------------
-- 3) Cuándo se programa
-- ----------------------------------------------------------------------------
-- Copia fiel de la de 20260802030000 más el bloque de la víspera. Se repite
-- entera porque `create or replace` no admite parches.
create or replace function public.interviews_sync_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kinds constant text[] := array[
    'recordatorio_24h', 'recordatorio_2h', 'recordatorio_vispera', 'marcar_realizada'];
  v_conv  uuid;
  v_tz    text;
  v_aviso timestamptz;
begin
  perform public.cancel_interview_jobs(new.id, v_kinds);

  if new.status <> 'confirmada' or new.starts_at is null then return new; end if;

  select id into v_conv from public.candidate_conversations
   where interview_id = new.id and agent_state <> 'cerrada' and not opted_out;

  -- Sin conversación viva no hay a dónde mandarlo, y no se inventa otro canal.
  if v_conv is not null then
    v_tz := coalesce(new.timezone, 'Europe/Madrid');

    -- La víspera a las 18:00 de la hora del puesto. Se calcula en hora de PARED
    -- y se convierte: hacerlo restando 24 horas daría las 09:00 de un domingo
    -- para una cita del lunes a las 09:00.
    v_aviso := ((((new.starts_at at time zone v_tz)::date - 1) + time '18:00')
                at time zone v_tz);

    -- Solo si queda margen de verdad. Un aviso de "mañana" que sale dentro de
    -- diez minutos no es un recordatorio, es ruido pegado a la propia cita.
    if v_aviso > now() + interval '30 minutes'
       and v_aviso < new.starts_at - interval '2 hours' then
      perform public.enqueue_interview_job(
        'recordatorio_vispera', '{}'::jsonb, v_aviso,
        'vispera:' || new.id::text, new.company_id, new.id, v_conv, null);
    end if;

    if new.starts_at - interval '2 hours' > now() + interval '5 minutes' then
      perform public.enqueue_interview_job(
        'recordatorio_2h', '{}'::jsonb, new.starts_at - interval '2 hours',
        'rec2:' || new.id::text, new.company_id, new.id, v_conv, null);
    end if;
  end if;

  perform public.enqueue_interview_job(
    'marcar_realizada', '{}'::jsonb, new.ends_at + interval '30 minutes',
    'fin:' || new.id::text, new.company_id, new.id, null, null);

  return new;
end
$$;

-- ----------------------------------------------------------------------------
-- 4) Qué pasa al pulsar cada botón
-- ----------------------------------------------------------------------------
-- Copia fiel de la de 20260802140000 más las dos ramas nuevas. Las cargas
-- (`:ok` y `:mover`) no chocan con las que ya había: `:s:` y `:d:` llevan dos
-- puntos detrás de la letra, y `:no` no es prefijo de ninguna de estas.
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

    -- "Ahí estaré", del aviso de la víspera. Queda anotado para el empresario y
    -- se le contesta una vez. No se toca el estado de la entrevista: seguía y
    -- sigue confirmada.
    if p_opcion_id like 'c:' || v_conv.id::text || ':ok' then
      update public.interviews set reconfirmed_at = now()
       where id = v_conv.interview_id and status = 'confirmada';
      perform public.enqueue_interview_job('acuse_asistencia', '{}'::jsonb, now(),
        'acuse:' || v_conv.id::text || ':' || v_conv.agent_epoch::text,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      return jsonb_build_object('status', 'asistencia_confirmada', 'conversation_id', v_conv.id);
    end if;

    -- "Cambiar cita". La entrevista pasa a 'reprogramando', que CONSERVA el
    -- hueco viejo hasta que elija otro: soltarlo aquí dejaría a alguien que solo
    -- quería moverlo sin cita ninguna si luego no elige. El trigger de arriba se
    -- encarga de retirar el recordatorio de las 2 horas al cambiar de estado.
    if p_opcion_id like 'c:' || v_conv.id::text || ':mover' then
      update public.interviews set status = 'reprogramando'
       where id = v_conv.interview_id and status = 'confirmada';
      perform public.enqueue_interview_job('enviar_horarios', '{}'::jsonb, now(),
        'mover:' || v_conv.id::text || ':' || v_conv.agent_epoch::text,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      update public.candidate_conversations set agent_state = 'proponiendo_horarios'
       where id = v_conv.id;
      return jsonb_build_object('status', 'reprogramando', 'conversation_id', v_conv.id);
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

-- ----------------------------------------------------------------------------
-- 5) El panel tiene que poder decir si confirmó
-- ----------------------------------------------------------------------------
-- Cambia el tipo de retorno (una columna más), y eso `create or replace` no lo
-- admite: hay que tirarla y volver a crearla. Sigue siendo `security invoker`,
-- para que la RLS de interviews aplique sola, como estaba.
drop function if exists public.interview_overview_for_company(uuid);
create function public.interview_overview_for_company(p_company uuid)
returns table (
  id uuid, campaign_id uuid, candidate_id uuid, host_user_id uuid,
  status text, origin text, starts_at timestamptz, ends_at timestamptz,
  timezone text, mode text, location_text text, meeting_url text,
  reconfirmed_at timestamptz, created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.id, i.campaign_id, i.candidate_id, i.host_user_id,
         i.status, i.origin, i.starts_at, i.ends_at,
         i.timezone, i.mode, i.location_text, i.meeting_url,
         i.reconfirmed_at, i.created_at
    from public.interviews i
   where i.company_id = p_company
   order by i.starts_at nulls last, i.created_at desc
$$;
revoke all on function public.interview_overview_for_company(uuid) from public, anon;
grant execute on function public.interview_overview_for_company(uuid) to authenticated;
