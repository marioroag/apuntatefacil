-- ============================================================================
-- Apúntate Fácil: la conversación de la entrevista
-- ----------------------------------------------------------------------------
-- La conversación PERTENECE AL CANDIDATO, no a una bandeja aparte. Vive en su
-- ficha, en la pestaña de al lado del chat de equipo y del historial. No hay
-- (ni va a haber) una bandeja global de WhatsApp: obligaría a saltar entre dos
-- sitios para entender a una sola persona.
--
-- Separación deliberada respecto de public.interviews:
--   * `interviews`      es el DOMINIO. Qué cita hay, cuándo y con quién.
--   * `candidate_conversations` es el CANAL. Cómo se está hablando con esa
--     persona y quién lleva la voz cantante ahora mismo.
-- Una entrevista cerrada por teléfono no tiene conversación, y sigue siendo una
-- entrevista de pleno derecho. Por eso `interview_id` admite null en los dos
-- sentidos: se puede empezar a hablar antes de que haya cita.
--
-- Molde: 20260731120000_candidate_modal.sql (el `exists` invoker sobre
-- candidates para que candidates_scoped acote al encargado) y
-- 20260801120000_interviews.sql (grants explícitos, broadcast sin PII).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Remitentes
-- ----------------------------------------------------------------------------
-- El piloto usa UN número compartido de Apúntate Fácil (company_id null). El
-- día que cada empresa tenga el suyo por Embedded Signup, esto es insertar
-- filas: ni las conversaciones ni las entrevistas se enteran.

create table public.whatsapp_senders (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.companies(id) on delete cascade,
  phone_number_id text not null unique,
  display_phone   text not null default '',
  waba_id         text not null default '',
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Un solo número compartido activo a la vez. Sin esto, dos filas sin empresa
-- harían que el enrutado del webhook fuese ambiguo.
create unique index whatsapp_senders_compartido_uq
  on public.whatsapp_senders ((true)) where company_id is null and active;

-- ----------------------------------------------------------------------------
-- 2) Conversaciones
-- ----------------------------------------------------------------------------

create table public.candidate_conversations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  interview_id uuid unique references public.interviews(id) on delete set null,
  sender_id    uuid references public.whatsapp_senders(id) on delete set null,
  channel      text not null default 'whatsapp' check (channel in ('whatsapp')),
  -- El número tal y como lo devuelve el proveedor, no el que adivinamos
  -- nosotros: puede diferir del que enviamos.
  wa_id        text check (wa_id is null or wa_id ~ '^[0-9]{8,15}$'),

  -- Quién lleva la conversación AHORA. Es la distinción que pide el producto:
  -- automática o tomada por una persona, nunca ambigua.
  handover     text not null default 'agente' check (handover in ('agente', 'persona')),
  agent_state  text not null default 'preparando' check (agent_state in (
                 'preparando',              -- creada, aún no ha salido nada
                 'contactando',             -- mensaje de invitación en camino
                 'esperando_respuesta',
                 'proponiendo_horarios',
                 'entrevista_confirmada',
                 'necesita_intervencion',
                 'cerrada')),
  -- Token de vallado. Cada toma o devolución de control lo sube; un trabajo
  -- encolado con un epoch viejo se descarta solo en vez de pisar lo que acaba
  -- de decidir una persona.
  agent_epoch  bigint not null default 1,
  -- Por qué hace falta una persona. Se pinta tal cual en la pestaña.
  attention_reason text check (attention_reason is null or char_length(attention_reason) <= 200),
  -- Ventana de 24 h de WhatsApp: fuera de ella solo se pueden mandar plantillas
  -- aprobadas, ni texto libre ni botones. La abre CADA mensaje entrante.
  window_expires_at timestamptz,
  nudges_sent  int not null default 0 check (nudges_sent between 0 and 5),
  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,
  -- Baja del candidato. Terminal y por encima de todo lo demás.
  opted_out    boolean not null default false,
  created_at   timestamptz not null default now(),

  -- "Necesita intervención" IMPLICA que la lleva una persona. No existe el
  -- estado "el agente está atascado pero sigue siendo suyo": ahí es donde el
  -- agente seguiría escribiendo en un caso que no entiende.
  constraint conversacion_intervencion_es_de_persona
    check (agent_state <> 'necesita_intervencion' or handover = 'persona')
);

create index candidate_conversations_candidate_idx
  on public.candidate_conversations(candidate_id);
create index candidate_conversations_company_idx
  on public.candidate_conversations(company_id, created_at desc);

-- Una sola conversación viva por par (remitente, teléfono). Con número
-- compartido, dos empresas escribiendo a la vez al mismo candidato comparten
-- ventana de 24 h y le mezclan los hilos: la segunda espera su turno.
create unique index conversaciones_una_activa_por_par
  on public.candidate_conversations (sender_id, wa_id)
  where agent_state in ('contactando', 'esperando_respuesta', 'proponiendo_horarios');

-- Y una sola conversación viva por candidato, que es lo que la ficha asume.
create unique index conversaciones_una_viva_por_candidato
  on public.candidate_conversations (candidate_id)
  where agent_state <> 'cerrada';

-- ----------------------------------------------------------------------------
-- 3) Mensajes
-- ----------------------------------------------------------------------------

create table public.candidate_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.candidate_conversations(id) on delete cascade,
  company_id      uuid not null,
  candidate_id    uuid not null,
  direction       text not null check (direction in ('entrante', 'saliente')),
  -- Quién habla. 'agente' y 'persona' se pintan distinto a propósito: el
  -- empresario tiene que poder ver de un vistazo qué dijo él y qué dijimos
  -- nosotros en su nombre.
  author          text not null check (author in ('agente', 'persona', 'candidato', 'sistema')),
  author_user_id  uuid references auth.users(id) on delete set null,
  body            text not null default '' check (char_length(body) <= 4000),
  -- Opciones ofrecidas, horarios propuestos, carga del proveedor... lo que la
  -- interfaz necesite pintar bajo el mensaje.
  payload         jsonb not null default '{}'::jsonb check (length(payload::text) <= 20000),
  template_name   text,
  provider_message_id text,
  delivery_status text not null default 'pendiente' check (delivery_status in (
                    'pendiente', 'enviado', 'entregado', 'leido', 'fallido', 'recibido')),
  error_code      int,
  error_text      text check (error_text is null or char_length(error_text) <= 500),
  created_at      timestamptz not null default now()
);

-- La deduplicación del webhook se apoya en esto: insertar el mensaje ES el
-- claim. Si el proveedor reentrega, la segunda inserción no cuenta.
create unique index candidate_messages_provider_uq
  on public.candidate_messages(provider_message_id) where provider_message_id is not null;
create index candidate_messages_conv_idx
  on public.candidate_messages(conversation_id, created_at);

-- Rellena company_id y candidate_id desde la conversación: el cliente no los
-- manda y así no pueden falsearse.
create or replace function public.candidate_messages_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select c.company_id, c.candidate_id into new.company_id, new.candidate_id
    from public.candidate_conversations c where c.id = new.conversation_id;
  if new.company_id is null then raise exception 'conversación inexistente'; end if;
  if new.author = 'persona' then new.author_user_id := coalesce(new.author_user_id, auth.uid()); end if;
  return new;
end
$$;

create trigger trg_candidate_messages_fill
  before insert on public.candidate_messages
  for each row execute function public.candidate_messages_fill();

-- Mantiene al día los relojes de la conversación. La ventana de 24 h la abre
-- SIEMPRE un entrante: es la regla de WhatsApp, no una decisión nuestra.
create or replace function public.candidate_messages_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction = 'entrante' then
    update public.candidate_conversations
       set last_inbound_at = new.created_at,
           window_expires_at = new.created_at + interval '24 hours'
     where id = new.conversation_id;
  else
    update public.candidate_conversations
       set last_outbound_at = new.created_at
     where id = new.conversation_id;
  end if;
  return new;
exception when others then
  return new;
end
$$;

create trigger trg_candidate_messages_touch
  after insert on public.candidate_messages
  for each row execute function public.candidate_messages_touch();

-- Aviso en vivo, sin PII. Sexto evento del canal privado que ya existe.
create or replace function public.candidate_conversation_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('candidate_id', new.candidate_id, 'conversation_id', new.conversation_id),
    'candidate_conversation_ping',
    'company:' || new.company_id::text,
    true);
  return new;
exception when others then
  return new;
end
$$;

create trigger trg_candidate_messages_broadcast
  after insert on public.candidate_messages
  for each row execute function public.candidate_conversation_broadcast();

-- ----------------------------------------------------------------------------
-- 4) RLS
-- ----------------------------------------------------------------------------

alter table public.whatsapp_senders enable row level security;
alter table public.candidate_conversations enable row level security;
alter table public.candidate_messages enable row level security;

create policy "senders_select" on public.whatsapp_senders
  for select to authenticated
  using (company_id is null or company_id in (select public.current_user_company_ids()));

-- El `exists` corre como INVOKER: candidates_scoped aplica sola y un encargado
-- solo ve las conversaciones de los candidatos que ya puede ver.
create policy "conversaciones_select" on public.candidate_conversations
  for select to authenticated
  using (
    company_id in (select public.current_user_company_ids())
    and exists (
      select 1 from public.candidates c
       where c.id = candidate_id and c.company_id = candidate_conversations.company_id
    )
  );

create policy "mensajes_select" on public.candidate_messages
  for select to authenticated
  using (
    company_id in (select public.current_user_company_ids())
    and exists (
      select 1 from public.candidates c
       where c.id = candidate_id and c.company_id = candidate_messages.company_id
    )
  );

-- Sin insert por policy en ninguna de las dos: escribir un mensaje es MANDAR un
-- WhatsApp, y eso lo hace el servidor. La interfaz llama a RPC y edge functions.

-- ----------------------------------------------------------------------------
-- 5) Grants (explícitos: aquí nadie hereda, tampoco service_role)
-- ----------------------------------------------------------------------------

revoke all on public.whatsapp_senders, public.candidate_conversations, public.candidate_messages
  from anon, authenticated, public;
grant select on public.whatsapp_senders to authenticated;
grant select on public.candidate_conversations to authenticated;
grant select on public.candidate_messages to authenticated;
grant select, insert, update, delete on public.whatsapp_senders to service_role;
grant select, insert, update, delete on public.candidate_conversations to service_role;
grant select, insert, update, delete on public.candidate_messages to service_role;

-- ----------------------------------------------------------------------------
-- 6) Arrancar la conversación
-- ----------------------------------------------------------------------------
-- Crea entrevista + conversación EN LA MISMA TRANSACCIÓN. Si una de las dos
-- falla no queda ni media invitación a medio empezar, que es el estado que
-- luego nadie sabe interpretar.

create or replace function public.start_interview_invitation(
  p_candidate   uuid,
  p_host        uuid  default null,
  p_duration    int   default 30,
  p_buffer      int   default 15,
  p_mode        text  default 'presencial',
  p_location    text  default '',
  p_meeting_url text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx record;
  v_interview public.interviews;
  v_conv public.candidate_conversations;
  v_host uuid := coalesce(p_host, auth.uid());
  v_sender uuid;
  v_phone text;
begin
  select * into v_ctx from public.interview_candidate_context(p_candidate);
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not v_ctx.plan_ok then return jsonb_build_object('status', 'plan'); end if;
  if v_ctx.campaign_status <> 'activa' then return jsonb_build_object('status', 'puesto_inactivo'); end if;

  if not exists (
    select 1 from public.memberships m
     where m.user_id = v_host and m.company_id = v_ctx.company_id
  ) then raise exception 'El anfitrión no es del equipo' using errcode = '42501'; end if;

  -- Sin teléfono no hay WhatsApp que valga. Se dice antes de crear nada.
  select nullif(regexp_replace(coalesce(c.answers ->> 'telefono', ''), '\D', '', 'g'), '')
    into v_phone
    from public.candidates c where c.id = p_candidate;
  if v_phone is null then return jsonb_build_object('status', 'sin_telefono'); end if;

  select id into v_sender from public.whatsapp_senders
   where active and company_id is not distinct from v_ctx.company_id
   order by company_id nulls last limit 1;
  if v_sender is null then
    select id into v_sender from public.whatsapp_senders where active and company_id is null limit 1;
  end if;

  begin
    insert into public.interviews (
      company_id, campaign_id, candidate_id, host_user_id, created_by,
      status, origin, duration_minutes, buffer_minutes, timezone,
      mode, location_text, meeting_url)
    values (
      v_ctx.company_id, v_ctx.campaign_id, p_candidate, v_host, auth.uid(),
      'invitada', 'whatsapp', p_duration, p_buffer, v_ctx.tz,
      p_mode, coalesce(p_location, ''), p_meeting_url)
    returning * into v_interview;
  exception when unique_violation then
    select * into v_interview from public.interviews
     where candidate_id = p_candidate
       and status in ('invitada', 'proponiendo', 'confirmada', 'reprogramando');
    select * into v_conv from public.candidate_conversations
     where candidate_id = p_candidate and agent_state <> 'cerrada';
    -- La segunda pulsación devuelve lo que ya hay. Ni error ni duplicado.
    return jsonb_build_object('status', 'ya_existe',
      'interview_id', v_interview.id, 'conversation_id', v_conv.id);
  end;

  insert into public.candidate_conversations (
    company_id, campaign_id, candidate_id, interview_id, sender_id, wa_id, agent_state)
  values (
    v_ctx.company_id, v_ctx.campaign_id, p_candidate, v_interview.id, v_sender,
    -- España: 9 dígitos se prefijan con 34. Es una conjetura razonable para
    -- arrancar; el wa_id BUENO es el que devuelva el proveedor al enviar.
    case when length(v_phone) = 9 then '34' || v_phone else v_phone end,
    'preparando')
  returning * into v_conv;

  return jsonb_build_object('status', 'ok',
    'interview_id', v_interview.id, 'conversation_id', v_conv.id);
end
$$;
revoke all on function public.start_interview_invitation(uuid, uuid, int, int, text, text, text)
  from public, anon;
grant execute on function public.start_interview_invitation(uuid, uuid, int, int, text, text, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- 7) Tomar y devolver el control
-- ----------------------------------------------------------------------------

create or replace function public.conversation_set_handover(p_conversation uuid, p_handover text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.candidate_conversations;
begin
  if p_handover not in ('agente', 'persona') then
    raise exception 'Valor no válido';
  end if;
  select * into v from public.candidate_conversations
   where id = p_conversation
     and campaign_id in (select public.current_user_campaign_ids())
   for update;
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;

  update public.candidate_conversations
     set handover = p_handover,
         -- Subir el epoch invalida los trabajos en vuelo del agente.
         agent_epoch = agent_epoch + 1,
         -- Devolver el control al agente limpia el motivo de intervención; si
         -- no, la ficha seguiría pidiendo ayuda para algo ya resuelto.
         agent_state = case
           when p_handover = 'agente' and v.agent_state = 'necesita_intervencion'
             then 'esperando_respuesta'
           else v.agent_state end,
         attention_reason = case when p_handover = 'agente' then null else v.attention_reason end
   where id = p_conversation;

  insert into public.candidate_messages (conversation_id, direction, author, body, delivery_status)
  values (p_conversation, 'saliente', 'sistema',
          case when p_handover = 'persona' then 'handover_persona' else 'handover_agente' end,
          'enviado');

  return jsonb_build_object('status', 'ok');
end
$$;
revoke all on function public.conversation_set_handover(uuid, text) from public, anon;
grant execute on function public.conversation_set_handover(uuid, text) to authenticated;
