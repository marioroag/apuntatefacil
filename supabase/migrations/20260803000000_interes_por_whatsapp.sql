-- ============================================================================
-- Apúntate Fácil: la comprobación de interés, también por WhatsApp
--
-- La PREGUNTA es la misma que la del correo, a propósito. Por eso la respuesta
-- vive en la MISMA tabla y no en una paralela: si cada canal tuviera la suya,
-- "sigue interesado" significaría cosas distintas según por dónde se preguntó y
-- dejarían de poder compararse. Lo único que cambia es a quién se puede
-- escribir (correo, o teléfono con consentimiento) y por dónde vuelve la
-- respuesta (un enlace con token, o un botón de la plantilla).
--
-- Tres cosas que decidió el esquema que ya existía, no yo:
--
--   1. Solo hay UNA conversación viva por candidato
--      (`conversaciones_una_viva_por_candidato`). No se inventa una segunda
--      para preguntar el interés: se reutiliza la que haya. Es además lo
--      correcto de cara al candidato, que en su móvil ve un solo hilo.
--
--   2. La respuesta por WhatsApp NO lleva token. El token existe para que un
--      enlace público pueda identificar la comprobación sin sesión; un botón
--      vuelve por el webhook con nuestra propia carga dentro, y fabricar un
--      token que nadie va a usar sería guardar un secreto de más.
--
--   3. Una conversación SIN entrevista no tiene de qué hablar. Si el candidato
--      contesta con un mensaje en vez de pulsar, la coge una persona. El agente
--      no improvisa sobre una entrevista que no existe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) El canal en la comprobación
-- ----------------------------------------------------------------------------
alter table public.candidate_interest_checks
  add column channel text not null default 'email' check (channel in ('email', 'whatsapp')),
  -- Mismo formato que `candidate_conversations.wa_id`: dígitos con prefijo de
  -- país y sin '+', que es como lo devuelve `wa_id_de`.
  add column recipient_phone text check (recipient_phone is null or recipient_phone ~ '^[0-9]{8,15}$'),
  add column conversation_id uuid references public.candidate_conversations(id) on delete set null;

comment on column public.candidate_interest_checks.channel is
  'Por dónde se preguntó. La pregunta es la misma; cambia el destinatario y cómo vuelve la respuesta.';

-- Las de correo siguen exigiendo correo y token. Las de WhatsApp, ninguno de
-- los dos: exigen teléfono y la conversación por la que salió.
alter table public.candidate_interest_checks alter column recipient_email drop not null;
alter table public.candidate_interest_checks alter column token_hash drop not null;

alter table public.candidate_interest_checks
  add constraint interes_destinatario_del_canal check (
    (channel = 'email'
      and recipient_email is not null and token_hash is not null
      and recipient_phone is null and conversation_id is null)
    or
    (channel = 'whatsapp'
      and recipient_phone is not null and conversation_id is not null
      and recipient_email is null and token_hash is null)
  );

-- Buscar la comprobación al volver un botón. La última de esa conversación es
-- la que se responde: por eso el orden va en el índice y no solo en la consulta.
create index candidate_interest_checks_conversation_idx
  on public.candidate_interest_checks(conversation_id, created_at desc)
  where conversation_id is not null;

-- ----------------------------------------------------------------------------
-- 2) Integridad: la conversación tiene que ser de este candidato
-- ----------------------------------------------------------------------------
-- El trigger que ya existía normaliza el correo y ata la comprobación a su
-- lote. Se le añade lo del canal nuevo. Sigue haciendo falta aunque la función
-- de envío use service_role: precisamente PORQUE lo usa, el esquema vuelve a
-- comprobar cada relación en vez de fiarse de quien escribe.
create or replace function public.enforce_candidate_interest_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_campaign uuid;
begin
  if tg_table_name = 'candidate_interest_batches' then
    select company_id into v_company from public.campaigns where id = new.campaign_id;
    if v_company is null then raise exception 'Puesto no encontrado'; end if;
    new.company_id := v_company;
    new.initiated_by := coalesce(new.initiated_by, auth.uid());
  elsif tg_table_name = 'candidate_interest_checks' then
    select company_id, campaign_id into v_company, v_campaign
      from public.candidate_interest_batches where id = new.batch_id;
    if v_company is null then raise exception 'Lote no encontrado'; end if;
    new.company_id := v_company;
    new.campaign_id := v_campaign;
    new.recipient_email := lower(btrim(new.recipient_email));
    -- La conversación por la que sale un mensaje tiene que ser de la misma
    -- empresa y del mismo puesto. Sin esto, un id de conversación equivocado
    -- mandaría la pregunta de un puesto al hilo de otro.
    if new.conversation_id is not null and not exists (
      select 1 from public.candidate_conversations cc
       where cc.id = new.conversation_id
         and cc.company_id = v_company
         and cc.campaign_id = v_campaign
    ) then
      raise exception 'La conversación no corresponde a la comprobación';
    end if;
    if new.reminder_batch_id is not null and not exists (
      select 1 from public.candidate_interest_batches b
       where b.id = new.reminder_batch_id
         and b.company_id = v_company
         and b.campaign_id = v_campaign
    ) then
      raise exception 'El lote de recordatorio no corresponde a la comprobación';
    end if;
  elsif tg_table_name = 'candidate_interest_check_candidates' then
    select c.company_id, c.campaign_id into v_company, v_campaign
      from public.candidates c where c.id = new.candidate_id and not c.locked;
    if v_company is null then raise exception 'Candidato no disponible'; end if;
    if not exists (
      select 1 from public.candidate_interest_checks ch
       where ch.id = new.check_id
         and ch.company_id = v_company
         and ch.campaign_id = v_campaign
    ) then
      raise exception 'La comprobación no corresponde al candidato';
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3) La conversación por la que preguntar
-- ----------------------------------------------------------------------------
-- Devuelve la conversación viva del candidato, o abre una si no la hay. NO crea
-- entrevista: preguntar si sigue interesado no es citarle.
--
-- El consentimiento se comprueba aquí, igual que en
-- `start_interview_invitation`. Es la misma puerta y no se puede rodear: los
-- dos sitios donde nace un mensaje a un candidato la piden.
create or replace function public.start_interest_conversation(p_candidate uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cand   public.candidates;
  v_conv   public.candidate_conversations;
  v_sender uuid;
  v_wa     text;
begin
  select * into v_cand from public.candidates where id = p_candidate;
  if not found then return jsonb_build_object('status', 'sin_candidato'); end if;

  if v_cand.consent_at is null then return jsonb_build_object('status', 'sin_consentimiento'); end if;

  select public.wa_id_de(v_cand.answers ->> 'telefono') into v_wa;
  if v_wa is null then return jsonb_build_object('status', 'sin_telefono'); end if;

  if exists (select 1 from public.whatsapp_opt_outs o where o.wa_id = v_wa) then
    return jsonb_build_object('status', 'baja');
  end if;

  -- Si ya hay un hilo abierto, se usa ese. En el móvil del candidato solo hay
  -- una conversación con este número: partirla en dos aquí sería una ficción
  -- nuestra, y además el índice de "una viva por candidato" no lo permite.
  select * into v_conv from public.candidate_conversations
   where candidate_id = p_candidate and agent_state <> 'cerrada'
   order by created_at desc limit 1;
  if found then
    if v_conv.opted_out then return jsonb_build_object('status', 'baja'); end if;
    return jsonb_build_object('status', 'ok', 'conversation_id', v_conv.id, 'wa_id', v_conv.wa_id,
      'phone_number_id', (select phone_number_id from public.whatsapp_senders where id = v_conv.sender_id));
  end if;

  select id into v_sender from public.whatsapp_senders
   where active and company_id is not distinct from v_cand.company_id
   order by company_id nulls last limit 1;
  if v_sender is null then
    select id into v_sender from public.whatsapp_senders where active and company_id is null limit 1;
  end if;
  if v_sender is null then return jsonb_build_object('status', 'sin_remitente'); end if;

  insert into public.candidate_conversations (
    company_id, campaign_id, candidate_id, interview_id, sender_id, wa_id, agent_state)
  values (
    v_cand.company_id, v_cand.campaign_id, p_candidate, null, v_sender, v_wa,
    'esperando_respuesta')
  returning * into v_conv;

  return jsonb_build_object('status', 'ok', 'conversation_id', v_conv.id, 'wa_id', v_conv.wa_id,
    'phone_number_id', (select phone_number_id from public.whatsapp_senders where id = v_sender));
end
$$;
revoke all on function public.start_interest_conversation(uuid) from public, anon, authenticated;
grant execute on function public.start_interest_conversation(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 4) Responder desde un botón
-- ----------------------------------------------------------------------------
-- El equivalente de `confirm_candidate_interest_response`, pero sin token: la
-- carga del botón ya identifica la conversación, y quien la trae es el webhook
-- de Meta con su firma comprobada.
create or replace function public.confirm_interest_from_conversation(
  p_conversation uuid,
  p_response     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_check public.candidate_interest_checks;
begin
  if p_response not in ('interested', 'not_interested') then
    return jsonb_build_object('status', 'invalid_response');
  end if;

  -- La ÚLTIMA de esa conversación. Un candidato puede tener varias a lo largo
  -- del tiempo (la recomprobación a los 30 días), y la que contesta es la que
  -- acaba de recibir.
  select * into v_check from public.candidate_interest_checks
   where conversation_id = p_conversation
     and channel = 'whatsapp'
     and delivery_status = 'sent'
   order by created_at desc limit 1
   for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if v_check.superseded_at is not null then return jsonb_build_object('status', 'superseded'); end if;
  if v_check.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;

  -- Se puede cambiar de opinión mientras no caduque, igual que con el enlace
  -- del correo: pulsar dos veces no es un error, es alguien rectificando.
  update public.candidate_interest_checks
     set response = p_response, responded_at = now()
   where id = v_check.id;
  return jsonb_build_object('status', 'ok', 'response', p_response);
end
$$;
revoke all on function public.confirm_interest_from_conversation(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_interest_from_conversation(uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- 5) El panel tiene que poder decir por dónde se preguntó
-- ----------------------------------------------------------------------------
-- Cambia el tipo de retorno (una columna más) y eso `create or replace` no lo
-- admite: hay que tirarlas y volver a crearlas. Siguen siendo `security
-- invoker`, para que la RLS de candidatos aplique sola.
drop function if exists public.candidate_interest_overview(uuid);
create function public.candidate_interest_overview(p_campaign uuid)
returns table (
  candidate_id uuid,
  check_id uuid,
  response text,
  sent_at timestamptz,
  responded_at timestamptz,
  reminder_sent_at timestamptz,
  expires_at timestamptz,
  channel text
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (l.candidate_id)
         l.candidate_id, ch.id, ch.response, ch.sent_at, ch.responded_at,
         ch.reminder_sent_at, ch.expires_at, ch.channel
    from public.candidate_interest_check_candidates l
    join public.candidate_interest_checks ch on ch.id = l.check_id
    join public.candidates c on c.id = l.candidate_id
   where c.campaign_id = p_campaign
     and ch.delivery_status = 'sent'
     and ch.sent_at is not null
   order by l.candidate_id, ch.created_at desc;
$$;
revoke all on function public.candidate_interest_overview(uuid) from public, anon;
grant execute on function public.candidate_interest_overview(uuid) to authenticated;

drop function if exists public.candidate_interest_overview_for_company(uuid);
create function public.candidate_interest_overview_for_company(p_company uuid)
returns table (
  candidate_id uuid,
  check_id uuid,
  response text,
  sent_at timestamptz,
  responded_at timestamptz,
  reminder_sent_at timestamptz,
  expires_at timestamptz,
  channel text
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (l.candidate_id)
         l.candidate_id, ch.id, ch.response, ch.sent_at, ch.responded_at,
         ch.reminder_sent_at, ch.expires_at, ch.channel
    from public.candidate_interest_check_candidates l
    join public.candidate_interest_checks ch on ch.id = l.check_id
    join public.candidates c on c.id = l.candidate_id
   where c.company_id = p_company
     and ch.delivery_status = 'sent'
     and ch.sent_at is not null
   order by l.candidate_id, ch.created_at desc;
$$;
revoke all on function public.candidate_interest_overview_for_company(uuid) from public, anon;
grant execute on function public.candidate_interest_overview_for_company(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Contestar al que ha pulsado
-- ----------------------------------------------------------------------------
-- Preguntar y no acusar recibo es lo que hace que la gente deje de contestar.
-- El trabajo va por la cola normal del agente: `conversation_context` hace
-- `left join` con entrevistas, así que funciona igual en una conversación que
-- no tiene ninguna, que es el caso de esta.
alter table public.interview_jobs drop constraint interview_jobs_kind_check;
alter table public.interview_jobs add constraint interview_jobs_kind_check check (kind in (
  'recordatorio_24h', 'recordatorio_2h', 'marcar_realizada', 'avisar_intervencion',
  'recordatorio_vispera', 'acuse_asistencia',
  'acuse_interes',         -- ha contestado a la comprobación de interés
  'enviar_invitacion', 'enviar_horarios', 'enviar_horas', 'reofertar_horarios',
  'enviar_confirmacion', 'enviar_despedida', 'enviar_texto',
  'clasificar_texto',
  'conversar',
  'responder_duda',
  'mensaje_no_leible'
));

-- ----------------------------------------------------------------------------
-- 7) El botón de vuelta, y el silencio del agente cuando no hay entrevista
-- ----------------------------------------------------------------------------
-- Cede la conversación a una persona. En su propia función porque el caso sale
-- por dos sitios del enrutado y copiarlo invita a que uno de los dos se quede
-- atrás el día que cambie el motivo.
create or replace function public.pasar_a_persona(p_conversation uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.candidate_conversations
     set handover = 'persona',
         agent_state = 'necesita_intervencion',
         attention_reason = p_motivo
   where id = p_conversation;
  return jsonb_build_object('status', 'necesita_persona', 'conversation_id', p_conversation);
end
$$;
revoke all on function public.pasar_a_persona(uuid, text) from public, anon, authenticated;
grant execute on function public.pasar_a_persona(uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- Se reescribe entera (`create or replace` no admite parches) con dos cambios:
-- la rama del botón de interés, y el guardián de arriba.
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
  v_interes jsonb;
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

  -- OJO AL SITIO: esto va DESPUÉS de las ramas de botón, nunca antes. Puesto
  -- arriba se come las pulsaciones, que es justo lo que tiene que seguir
  -- funcionando en una conversación sin entrevista.
  if p_tipo = 'no_soportado' then
    if v_conv.interview_id is null then
      return public.pasar_a_persona(v_conv.id, 'Ha contestado escribiendo, no con los botones');
    end if;
    v_prog := public.programar_conversacion(
      v_conv.id, v_conv.agent_epoch, v_conv.company_id, v_conv.interview_id, p_espera_s);
    return jsonb_build_object('status', 'esperando', 'conversation_id', v_conv.id,
                              'falta_ms', v_prog -> 'falta_ms');
  end if;

  -- Los BOTONES no esperan NADA: pulsar es una respuesta completa y cerrada, no
  -- una frase a medias. Es donde la conversación tiene que ir instantánea.
  if p_tipo = 'opcion' then
    -- La comprobación de interés. Va la PRIMERA por lo que se lee debajo: el
    -- patrón del "No me interesa" de la invitación es `:no%`, y `:i:no` no cae
    -- ahí porque los dos puntos separan, pero son dos "no" que significan cosas
    -- distintas (no quiero el puesto / no quiero esta cita) y conviene que el
    -- orden lo diga sin tener que razonarlo.
    if p_opcion_id like 'c:' || v_conv.id::text || ':i:%' then
      v_interes := public.confirm_interest_from_conversation(
        v_conv.id,
        case when p_opcion_id like '%:i:si' then 'interested' else 'not_interested' end);
      -- Se le contesta una vez y no se le da más la lata. Preguntar el interés
      -- no abre una conversación: es una pregunta cerrada de una sola respuesta.
      perform public.enqueue_interview_job('acuse_interes',
        jsonb_build_object('respuesta', v_interes ->> 'response'), now(),
        'interes:' || v_conv.id::text || ':' || v_conv.agent_epoch::text,
        v_conv.company_id, v_conv.interview_id, v_conv.id, v_conv.agent_epoch);
      return jsonb_build_object('status', 'interes', 'conversation_id', v_conv.id,
                                'respuesta', v_interes ->> 'response');
    end if;

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

  -- Aquí llega el texto libre y cualquier opción que no reconozcamos. Una
  -- conversación sin entrevista no tiene de qué hablar: el agente conoce
  -- horarios, sitio y hora de UNA entrevista, y sin ella cualquier cosa que
  -- dijera se la estaría inventando. Lo lee una persona.
  if v_conv.interview_id is null then
    return public.pasar_a_persona(v_conv.id, 'Ha contestado escribiendo, no con los botones');
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
