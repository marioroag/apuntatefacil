-- ============================================================================
-- Apúntate Fácil: la cola de trabajos de entrevista
-- ----------------------------------------------------------------------------
-- Esto es el motor. Hasta aquí la app REACCIONA a que alguien pulse algo; a
-- partir de aquí hace cosas sola: manda la invitación, recuerda la cita, y si
-- algo falla lo reintenta. Sin esto no hay agente, solo botones.
--
-- Se construye antes que WhatsApp a propósito, y con una carga útil que ya
-- funciona hoy (recordatorios por email, que Resend ya sirve en producción).
-- Así la cola queda rodada y probada por sí sola, y cuando encima se le ponga
-- el canal (o las llamadas), el motor ya no es lo que está a prueba.
--
-- Cuatro propiedades que se piden de una cola de verdad, y dónde vive cada una:
--
--   1. Nada se pierde si el proceso muere a media tarea. -> El segador: lo que
--      lleva demasiado 'en_curso' vuelve a 'pendiente'. Esa ES la recuperación
--      ante caída, y no hace falta nada más.
--   2. Dos ticks solapados no hacen el mismo trabajo dos veces. -> `for update
--      skip locked`, que les reparte conjuntos disjuntos sin un lock global
--      (un lock global serializaría el sistema entero en un worker).
--   3. Encolar dos veces lo mismo no manda dos mensajes. -> `dedupe_key` con
--      índice único parcial sobre los vivos.
--   4. Rendirse NUNCA es callarse. -> Al agotar los intentos la conversación
--      pasa a manos de una persona y se dice por qué. Un candidato colgado sin
--      que nadie se entere es el único fallo inaceptable de esta feature.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) La tabla
-- ----------------------------------------------------------------------------

create table public.interview_jobs (
  id              bigint generated always as identity primary key,
  kind            text not null check (kind in (
                    'recordatorio_24h',    -- email al anfitrión, la víspera
                    'recordatorio_2h',     -- email al anfitrión, un rato antes
                    'marcar_realizada',    -- cerrar la cita ya pasada
                    'enviar_invitacion',   -- (H4) primer mensaje al candidato
                    'reofertar_horarios',  -- (H4) su hueco lo cogió otro
                    'avisar_intervencion' -- email al equipo: esto lo tienes que ver tú
                  )),

  company_id      uuid references public.companies(id) on delete cascade,
  interview_id    uuid references public.interviews(id) on delete cascade,
  conversation_id uuid references public.candidate_conversations(id) on delete cascade,
  -- Token de vallado. Si al ejecutar el trabajo la conversación ya va por otro
  -- epoch, es que una persona tomó el control mientras tanto: el trabajo se
  -- cancela sin ruido. Cancelar los pendientes no basta, porque uno ya
  -- reclamado por un tick en vuelo no se puede parar con un UPDATE.
  agent_epoch     bigint,

  payload         jsonb not null default '{}'::jsonb check (length(payload::text) <= 8000),
  run_at          timestamptz not null default now(),
  status          text not null default 'pendiente'
                  check (status in ('pendiente', 'en_curso', 'hecho', 'fallido', 'cancelado')),
  attempts        int not null default 0,
  max_attempts    int not null default 6 check (max_attempts between 1 and 20),
  locked_until    timestamptz,
  dedupe_key      text check (dedupe_key is null or char_length(dedupe_key) <= 200),
  last_error      text check (last_error is null or char_length(last_error) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Encolar lo mismo dos veces no duplica el trabajo. Solo entre los VIVOS: una
-- vez hecho, la misma clave puede volver a usarse (reprogramar una entrevista
-- vuelve a poner sus recordatorios).
create unique index interview_jobs_dedupe_uq
  on public.interview_jobs (dedupe_key)
  where dedupe_key is not null and status in ('pendiente', 'en_curso');

-- La cola se lee siempre igual: lo pendiente cuya hora ya llegó, lo más viejo
-- primero. Índice parcial porque lo hecho no se vuelve a mirar nunca y sería
-- la mayor parte de la tabla.
create index interview_jobs_cola_idx
  on public.interview_jobs (run_at) where status = 'pendiente';
create index interview_jobs_segador_idx
  on public.interview_jobs (locked_until) where status = 'en_curso';
create index interview_jobs_entrevista_idx
  on public.interview_jobs (interview_id) where status in ('pendiente', 'en_curso');

-- RLS activada y CERO policies, a propósito. Nadie autenticado toca esta tabla
-- ni para leer: es fontanería, y contiene los datos de todas las empresas. Si
-- mañana un grant se cuela por error, la RLS sigue tapando el agujero.
alter table public.interview_jobs enable row level security;
revoke all on public.interview_jobs from anon, authenticated, public;
grant select, insert, update, delete on public.interview_jobs to service_role;

-- ----------------------------------------------------------------------------
-- 2) Encolar
-- ----------------------------------------------------------------------------

create or replace function public.enqueue_interview_job(
  p_kind         text,
  p_payload      jsonb       default '{}'::jsonb,
  p_run_at       timestamptz default now(),
  p_dedupe_key   text        default null,
  p_company      uuid        default null,
  p_interview    uuid        default null,
  p_conversation uuid        default null,
  p_epoch        bigint      default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  insert into public.interview_jobs
    (kind, payload, run_at, dedupe_key, company_id, interview_id, conversation_id, agent_epoch)
  values
    (p_kind, coalesce(p_payload, '{}'::jsonb), p_run_at, p_dedupe_key,
     p_company, p_interview, p_conversation, p_epoch)
  on conflict (dedupe_key) where dedupe_key is not null and status in ('pendiente', 'en_curso')
  do nothing
  returning id into v_id;
  return v_id;   -- null si ya estaba encolado: no es un error, es el punto
end
$$;
revoke all on function public.enqueue_interview_job(text, jsonb, timestamptz, text, uuid, uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.enqueue_interview_job(text, jsonb, timestamptz, text, uuid, uuid, uuid, bigint)
  to service_role;

-- ----------------------------------------------------------------------------
-- 3) Reclamar
-- ----------------------------------------------------------------------------

create or replace function public.claim_interview_jobs(
  p_limit int      default 20,
  p_lease interval default interval '2 minutes'
)
returns setof public.interview_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El segador va primero y en la misma llamada: lo que se quedó a medias
  -- (proceso muerto, timeout de la función, despliegue a mitad) vuelve a la
  -- cola por sí solo. Sin esto haría falta un vigilante aparte, que es otra
  -- cosa que se puede caer.
  update public.interview_jobs
     set status = 'pendiente', locked_until = null, run_at = now(), updated_at = now()
   where status = 'en_curso' and locked_until < now();

  return query
  with elegidos as (
    select j.id
      from public.interview_jobs j
     where j.status = 'pendiente' and j.run_at <= now()
     order by j.run_at
     -- Dos ticks a la vez se reparten trabajos DISTINTOS en vez de pelearse
     -- por el mismo. Sin `skip locked` el segundo se quedaría esperando al
     -- primero y la cola avanzaría a la velocidad de un solo worker.
     for update skip locked
     limit greatest(1, least(p_limit, 100))
  )
  update public.interview_jobs j
     set status = 'en_curso',
         locked_until = now() + p_lease,
         attempts = j.attempts + 1,
         updated_at = now()
    from elegidos e
   where j.id = e.id
  returning j.*;
end
$$;
revoke all on function public.claim_interview_jobs(int, interval) from public, anon, authenticated;
grant execute on function public.claim_interview_jobs(int, interval) to service_role;

-- ----------------------------------------------------------------------------
-- 4) Pedir ayuda: rendirse en voz alta
-- ----------------------------------------------------------------------------
-- Se usa al agotar los intentos y desde cualquier sitio que detecte algo que el
-- agente no sabe resolver. Pasa la conversación a una persona y deja escrito el
-- motivo EN EL HILO, que es donde el empresario va a mirar.

create or replace function public.escalar_conversacion(p_conversation uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_conv public.candidate_conversations;
begin
  select * into v_conv from public.candidate_conversations where id = p_conversation for update;
  if not found or v_conv.agent_state = 'cerrada' then return; end if;

  -- Los dos campos a la vez: el CHECK de la tabla prohíbe "necesita
  -- intervención" sin que la lleve una persona, que es justo la clase de bug
  -- donde el agente sigue escribiendo en un caso que no entiende.
  update public.candidate_conversations
     set handover = 'persona',
         agent_state = 'necesita_intervencion',
         attention_reason = left(p_motivo, 200),
         agent_epoch = agent_epoch + 1
   where id = p_conversation;

  insert into public.candidate_messages
    (conversation_id, company_id, candidate_id, direction, author, body)
  values
    (p_conversation, v_conv.company_id, v_conv.candidate_id, 'saliente', 'sistema',
     left(p_motivo, 4000));

  -- Y que se entere alguien, no solo el hilo.
  perform public.enqueue_interview_job(
    'avisar_intervencion',
    jsonb_build_object('motivo', left(p_motivo, 200)),
    now(),
    'aviso:' || p_conversation::text,
    v_conv.company_id, v_conv.interview_id, p_conversation, null);
end
$$;
revoke all on function public.escalar_conversacion(uuid, text) from public, anon, authenticated;
grant execute on function public.escalar_conversacion(uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- 5) Cerrar el trabajo
-- ----------------------------------------------------------------------------

create or replace function public.finish_interview_job(
  p_id    bigint,
  p_ok    boolean,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.interview_jobs; v_espera interval;
begin
  select * into v_job from public.interview_jobs where id = p_id for update;
  if not found then return jsonb_build_object('status', 'no_existe'); end if;

  -- p_ok null = "dejó de proceder". No es éxito (no se hizo) ni fallo (no hay
  -- nada que reintentar): el candidato ya contestó, o una persona tomó el
  -- control, o cerraron el puesto. Marcarlo 'hecho' sería mentir en el registro
  -- que luego se mira para entender qué pasó con un candidato.
  if p_ok is null then
    update public.interview_jobs
       set status = 'cancelado', locked_until = null,
           last_error = left(p_error, 500), updated_at = now()
     where id = p_id;
    return jsonb_build_object('status', 'cancelado');
  end if;

  if p_ok then
    update public.interview_jobs
       set status = 'hecho', locked_until = null, last_error = null, updated_at = now()
     where id = p_id;
    return jsonb_build_object('status', 'hecho');
  end if;

  if v_job.attempts >= v_job.max_attempts then
    update public.interview_jobs
       set status = 'fallido', locked_until = null,
           last_error = left(coalesce(p_error, 'sin detalle'), 500), updated_at = now()
     where id = p_id;

    -- Agotado NO es silencio. Si hay conversación detrás, la coge una persona.
    if v_job.conversation_id is not null then
      perform public.escalar_conversacion(
        v_job.conversation_id,
        'No hemos podido continuar solos con este candidato. Sigue tú desde aquí.');
    end if;
    return jsonb_build_object('status', 'agotado', 'intentos', v_job.attempts);
  end if;

  -- Backoff exponencial con tope: 20 s, 1 min, 3 min, 9 min, 27 min, 1 h. Da
  -- tiempo a que un proveedor caído se levante sin martillearlo mientras tanto.
  --
  -- El -1 no es cosmético: `claim` ya subió attempts a 1 antes de ejecutar, así
  -- que sin él el primer reintento se iría a 60 s. Y el primer reintento es el
  -- que más importa, porque el fallo típico es un 500 pasajero del proveedor y
  -- al otro lado hay un candidato esperando una respuesta.
  v_espera := least(interval '1 hour', make_interval(secs => 20 * power(3, greatest(0, v_job.attempts - 1))::int));
  update public.interview_jobs
     set status = 'pendiente', locked_until = null, run_at = now() + v_espera,
         last_error = left(coalesce(p_error, 'sin detalle'), 500), updated_at = now()
   where id = p_id;
  return jsonb_build_object('status', 'reintentar', 'en', v_espera::text, 'intentos', v_job.attempts);
end
$$;
revoke all on function public.finish_interview_job(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_interview_job(bigint, boolean, text) to service_role;

-- Cancelar (obsoleto, no fallido): el trabajo dejó de tener sentido.
create or replace function public.cancel_interview_jobs(
  p_interview uuid,
  p_kinds     text[] default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update public.interview_jobs
     set status = 'cancelado', locked_until = null, updated_at = now()
   where interview_id = p_interview
     and status = 'pendiente'
     and (p_kinds is null or kind = any (p_kinds));
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
revoke all on function public.cancel_interview_jobs(uuid, text[]) from public, anon, authenticated;
grant execute on function public.cancel_interview_jobs(uuid, text[]) to service_role;

-- ----------------------------------------------------------------------------
-- 6) Lo que la entrevista programa sola
-- ----------------------------------------------------------------------------
-- Confirmar una cita programa sus recordatorios; cancelarla los retira;
-- moverla los recoloca. Va en un trigger y no en las RPCs porque así vale para
-- las tres vías de entrada (a mano, por WhatsApp, y lo que venga) sin tener que
-- acordarse en cada una.

create or replace function public.interviews_sync_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kinds constant text[] := array['recordatorio_24h', 'recordatorio_2h', 'marcar_realizada'];
begin
  -- Se retiran siempre y se vuelven a poner si procede. Recolocar es más
  -- simple que calcular qué cambió, y no deja recordatorios de una hora vieja.
  perform public.cancel_interview_jobs(new.id, v_kinds);

  if new.status <> 'confirmada' or new.starts_at is null then return new; end if;

  -- Los recordatorios por email son para la PERSONA que entrevista. Si la
  -- entrevista la hacemos nosotros no hay a quién recordarle nada.
  if new.interviewer = 'empresa' and new.host_user_id is not null then
    -- Solo si aún queda margen: mandar "mañana tienes una entrevista" cuando es
    -- dentro de tres horas no es un recordatorio, es ruido que confunde.
    if new.starts_at - interval '24 hours' > now() + interval '5 minutes' then
      perform public.enqueue_interview_job(
        'recordatorio_24h', '{}'::jsonb, new.starts_at - interval '24 hours',
        'rec24:' || new.id::text, new.company_id, new.id, null, null);
    end if;
    if new.starts_at - interval '2 hours' > now() + interval '5 minutes' then
      perform public.enqueue_interview_job(
        'recordatorio_2h', '{}'::jsonb, new.starts_at - interval '2 hours',
        'rec2:' || new.id::text, new.company_id, new.id, null, null);
    end if;
  end if;

  -- Y cerrarla cuando pase. Media hora de cortesía por si se alarga.
  perform public.enqueue_interview_job(
    'marcar_realizada', '{}'::jsonb, new.ends_at + interval '30 minutes',
    'fin:' || new.id::text, new.company_id, new.id, null, null);

  return new;
end
$$;

create trigger trg_interviews_sync_jobs
  after insert or update of status, starts_at, ends_at on public.interviews
  for each row execute function public.interviews_sync_jobs();

-- ----------------------------------------------------------------------------
-- 7) Lo que necesita el email, en una sola llamada
-- ----------------------------------------------------------------------------
-- La edge function no consulta tablas por su cuenta: pide esto y ya tiene todo.
-- Menos idas y vueltas, y sobre todo ningún grant sobre auth.users repartido.

create or replace function public.interview_notice_payload(p_interview uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'interview_id', i.id,
           'company_id',   i.company_id,
           'campaign_id',  i.campaign_id,
           'candidate_id', i.candidate_id,
           'status',       i.status,
           'starts_at',    i.starts_at,
           'ends_at',      i.ends_at,
           'timezone',     i.timezone,
           'mode',         i.mode,
           'location',     i.location_text,
           'meeting_url',  i.meeting_url,
           'interviewer',  i.interviewer,
           'puesto',       c.title,
           'candidato',    coalesce(nullif(btrim(ca.answers ->> 'nombre'), ''), 'el candidato'),
           'host_email',   u.email,
           'host_nombre',  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), ''))
    into v
    from public.interviews i
    join public.campaigns c  on c.id  = i.campaign_id
    join public.candidates ca on ca.id = i.candidate_id
    left join auth.users u on u.id = i.host_user_id
   where i.id = p_interview;
  return v;
end
$$;
revoke all on function public.interview_notice_payload(uuid) from public, anon, authenticated;
grant execute on function public.interview_notice_payload(uuid) to service_role;

-- Cerrar una cita ya pasada. Devuelve si hizo algo, para que el trabajo no
-- mienta al decir que la cerró.
--
-- Nota honesta: 'realizada' aquí significa "ya pasó", no "el candidato vino".
-- No tenemos esa señal. La alternativa (dejarla 'confirmada' para siempre) hace
-- que la agenda mienta en la otra dirección y que el contador nunca baje, que
-- es peor. El empresario puede cancelarla si no se presentó.
create or replace function public.interview_mark_done(p_interview uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.interviews;
begin
  select * into v from public.interviews where id = p_interview for update;
  if not found then return jsonb_build_object('status', 'no_existe'); end if;
  if v.status <> 'confirmada' then
    return jsonb_build_object('status', 'no_procede', 'estado', v.status);
  end if;
  if v.ends_at is null or v.ends_at > now() then
    return jsonb_build_object('status', 'aun_no');
  end if;

  update public.interviews set status = 'realizada' where id = p_interview;

  -- La conversación con el candidato deja de tener agente detrás.
  update public.candidate_conversations
     set agent_state = 'cerrada'
   where interview_id = p_interview and agent_state <> 'cerrada';

  return jsonb_build_object('status', 'ok');
end
$$;
revoke all on function public.interview_mark_done(uuid) from public, anon, authenticated;
grant execute on function public.interview_mark_done(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 8) El latido
-- ----------------------------------------------------------------------------
-- pg_cron llama a la edge function cada minuto. La URL y el secreto salen del
-- vault: dejarlos en claro en `cron.job.command` los deja legibles para
-- cualquiera que pueda mirar el catálogo.
--
-- Ojo con lo que el cron NO puede ser: el único disparador. Hoy todo lo que se
-- encola va programado a futuro (recordatorios, cerrar la cita), así que un
-- minuto de margen sobra. En cuanto entre WhatsApp habrá trabajos que nacen
-- para ahora mismo, y esperar al cron sería pulsar "Invitar" y mirar una
-- pantalla quieta hasta un minuto. Para eso está `interview_tick_kick()`
-- suelta: la llamarán la RPC de invitar y el webhook. Todavía no la llama
-- nadie, y se dice aquí para que no parezca que ya pasa.

create or replace function public.interview_tick_kick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'interview_tick_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'interview_tick_secret';
  -- Sin configurar (local recién levantado, entorno de pruebas): no se hace
  -- nada. Los trabajos esperan en la cola, que es exactamente para lo que está.
  if v_url is null or v_secret is null then return; end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-interview-tick-secret', v_secret),
    body := jsonb_build_object('origen', 'cron'),
    timeout_milliseconds := 5000);
exception when others then
  -- Un latido perdido no puede tumbar nada: al minuto siguiente hay otro.
  raise warning 'interview_tick_kick: %', sqlerrm;
end
$$;
revoke all on function public.interview_tick_kick() from public, anon, authenticated;
-- El webhook y las RPCs de invitar lo llaman para no esperar al cron.
grant execute on function public.interview_tick_kick() to service_role;

-- pg_cron va envuelto: en un `supabase db reset` de una máquina donde la
-- extensión no esté disponible, esto avisa y sigue. Que no se pueda programar
-- el latido no puede impedir crear el esquema.
do $$
begin
  -- pg_net hace la llamada HTTP y pg_cron la programa. Las DOS hacen falta, y
  -- no se pueden dar por hechas: en el proyecto de producción pg_net no estaba
  -- instalada, así que el latido se llamaba a sí mismo, fallaba en silencio por
  -- el `exception` de abajo, y la cola no habría avanzado nunca sola.
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron with schema extensions;
  perform cron.schedule('interview-tick', '* * * * *', 'select public.interview_tick_kick()');
exception when others then
  raise warning 'pg_cron o pg_net no disponibles, el latido queda sin programar: %', sqlerrm;
end
$$;
