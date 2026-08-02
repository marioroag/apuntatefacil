-- ============================================================================
-- Apúntate Fácil: disponibilidad del entrevistador
-- ----------------------------------------------------------------------------
-- La disponibilidad es NUESTRA, no de Google. El agente propone horarios a
-- partir de estas reglas, y un calendario externo (cuando se conecte) solo
-- RESTA lo que ya está ocupado. Así la funcionalidad entera funciona sin que
-- nadie conecte nada, que era la condición de partida.
--
-- Una fila por (empresa, persona): en una ETT el reclutador invita pero
-- entrevista el encargado de la sede, y cada uno tiene su horario.
-- ============================================================================

create table public.interview_hosts (
  company_id       uuid not null references public.companies(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  timezone         text not null default 'Europe/Madrid'
                   check (timezone in ('Europe/Madrid', 'Atlantic/Canary')),
  duration_minutes int  not null default 30 check (duration_minutes between 10 and 240),
  -- Descanso entre entrevistas. Entra en el rango que se bloquea, no en lo que
  -- ve el candidato.
  buffer_minutes   int  not null default 15 check (buffer_minutes between 0 and 120),
  -- Cuánto tiempo mínimo tiene que faltar. Sin esto se ofrecen huecos para
  -- dentro de diez minutos y nadie llega.
  min_notice_hours int  not null default 4  check (min_notice_hours between 0 and 168),
  horizon_days     int  not null default 10 check (horizon_days between 1 and 60),
  max_per_day      int  not null default 4  check (max_per_day between 1 and 20),
  granularity_min  int  not null default 30 check (granularity_min in (15, 30, 60)),
  default_mode     text not null default 'presencial'
                   check (default_mode in ('presencial', 'videollamada')),
  default_location text not null default '' check (char_length(default_location) <= 300),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table public.interview_availability (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id    uuid not null,
  weekday    int  not null check (weekday between 0 and 6),  -- 0 = domingo
  start_min  int  not null check (start_min between 0 and 1439),
  end_min    int  not null check (end_min between 1 and 1440),
  check (end_min > start_min),
  foreign key (company_id, user_id)
    references public.interview_hosts(company_id, user_id) on delete cascade
);
create index interview_availability_host_idx
  on public.interview_availability(company_id, user_id, weekday);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
-- Se LEE la de todo el equipo (hace falta para elegir quién entrevista) pero
-- cada uno solo ESCRIBE la suya: el horario de una persona no lo cambia otra.

alter table public.interview_hosts enable row level security;
alter table public.interview_availability enable row level security;

create policy "hosts_select" on public.interview_hosts
  for select to authenticated
  using (company_id in (select public.current_user_company_ids()));
create policy "hosts_write_own" on public.interview_hosts
  for all to authenticated
  using (user_id = auth.uid() and company_id in (select public.current_user_company_ids()))
  with check (user_id = auth.uid() and company_id in (select public.current_user_company_ids()));

create policy "availability_select" on public.interview_availability
  for select to authenticated
  using (company_id in (select public.current_user_company_ids()));
create policy "availability_write_own" on public.interview_availability
  for all to authenticated
  using (user_id = auth.uid() and company_id in (select public.current_user_company_ids()))
  with check (user_id = auth.uid() and company_id in (select public.current_user_company_ids()));

revoke all on public.interview_hosts, public.interview_availability
  from anon, authenticated, public;
grant select, insert, update, delete on public.interview_hosts to authenticated;
grant select, insert, update, delete on public.interview_availability to authenticated;
-- El generador de huecos corre en el servidor y lee las dos.
grant select on public.interview_hosts, public.interview_availability to service_role;

-- ----------------------------------------------------------------------------
-- Alta con valores por defecto
-- ----------------------------------------------------------------------------
-- Nadie debería tener que configurar nada para poder invitar. La primera vez
-- que se pide la disponibilidad de alguien, se le crea con un horario de
-- oficina normal (L-V, 9:00 a 18:00), que es lo que la ficha ya anuncia antes
-- de enviar. Configurarlo es AJUSTAR algo que ya funciona, no rellenar un
-- formulario vacío para empezar.

create or replace function public.ensure_interview_host(p_company uuid, p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_tz text;
begin
  if not exists (
    select 1 from public.memberships m where m.user_id = v_user and m.company_id = p_company
  ) then raise exception 'No autorizado' using errcode = '42501'; end if;

  select timezone into v_tz from public.companies where id = p_company;

  insert into public.interview_hosts (company_id, user_id, timezone)
  values (p_company, v_user, coalesce(v_tz, 'Europe/Madrid'))
  on conflict (company_id, user_id) do nothing;

  -- Solo si no tiene NINGUNA regla: quien se haya quedado adrede sin horario
  -- (por ejemplo mientras reorganiza su semana) no debe encontrárselo repuesto.
  if not exists (
    select 1 from public.interview_availability
     where company_id = p_company and user_id = v_user
  ) then
    insert into public.interview_availability (company_id, user_id, weekday, start_min, end_min)
    select p_company, v_user, d, 9 * 60, 18 * 60 from generate_series(1, 5) d;
  end if;
end
$$;
revoke all on function public.ensure_interview_host(uuid, uuid) from public, anon;
grant execute on function public.ensure_interview_host(uuid, uuid) to authenticated;

-- Sustituye el horario semanal de una persona de una vez. Reemplazar entero y
-- no ir fila a fila evita el estado intermedio en el que el agente vería media
-- semana configurada y propondría horarios que no son.
create or replace function public.set_interview_availability(
  p_company uuid,
  p_reglas  jsonb   -- [{"weekday":1,"start_min":540,"end_min":1080}, ...]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user uuid := auth.uid(); v_n int;
begin
  perform public.ensure_interview_host(p_company, v_user);

  if jsonb_typeof(p_reglas) <> 'array' then raise exception 'Reglas no válidas'; end if;
  if jsonb_array_length(p_reglas) > 40 then raise exception 'Demasiados tramos'; end if;

  delete from public.interview_availability
   where company_id = p_company and user_id = v_user;

  insert into public.interview_availability (company_id, user_id, weekday, start_min, end_min)
  select p_company, v_user,
         (r ->> 'weekday')::int, (r ->> 'start_min')::int, (r ->> 'end_min')::int
    from jsonb_array_elements(p_reglas) r;

  select count(*) into v_n from public.interview_availability
   where company_id = p_company and user_id = v_user;
  return jsonb_build_object('status', 'ok', 'tramos', v_n);
end
$$;
revoke all on function public.set_interview_availability(uuid, jsonb) from public, anon;
grant execute on function public.set_interview_availability(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- Lo que necesita el generador de huecos, en una sola llamada
-- ----------------------------------------------------------------------------
-- security definer y no invoker: la llama el servidor con service_role para
-- montar la oferta, y también la interfaz para la vista previa. La
-- autorización se comprueba aquí dentro contra la pertenencia al equipo.

create or replace function public.interview_host_config(p_company uuid, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_host public.interview_hosts; v_reglas jsonb;
begin
  select * into v_host from public.interview_hosts
   where company_id = p_company and user_id = p_user;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'weekday', weekday, 'startMin', start_min, 'endMin', end_min) order by weekday, start_min), '[]'::jsonb)
    into v_reglas
    from public.interview_availability
   where company_id = p_company and user_id = p_user;

  return jsonb_build_object(
    'timezone', v_host.timezone,
    'durMin', v_host.duration_minutes,
    'bufferMin', v_host.buffer_minutes,
    'minNoticeHoras', v_host.min_notice_hours,
    'horizonteDias', v_host.horizon_days,
    'maxPorDia', v_host.max_per_day,
    'granularidadMin', v_host.granularity_min,
    'defaultMode', v_host.default_mode,
    'defaultLocation', v_host.default_location,
    'reglas', v_reglas);
end
$$;
revoke all on function public.interview_host_config(uuid, uuid) from public, anon;
grant execute on function public.interview_host_config(uuid, uuid) to authenticated, service_role;

-- Entrevistas ya comprometidas de un anfitrión, para restarlas al generar. Se
-- devuelve el rango CON buffer ya aplicado (blocked_range), que es exactamente
-- lo que la constraint de exclusión considera ocupado. Si aquí se usara
-- starts_at/ends_at a secas, el generador ofrecería huecos que luego la base
-- rechazaría al reservar.
create or replace function public.interview_busy(p_host uuid, p_desde timestamptz, p_hasta timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select lower(blocked_range), upper(blocked_range)
    from public.interviews
   where host_user_id = p_host
     and status in ('confirmada', 'reprogramando')
     and blocked_range && tstzrange(p_desde, p_hasta, '[)')
$$;
revoke all on function public.interview_busy(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.interview_busy(uuid, timestamptz, timestamptz) to authenticated, service_role;
