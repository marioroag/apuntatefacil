-- ============================================================================
-- Apúntate Fácil: entrevistas
-- ----------------------------------------------------------------------------
-- UNA entrevista es UNA fila de public.interviews, venga de donde venga: creada
-- a mano, conseguida por el agente de WhatsApp o, más adelante, por la
-- publicación multicanal. `origin` es procedencia, no tipo: no cambia ninguna
-- regla. Sistemas paralelos era justo lo que había que evitar.
--
-- Esta migración trae SOLO el dominio y la agenda manual. El canal
-- (conversaciones, mensajes) y la cola de trabajos van en migraciones
-- posteriores y se apoyan en esta sin modificarla.
--
-- Molde: 20260721160000_candidate_interest_checks.sql (RLS por campaign_id,
-- integridad por trigger, grants explícitos) y 20260731120000_candidate_modal.sql
-- (candidate_event_log, broadcast al topic privado 'company:<id>').
--
-- Tres cosas que hay que saber antes de tocar este fichero:
--
--   1) `timestamptz - interval` es STABLE, no IMMUTABLE. El rango con buffer NO
--      puede ser una columna generada: Postgres rechaza la DDL. Va en columna
--      normal rellenada por un trigger BEFORE.
--   2) btree_gist se instala en el esquema `extensions` como el resto, así que
--      el opclass gist_uuid_ops hay que CUALIFICARLO en la constraint: no está
--      en el search_path de la DDL.
--   3) La visibilidad va por campaign_id, no por company_id. Un encargado no
--      puede ver las entrevistas de un puesto de otra sede.
-- ============================================================================

create extension if not exists btree_gist with schema extensions;

-- ----------------------------------------------------------------------------
-- 0) Zona horaria: no existía y hace falta desde el primer día
-- ----------------------------------------------------------------------------
-- Una entrevista es una hora concreta en un sitio concreto. Sin esto, una cita
-- en Las Palmas vista desde Madrid sale una hora mal. La sede manda sobre la
-- empresa porque una ETT peninsular puede tener sede en Canarias.

alter table public.companies
  add column timezone text not null default 'Europe/Madrid'
  check (timezone in ('Europe/Madrid', 'Atlantic/Canary'));

alter table public.sites
  add column timezone text
  check (timezone is null or timezone in ('Europe/Madrid', 'Atlantic/Canary'));

-- ----------------------------------------------------------------------------
-- 1) Gating de plan, en el servidor y fail-closed
-- ----------------------------------------------------------------------------
-- Espejo de PLAN_FEATURES de src/lib/pricing.ts. Cuando se mueva la feature de
-- plan hay que tocar los dos lados (y también supabase/functions/_shared/plans.ts).
-- Es una función y no un literal repetido para que el día que cambie, cambie una vez.

create or replace function public.plan_has_interviews(p_plan text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_plan, '') in ('pro', 'multi')
$$;

-- ----------------------------------------------------------------------------
-- 2) La tabla
-- ----------------------------------------------------------------------------

create table public.interviews (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  campaign_id      uuid not null references public.campaigns(id) on delete cascade,
  candidate_id     uuid not null references public.candidates(id) on delete cascade,
  -- Quien entrevista. En una ETT no tiene por qué ser quien invita: el
  -- reclutador manda la invitación y el encargado de la sede hace la entrevista.
  host_user_id     uuid not null references auth.users(id),
  created_by       uuid references auth.users(id) on delete set null,

  status           text not null default 'invitada' check (status in (
                     'invitada',       -- invitación mandada, sin respuesta
                     'proponiendo',    -- aceptó, huecos ofrecidos
                     'confirmada',     -- hueco reservado
                     'reprogramando',  -- se pidió mover; conserva el hueco viejo
                     'realizada',
                     'cancelada',
                     'rechazada',      -- el candidato dijo que no
                     'sin_respuesta',  -- agotados los avisos
                     'fallida')),      -- no entregable (sin WhatsApp, número inválido)
  origin           text not null default 'manual' check (origin in ('manual', 'whatsapp')),

  starts_at        timestamptz,
  ends_at          timestamptz,
  duration_minutes int not null default 30 check (duration_minutes between 10 and 240),
  -- Descanso entre entrevistas. Entra en el rango bloqueado, no en la duración:
  -- el candidato ve 30 minutos, la agenda reserva 30 + 2 x buffer.
  buffer_minutes   int not null default 0 check (buffer_minutes between 0 and 240),
  blocked_range    tstzrange,   -- lo rellena trg_interviews_range (ver cabecera, punto 1)
  timezone         text not null default 'Europe/Madrid'
                   check (timezone in ('Europe/Madrid', 'Atlantic/Canary')),

  mode             text not null default 'presencial' check (mode in ('presencial', 'videollamada')),
  location_text    text not null default '' check (char_length(location_text) <= 300),
  meeting_url      text check (meeting_url is null or meeting_url ~ '^https://'),

  -- Huecos ofrecidos en la ronda vigente. jsonb y no tabla aparte a propósito:
  -- nunca se consulta por sí solo, siempre a través de la entrevista.
  offered_slots    jsonb not null default '[]'::jsonb
                   check (length(offered_slots::text) <= 8000),
  offer_round      int not null default 0 check (offer_round between 0 and 10),

  calendar_provider   text check (calendar_provider is null or calendar_provider in ('google')),
  calendar_event_id   text,
  calendar_sync_state text not null default 'ninguno' check (calendar_sync_state in (
                        'ninguno', 'pendiente', 'sincronizado', 'fallido', 'borrando')),
  calendar_synced_at  timestamptz,

  cancel_reason    text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  cancelled_by     text check (cancelled_by is null or cancelled_by in ('empresa', 'candidato', 'sistema')),
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Una entrevista confirmada SIEMPRE tiene hora. Lo contrario es un estado
  -- imposible que acabaría pintándose como "confirmada" sin fecha.
  constraint interviews_confirmada_con_hora
    check (status <> 'confirmada' or (starts_at is not null and ends_at is not null)),
  -- Y lo que aún no se ha negociado no puede tenerla.
  constraint interviews_sin_hora_antes_de_elegir
    check (status not in ('invitada', 'proponiendo', 'rechazada', 'sin_respuesta', 'fallida')
           or starts_at is null),
  constraint interviews_rango_valido
    check (starts_at is null or ends_at > starts_at)
);

create index interviews_campaign_idx  on public.interviews(campaign_id, created_at desc);
create index interviews_candidate_idx on public.interviews(candidate_id, created_at desc);
create index interviews_agenda_idx    on public.interviews(company_id, starts_at)
  where status in ('confirmada', 'reprogramando');

-- Un candidato no puede tener dos procesos de entrevista a la vez. Esto es lo
-- que hace que la doble pulsación de "Invitar a entrevista" (o dos personas del
-- equipo invitando al mismo tiempo) no cree dos filas: la segunda inserción
-- choca y el RPC devuelve la que ya había.
create unique index interviews_una_viva_por_candidato
  on public.interviews (candidate_id)
  where status in ('invitada', 'proponiendo', 'confirmada', 'reprogramando');

-- ----------------------------------------------------------------------------
-- 3) Rango bloqueado y anti doble reserva
-- ----------------------------------------------------------------------------

create or replace function public.interviews_fill_range()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.starts_at is null or new.ends_at is null then
    new.blocked_range := null;
  else
    new.blocked_range := tstzrange(
      new.starts_at - make_interval(mins => new.buffer_minutes),
      new.ends_at   + make_interval(mins => new.buffer_minutes),
      '[)');
  end if;
  return new;
end
$$;

create trigger trg_interviews_range
  before insert or update on public.interviews
  for each row execute function public.interviews_fill_range();

-- Dos candidatos que eligen el mismo hueco en el mismo segundo: lo arbitra
-- Postgres, no la aplicación. `reprogramando` entra en la constraint a
-- propósito: mientras se renegocia, el hueco viejo sigue reservado (si lo
-- soltáramos, el peor resultado posible sería perderlo y no conseguir otro).
-- Como es la MISMA fila, confirmar el hueco nuevo no choca consigo misma.
alter table public.interviews add constraint interviews_sin_solape
  exclude using gist (
    host_user_id extensions.gist_uuid_ops with =,
    blocked_range with &&
  ) where (status in ('confirmada', 'reprogramando'));

-- ----------------------------------------------------------------------------
-- 4) Guarda de transiciones
-- ----------------------------------------------------------------------------
-- Este trigger SÍ revienta, al contrario que los de aviso de la casa. Un fallo
-- del historial o del broadcast no puede tumbar la escritura principal; un
-- estado imposible sí tiene que tumbarla.

create or replace function public.interviews_guard_transition()
returns trigger
language plpgsql
as $$
declare
  legales constant jsonb := jsonb_build_object(
    'invitada',      '["proponiendo","rechazada","sin_respuesta","fallida","cancelada"]'::jsonb,
    'proponiendo',   '["confirmada","cancelada","rechazada","sin_respuesta","fallida"]'::jsonb,
    'confirmada',    '["reprogramando","cancelada","realizada"]'::jsonb,
    'reprogramando', '["confirmada","cancelada"]'::jsonb,
    'realizada',     '[]'::jsonb,
    'cancelada',     '[]'::jsonb,
    'rechazada',     '[]'::jsonb,
    'sin_respuesta', '[]'::jsonb,
    'fallida',       '[]'::jsonb
  );
begin
  if new.status = old.status then return new; end if;
  -- Lo terminado no revive, ni siquiera desde service_role. Reabrir un proceso
  -- es crear una entrevista nueva, que además deja rastro en el historial.
  if not (legales -> old.status) ? new.status then
    raise exception 'Transición de entrevista no permitida: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger trg_interviews_guard
  before update of status on public.interviews
  for each row execute function public.interviews_guard_transition();

-- ----------------------------------------------------------------------------
-- 5) Historial y aviso en vivo
-- ----------------------------------------------------------------------------

-- No se puede "añadir un valor" a un CHECK: hay que sustituirlo.
alter table public.candidate_events drop constraint candidate_events_kind_check;
alter table public.candidate_events add constraint candidate_events_kind_check
  check (kind in (
    'recibida', 'analisis', 'estado', 'favorito', 'interes_enviada', 'interes_respuesta',
    'entrevista_invitada', 'entrevista_confirmada', 'entrevista_reprogramada',
    'entrevista_cancelada', 'entrevista_realizada', 'entrevista_sin_respuesta'));

-- El TEXTO se compone en el cliente (eventoTexto), como el resto del historial:
-- así se usan las etiquetas reales sin migrar filas cuando cambie el copy.
create or replace function public.interviews_event_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_kind := case when new.status = 'confirmada'
                   then 'entrevista_confirmada' else 'entrevista_invitada' end;
  elsif new.status is distinct from old.status then
    v_kind := case new.status
                when 'confirmada'    then 'entrevista_confirmada'
                when 'reprogramando' then 'entrevista_reprogramada'
                when 'cancelada'     then 'entrevista_cancelada'
                when 'rechazada'     then 'entrevista_cancelada'
                when 'realizada'     then 'entrevista_realizada'
                when 'sin_respuesta' then 'entrevista_sin_respuesta'
                when 'fallida'       then 'entrevista_sin_respuesta'
                else null end;
  -- Cambiar la hora de una confirmada es reprogramar, aunque el estado no se mueva.
  elsif new.starts_at is distinct from old.starts_at and new.status = 'confirmada' then
    v_kind := 'entrevista_reprogramada';
  end if;

  if v_kind is null then return new; end if;

  perform public.candidate_event_log(
    new.candidate_id, new.company_id, v_kind,
    jsonb_build_object(
      'interview_id', new.id,
      'starts_at', new.starts_at,
      -- La zona viaja con el evento: el historial tiene que decir la hora de la
      -- entrevista, no la del navegador de quien lo lee.
      'timezone', new.timezone,
      'mode', new.mode,
      'origin', new.origin));
  return new;
exception when others then
  return new;   -- el historial nunca puede impedir que se agende una entrevista
end
$$;

create trigger trg_interviews_event
  after insert or update on public.interviews
  for each row execute function public.interviews_event_log();

-- Quinto evento del canal privado que ya existe. Sin PII en el payload: solo
-- ids, para que un panel abierto sepa que tiene que recargar.
create or replace function public.broadcast_interview()
returns trigger
language plpgsql
security definer        -- authenticated no tiene privilegios sobre realtime
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'campaign_id', new.campaign_id,
      'candidate_id', new.candidate_id,
      'status', new.status,
      'by', auth.uid()),   -- para no repintar lo que acabas de hacer tú
    'interview_ping',
    'company:' || new.company_id::text,
    true);
  return new;
exception when others then
  return new;
end
$$;

create trigger trg_interviews_broadcast
  after insert or update on public.interviews
  for each row execute function public.broadcast_interview();

-- ----------------------------------------------------------------------------
-- 6) RLS
-- ----------------------------------------------------------------------------

alter table public.interviews enable row level security;

-- Por campaign_id, NO por company_id: un encargado solo ve las entrevistas de
-- los puestos de sus sedes.
create policy "interviews_select" on public.interviews
  for select to authenticated
  using (campaign_id in (select public.current_user_campaign_ids()));

-- Sin policies de insert, update ni delete. Toda escritura pasa por los RPC de
-- abajo, que es donde viven el gating de plan, la comprobación de puesto activo
-- y la absorción del choque de huecos. Un cliente no puede saltárselos.

-- ----------------------------------------------------------------------------
-- 7) Grants (explícitos: aquí nadie hereda, tampoco service_role)
-- ----------------------------------------------------------------------------

revoke all on public.interviews from anon, authenticated, public;
grant select on public.interviews to authenticated;
grant select, insert, update, delete on public.interviews to service_role;

-- ----------------------------------------------------------------------------
-- 8) RPCs de escritura
-- ----------------------------------------------------------------------------

-- Contexto de un candidato, ya autorizado. Centraliza las cuatro comprobaciones
-- que TODA escritura de entrevista tiene que hacer, para que ninguna se olvide
-- de una: visible para este usuario, no bloqueado por el tope del plan de
-- prueba, plan con entrevistas, y puesto activo.
create or replace function public.interview_candidate_context(p_candidate uuid)
returns table (
  company_id uuid, campaign_id uuid, tz text,
  campaign_status text, plan_ok boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_id, c.campaign_id,
         coalesce(s.timezone, co.timezone, 'Europe/Madrid'),
         ca.status,
         public.plan_has_interviews(co.plan)
    from public.candidates c
    join public.companies co on co.id = c.company_id
    join public.campaigns ca on ca.id = c.campaign_id
    left join public.sites s on s.id = ca.site_id
   where c.id = p_candidate
     and not c.locked
     -- current_user_campaign_ids() es definer y usa auth.uid(), así que sigue
     -- siendo el filtro correcto dentro de otra función definer.
     and c.campaign_id in (select public.current_user_campaign_ids())
$$;
revoke all on function public.interview_candidate_context(uuid) from public, anon;
grant execute on function public.interview_candidate_context(uuid) to authenticated;

-- Confirmar una entrevista mueve el candidato a 'entrevista', pero SOLO hacia
-- delante. Nunca pisa 'contratado' ni 'descartado': eso son decisiones de una
-- persona, y el agente no toma decisiones de contratación.
create or replace function public.interview_sync_candidate_status(p_candidate uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.candidates
     set status = 'entrevista'
   where id = p_candidate
     and status in ('nuevo', 'contactado');
exception when others then
  return;
end
$$;
revoke all on function public.interview_sync_candidate_status(uuid) from public, anon, authenticated;

-- Agenda una entrevista a mano. Devuelve {status: ok|ocupado|...} en vez de
-- lanzar: un choque de huecos es un caso normal de la interfaz, no un error.
-- p_starts_local ("2026-08-02T10:00") es la vía preferente desde la interfaz: es
-- hora de PARED y la interpreta el servidor en la zona del puesto, que es quien
-- la conoce. Si el cliente la convirtiera, usaría la zona de SU navegador y
-- quien agenda desde Madrid una cita en Canarias la pondría una hora tarde.
-- p_starts_at sigue existiendo para quien ya tenga el instante exacto.
create or replace function public.create_manual_interview(
  p_candidate  uuid,
  p_starts_at  timestamptz default null,
  p_host       uuid    default null,
  p_duration   int     default 30,
  p_buffer     int     default 0,
  p_mode       text    default 'presencial',
  p_location   text    default '',
  p_meeting_url text   default null,
  p_starts_local text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.interviews;
  v_ctx record;
  v_host uuid := coalesce(p_host, auth.uid());
  v_starts timestamptz;
begin
  select * into v_ctx from public.interview_candidate_context(p_candidate);
  -- `not found` y no `v_ctx is null`: un record solo es NULL si TODOS sus
  -- campos lo son, así que la comprobación ingenua dejaría pasar filas parciales.
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not v_ctx.plan_ok then return jsonb_build_object('status', 'plan'); end if;
  if v_ctx.campaign_status <> 'activa' then return jsonb_build_object('status', 'puesto_inactivo'); end if;

  if p_starts_local is not null and btrim(p_starts_local) <> '' then
    begin
      -- `timestamp at time zone <zona>` va de hora de pared a instante. Es la
      -- dirección contraria a la de `timestamptz at time zone`, que confunde
      -- siempre: aquí la entrada NO tiene zona y se le está poniendo una.
      v_starts := (replace(btrim(p_starts_local), 'T', ' '))::timestamp at time zone v_ctx.tz;
    exception when others then
      return jsonb_build_object('status', 'fecha_no_valida');
    end;
  else
    v_starts := p_starts_at;
  end if;
  if v_starts is null then return jsonb_build_object('status', 'fecha_no_valida'); end if;

  -- El anfitrión tiene que ser del equipo: si no, se reservaría la agenda de
  -- alguien de otra empresa (y la constraint de solape mira por host_user_id).
  if not exists (
    select 1 from public.memberships m
     where m.user_id = v_host and m.company_id = v_ctx.company_id
  ) then raise exception 'El anfitrión no es del equipo' using errcode = '42501'; end if;

  begin
    insert into public.interviews (
      company_id, campaign_id, candidate_id, host_user_id, created_by,
      status, origin, starts_at, ends_at, duration_minutes, buffer_minutes,
      timezone, mode, location_text, meeting_url, confirmed_at)
    values (
      v_ctx.company_id, v_ctx.campaign_id, p_candidate, v_host, auth.uid(),
      'confirmada', 'manual',
      v_starts, v_starts + make_interval(mins => p_duration), p_duration, p_buffer,
      v_ctx.tz, p_mode, coalesce(p_location, ''), p_meeting_url, now())
    returning * into v;
  exception
    when exclusion_violation then
      return jsonb_build_object('status', 'ocupado');
    when unique_violation then
      -- Ya hay un proceso de entrevista vivo para este candidato.
      select * into v from public.interviews
       where candidate_id = p_candidate
         and status in ('invitada', 'proponiendo', 'confirmada', 'reprogramando');
      return jsonb_build_object('status', 'ya_existe', 'interview_id', v.id);
  end;

  perform public.interview_sync_candidate_status(p_candidate);
  return jsonb_build_object('status', 'ok', 'interview_id', v.id);
end
$$;
revoke all on function public.create_manual_interview(uuid, timestamptz, uuid, int, int, text, text, text, text)
  from public, anon;
grant execute on function public.create_manual_interview(uuid, timestamptz, uuid, int, int, text, text, text, text)
  to authenticated;

create or replace function public.cancel_interview(p_interview uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v public.interviews;
begin
  select * into v from public.interviews
   where id = p_interview
     and campaign_id in (select public.current_user_campaign_ids())
   for update;
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
  if v.status in ('realizada', 'cancelada', 'rechazada', 'sin_respuesta', 'fallida') then
    return jsonb_build_object('status', 'ya_cerrada', 'estado', v.status);
  end if;

  update public.interviews
     set status = 'cancelada',
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         cancelled_by = 'empresa',
         calendar_sync_state = case when calendar_event_id is null then 'ninguno' else 'borrando' end
   where id = p_interview;

  -- El estado del candidato NO se revierte: si vuelve a 'nuevo' se pierde que
  -- ya hubo contacto. Que lo decida una persona.
  return jsonb_build_object('status', 'ok');
end
$$;
revoke all on function public.cancel_interview(uuid, text) from public, anon;
grant execute on function public.cancel_interview(uuid, text) to authenticated;

-- Mover una entrevista a mano: misma fila, hora nueva. El estado no se toca, así
-- que la guarda de transiciones ni se entera; lo que sí actúa es la constraint
-- de solape, que puede devolver 'ocupado'.
create or replace function public.reschedule_interview(
  p_interview uuid, p_starts_at timestamptz, p_duration int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.interviews;
  v_dur int;
begin
  select * into v from public.interviews
   where id = p_interview
     and campaign_id in (select public.current_user_campaign_ids())
   for update;
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
  if v.status not in ('confirmada', 'reprogramando') then
    return jsonb_build_object('status', 'estado_no_valido', 'estado', v.status);
  end if;
  if p_starts_at is null then raise exception 'Falta la fecha'; end if;
  v_dur := coalesce(p_duration, v.duration_minutes);

  begin
    update public.interviews
       set status = 'confirmada',
           starts_at = p_starts_at,
           ends_at = p_starts_at + make_interval(mins => v_dur),
           duration_minutes = v_dur,
           calendar_sync_state = case when calendar_event_id is null then calendar_sync_state
                                      else 'pendiente' end
     where id = p_interview;
  exception when exclusion_violation then
    return jsonb_build_object('status', 'ocupado');
  end;

  return jsonb_build_object('status', 'ok');
end
$$;
revoke all on function public.reschedule_interview(uuid, timestamptz, int) from public, anon;
grant execute on function public.reschedule_interview(uuid, timestamptz, int) to authenticated;

-- ----------------------------------------------------------------------------
-- 9) Puesto pausado o cerrado con entrevistas vivas
-- ----------------------------------------------------------------------------
-- No se cancela nada solo: una entrevista confirmada es un compromiso con una
-- persona. Aquí solo se deja constancia; el aviso al empresario y la parada del
-- agente llegan con la cola de trabajos.

create or replace function public.interviews_on_campaign_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'activa' or new.status is not distinct from old.status then
    return new;
  end if;
  insert into public.candidate_events (candidate_id, company_id, actor_email, kind, details)
  select i.candidate_id, i.company_id, '', 'entrevista_cancelada',
         jsonb_build_object('interview_id', i.id, 'motivo', 'puesto_' || new.status)
    from public.interviews i
   where i.campaign_id = new.id
     and i.status in ('invitada', 'proponiendo', 'confirmada', 'reprogramando');
  return new;
exception when others then
  return new;
end
$$;

create trigger trg_campaigns_interviews_status
  after update of status on public.campaigns
  for each row execute function public.interviews_on_campaign_status();

-- ----------------------------------------------------------------------------
-- 10) Lectura para el panel
-- ----------------------------------------------------------------------------
-- security invoker a propósito: que la RLS de interviews y de candidates apliquen
-- solas, como en candidate_interest_overview_for_company. Devuelve lo justo para
-- pintar la agenda sin traerse la candidatura entera.

create or replace function public.interview_overview_for_company(p_company uuid)
returns table (
  id uuid, campaign_id uuid, candidate_id uuid, host_user_id uuid,
  status text, origin text, starts_at timestamptz, ends_at timestamptz,
  timezone text, mode text, location_text text, meeting_url text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.id, i.campaign_id, i.candidate_id, i.host_user_id,
         i.status, i.origin, i.starts_at, i.ends_at,
         i.timezone, i.mode, i.location_text, i.meeting_url, i.created_at
    from public.interviews i
   where i.company_id = p_company
   order by i.starts_at nulls last, i.created_at desc
$$;
revoke all on function public.interview_overview_for_company(uuid) from public, anon;
grant execute on function public.interview_overview_for_company(uuid) to authenticated;
