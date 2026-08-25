-- ============================================================================
-- Apúntate Fácil · PAGO POR PROCESO ABIERTO (Mario, ago 2026)
--
-- Sustituye a los tres planes por tiers (Esencial/Pro/Multi) como modelo de
-- venta. El modelo nuevo:
--
--  - 49 €/mes + IVA por proceso ABIERTO (status <> 'cerrada'; pausar detiene el
--    enlace pero el proceso sigue abierto y cobrándose). Todos los procesos al
--    mismo precio. Stripe Billing con UNA suscripción por empresa y cantidad =
--    nº de procesos abiertos (STRIPE_PRICE_PROCESO).
--  - TODO el producto incluido para todo el mundo: se cobra por escala real
--    (procesos), nunca por capacidades. Los gates de feature por plan se abren.
--  - Prueba: el primer proceso es gratis 15 días o hasta 25 candidaturas
--    visibles, lo que llegue antes. El reloj arranca al abrir el primer
--    proceso. Al agotarse (por días o por cupo) se SIGUE recopilando y las
--    candidaturas nuevas entran bloqueadas (mecanismo `locked` de
--    20260707180000), hasta añadir el método de pago. Una prueba por empresa:
--    el plan nunca vuelve a 'trial'.
--  - Cerrar es un clic y deja de cobrarse (mes empezado, mes cobrado: sin
--    devolución parcial). El proceso cerrado no acepta candidaturas pero se
--    conserva entero y exportable. `paid_until` (lo escribe la edge function
--    de facturación al cerrar) marca hasta cuándo está pagado su ciclo:
--    reabrirlo antes de esa fecha es gratis (anti-truco de cerrar y reabrir).
--
-- El plan nuevo es 'proceso' y su tope real es companies.paid_processes (los
-- procesos pagados en Stripe; lo escriben SOLO las funciones de confianza).
-- Los tiers viejos quedan como planes legacy mientras duren sus suscripciones:
-- conservan sus límites de procesos, pero ganan todas las features.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Columnas nuevas
-- ----------------------------------------------------------------------------

alter table public.companies drop constraint if exists companies_plan_check;
alter table public.companies
  add constraint companies_plan_check check (plan in ('trial','esencial','pro','multi','proceso'));

-- Fin de la prueba (null = el reloj aún no ha arrancado). Lo fija el trigger
-- start_trial_clock al crear el primer puesto; solo lo escribe el servidor.
alter table public.companies add column if not exists trial_ends_at timestamptz;

-- Procesos pagados en Stripe (la cantidad de la suscripción). Es el tope de
-- procesos abiertos del plan 'proceso'. Lo escriben la edge function de
-- facturación y el webhook (service_role); nunca el JWT del usuario.
alter table public.companies add column if not exists paid_processes integer not null default 0;

-- Cuándo se cerró el puesto (lo estampa el trigger de abajo) y hasta cuándo
-- está pagado su ciclo (lo escribe la edge function al cerrar). paid_until en
-- el futuro = reabrir es gratis hasta esa fecha.
alter table public.campaigns add column if not exists closed_at timestamptz;
alter table public.campaigns add column if not exists paid_until timestamptz;

-- ----------------------------------------------------------------------------
-- 2) Grants. `paid_until` decide si una reapertura es GRATIS, así que no puede
-- ser escribible por el cliente: el grant de UPDATE sobre campaigns era de
-- tabla entera (init.sql) y pasa a ser por columnas, como el de companies desde
-- el endurecimiento de facturación (20260706160000). La lista es exactamente lo
-- que escribe el cliente hoy (store.updateCampaign/updateFields/updateBranding).
-- ----------------------------------------------------------------------------

revoke update on public.campaigns from authenticated;
grant update (title, sector, location, status, milanuncios_url, fields, branding,
              site_id, brand_id, notify_new, share_reply)
  on public.campaigns to authenticated;

-- La edge function de facturación cierra/reabre puestos y escribe su ciclo.
-- En este backend service_role NO hereda permisos: grants explícitos.
grant update (status, closed_at, paid_until) on public.campaigns to service_role;

-- ----------------------------------------------------------------------------
-- 3) Topes por plan
-- ----------------------------------------------------------------------------

-- 'proceso' no tiene tope por plan: su tope real es paid_processes (lo aplica
-- enforce_process_limit leyendo la empresa). Devolver "ilimitado" aquí evita
-- que cualquier caller antiguo que consulte esta función pause puestos por el
-- `else 0` al ver un plan que no conocía.
create or replace function public.plan_process_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'trial' then 1
    when 'proceso' then 2147483647 -- el tope real es companies.paid_processes
    when 'esencial' then 2
    when 'pro' then 10
    when 'multi' then 2147483647   -- "ilimitado"
    else 0                         -- plan desconocido: sin procesos
  end
$$;

-- La prueba pasa de 15 a 25 candidaturas visibles (espejo: PRUEBA_CANDIDATOS
-- en src/lib/pricing.ts). El resto sigue sin tope.
create or replace function public.plan_candidate_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'trial' then 25
    else 2147483647   -- "ilimitado"
  end
$$;

-- Marcas: con el pago por proceso no hay tier que venda "varias marcas"; una
-- empresa que paga puede tener las que su operación pida (caso ETT/cadena).
-- La prueba se queda con una (su identidad de casa). Los tiers legacy, igual.
create or replace function public.plan_brand_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'proceso' then 2147483647
    when 'multi' then 2147483647
    else 1
  end
$$;

-- Entrevistas: incluidas para todos los planes conocidos (todo el producto
-- está incluido; el control de coste del canal es el tope de la prueba y la
-- bandera WHATSAPP_LISTO). Sigue fail-closed para planes desconocidos.
create or replace function public.plan_has_interviews(p_plan text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_plan, '') in ('trial', 'proceso', 'esencial', 'pro', 'multi')
$$;

-- ----------------------------------------------------------------------------
-- 4) Tope de procesos abiertos. Para 'proceso', abierto = activa O pausada
-- (los dos se cobran) y el tope es paid_processes. Para trial y los tiers
-- legacy se conserva la semántica de siempre (cuenta solo 'activa'; pausar
-- libera cupo), porque su contrato era ese.
-- ----------------------------------------------------------------------------

create or replace function public.enforce_process_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_paid integer;
  v_limit integer;
  v_count integer;
begin
  if new.status = 'cerrada' then
    return new; -- cerrar nunca se bloquea
  end if;
  select plan, paid_processes into v_plan, v_paid
    from public.companies where id = new.company_id;

  if v_plan = 'proceso' then
    -- Solo consume hueco lo que se ABRE: un insert abierto o salir de 'cerrada'.
    if tg_op = 'UPDATE' and old.status <> 'cerrada' then
      return new; -- activa <-> pausada: sigue abierto, mismo hueco
    end if;
    select count(*) into v_count
      from public.campaigns
      where company_id = new.company_id and status <> 'cerrada' and id <> new.id;
    if v_count >= v_paid then
      raise exception 'PLAN_LIMIT_REACHED'
        using errcode = 'P0001',
              hint = 'Abrir otro proceso son 49 €/mes. Añádelo desde el panel.';
    end if;
    return new;
  end if;

  -- Trial y tiers legacy: semántica original (solo 'activa' consume cupo).
  if new.status <> 'activa' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'activa' then
    return new;
  end if;
  v_limit := public.plan_process_limit(v_plan);
  select count(*) into v_count
    from public.campaigns
    where company_id = new.company_id and status = 'activa' and id <> new.id;
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = 'Pausa o cierra un puesto activo, o añade tu método de pago.';
  end if;
  return new;
end
$$;

-- ----------------------------------------------------------------------------
-- 5) El reloj de la prueba arranca al abrir el PRIMER proceso (no al crear la
-- cuenta: una cuenta que aún no ha publicado no ha empezado a probar nada).
-- Solo arranca una vez y solo en 'trial': una prueba por empresa.
-- ----------------------------------------------------------------------------

create or replace function public.start_trial_clock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.companies
     set trial_ends_at = now() + interval '15 days'
   where id = new.company_id and plan = 'trial' and trial_ends_at is null;
  return new;
end
$$;

drop trigger if exists trg_start_trial_clock on public.campaigns;
create trigger trg_start_trial_clock
  after insert on public.campaigns
  for each row execute function public.start_trial_clock();

-- ----------------------------------------------------------------------------
-- 6) Estampar el cierre. closed_at lo pone el servidor al pasar a 'cerrada' y
-- se limpia al reabrir (paid_until se queda: es la memoria de qué ciclo se
-- pagó, y la edge function lo limpia cuando deja de valer).
-- ----------------------------------------------------------------------------

create or replace function public.stamp_campaign_closed()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cerrada' and old.status <> 'cerrada' then
    new.closed_at := now();
  elsif new.status <> 'cerrada' and old.status = 'cerrada' then
    new.closed_at := null;
  end if;
  return new;
end
$$;

drop trigger if exists trg_stamp_campaign_closed on public.campaigns;
create trigger trg_stamp_campaign_closed
  before update of status on public.campaigns
  for each row execute function public.stamp_campaign_closed();

-- ----------------------------------------------------------------------------
-- 7) Bloqueo de candidaturas en la prueba: por CUPO (25 visibles) o por TIEMPO
-- (prueba caducada). Igual que antes, se sigue recopilando: lo bloqueado se
-- desbloquea entero al pagar. Los planes de pago nunca bloquean.
-- ----------------------------------------------------------------------------

create or replace function public.enforce_candidate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_plan text;
  v_trial_ends timestamptz;
  v_limit integer;
  v_count integer;
begin
  select co.id, co.plan, co.trial_ends_at into v_company, v_plan, v_trial_ends
    from public.campaigns c
    join public.companies co on co.id = c.company_id
    where c.id = new.campaign_id;
  if v_company is null then
    return new; -- el trigger de integridad ya valida que el puesto exista
  end if;
  if v_plan <> 'trial' then
    return new; -- solo la prueba bloquea
  end if;
  -- Serializa los envíos simultáneos de la MISMA empresa para que el cupo sea exacto.
  perform pg_advisory_xact_lock(hashtext(v_company::text));
  v_limit := public.plan_candidate_limit(v_plan);
  select count(*) into v_count
    from public.candidates where company_id = v_company and not locked;
  new.locked := (v_count >= v_limit)
    or (v_trial_ends is not null and now() > v_trial_ends);
  return new;
end
$$;

-- ----------------------------------------------------------------------------
-- 8) Reconciliación al cambiar de plan. Al pasar a 'proceso' (añadir el método
-- de pago) se desbloquea TODO lo recopilado; el tope de abiertos ya lo aplica
-- paid_processes, así que aquí no se pausa ni reactiva nada. Los movimientos
-- entre tiers legacy conservan su comportamiento de siempre.
-- ----------------------------------------------------------------------------

create or replace function public.sync_campaigns_to_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_active integer;
begin
  if new.plan is not distinct from old.plan then
    return new;
  end if;

  if new.plan = 'proceso' then
    -- Al pagar, se ve TODO lo recopilado durante la prueba.
    update public.candidates set locked = false
      where company_id = new.id and locked;
    return new;
  end if;

  v_limit := public.plan_process_limit(new.plan);

  if old.plan = 'trial' and new.plan <> 'trial' then
    update public.candidates set locked = false
      where company_id = new.id and locked;
    select count(*) into v_active
      from public.campaigns where company_id = new.id and status = 'activa';
    update public.campaigns set status = 'activa'
    where id in (
      select id from public.campaigns
      where company_id = new.id and status = 'pausada'
      order by created_at asc
      limit greatest(v_limit - v_active, 0)
    );
  end if;

  select count(*) into v_active
    from public.campaigns where company_id = new.id and status = 'activa';
  if v_active > v_limit then
    update public.campaigns set status = 'pausada'
    where id in (
      select c.id from public.campaigns c
      where c.company_id = new.id and c.status = 'activa'
      order by (select count(*) from public.candidates ca where ca.campaign_id = c.id) asc,
               c.created_at asc
      limit (v_active - v_limit)
    );
    update public.companies set downgrade_reconcile_at = now() where id = new.id;
  end if;

  return new;
end
$$;

-- ----------------------------------------------------------------------------
-- 9) my_companies arma el objeto CAMPO A CAMPO: sin esto, las columnas nuevas
-- nunca llegan al cliente y la prueba/facturación parecerían no existir.
-- ----------------------------------------------------------------------------

create or replace function public.my_companies()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'accent', c.accent,
    'plan', c.plan,
    'subscription_status', c.subscription_status,
    'billing_interval', c.billing_interval,
    'cancel_at_period_end', c.cancel_at_period_end,
    'onboarding_done_at', c.onboarding_done_at,
    'downgrade_reconcile_at', c.downgrade_reconcile_at,
    'meridian_auto', c.meridian_auto,
    'trial_ends_at', c.trial_ends_at,
    'paid_processes', c.paid_processes,
    'role', m.role
  ) order by c.created_at asc), '[]'::jsonb)
  from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 10) admin_overview: el plan 'proceso' entra en el desglose y el MRR exacto
-- del pago por proceso se calcula con la SUMA de procesos pagados (contar
-- empresas se quedaría corto: una empresa puede pagar varios procesos).
-- ----------------------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v jsonb;
begin
  if not public.is_support_staff() then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'accounts', jsonb_build_object(
      'companies', (select count(*) from public.companies),
      'users', (select count(*) from auth.users),
      'new_companies_7d', (select count(*) from public.companies where created_at >= now() - interval '7 days'),
      'new_companies_30d', (select count(*) from public.companies where created_at >= now() - interval '30 days')
    ),
    -- Empresas por plan (incluye trial). Siempre las 5 claves, aunque alguna sea 0.
    'plans', jsonb_build_object(
      'trial', (select count(*) from public.companies where plan = 'trial'),
      'proceso', (select count(*) from public.companies where plan = 'proceso'),
      'esencial', (select count(*) from public.companies where plan = 'esencial'),
      'pro', (select count(*) from public.companies where plan = 'pro'),
      'multi', (select count(*) from public.companies where plan = 'multi')
    ),
    'subscriptions', jsonb_build_object(
      -- "Activas de pago": con algo que cobrar de verdad (procesos pagados, o
      -- un tier antiguo). Una empresa 'proceso' con 0 pagados no es de pago.
      'active_paid', (
        select count(*) from public.companies
        where (plan = 'proceso' and paid_processes > 0)
           or plan in ('esencial', 'pro', 'multi')
      ),
      -- Procesos pagados en total: el MRR del pago por proceso es esto x 49.
      'paid_processes', (select coalesce(sum(paid_processes), 0) from public.companies where plan = 'proceso'),
      'by_plan_interval', coalesce((
        select jsonb_agg(jsonb_build_object('plan', plan, 'interval', coalesce(billing_interval, 'month'), 'count', n))
        from (
          select plan, billing_interval, count(*) n
          from public.companies
          where plan <> 'trial'
          group by plan, billing_interval
        ) s
      ), '[]'::jsonb),
      'status', coalesce((
        select jsonb_object_agg(coalesce(subscription_status, 'sin_estado'), n)
        from (
          select subscription_status, count(*) n
          from public.companies
          where plan <> 'trial'
          group by subscription_status
        ) s
      ), '{}'::jsonb)
    ),
    'candidates', jsonb_build_object(
      'total', (select count(*) from public.candidates),
      'new_7d', (select count(*) from public.candidates where created_at >= now() - interval '7 days'),
      'new_30d', (select count(*) from public.candidates where created_at >= now() - interval '30 days'),
      'by_status', coalesce((
        select jsonb_object_agg(status, n)
        from (select status, count(*) n from public.candidates group by status) s
      ), '{}'::jsonb)
    ),
    'campaigns', jsonb_build_object(
      'total', (select count(*) from public.campaigns),
      'activa', (select count(*) from public.campaigns where status = 'activa'),
      'pausada', (select count(*) from public.campaigns where status = 'pausada'),
      'cerrada', (select count(*) from public.campaigns where status = 'cerrada')
    ),
    'support', jsonb_build_object(
      'open', (select count(*) from public.support_tickets where status = 'abierto'),
      'closed', (select count(*) from public.support_tickets where status = 'cerrado'),
      'pending', (select count(*) from public.support_tickets where status = 'abierto' and awaiting = 'equipo')
    ),
    'series_candidates_14d', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]'::jsonb)
      from (
        select gs::date as d,
               (select count(*) from public.candidates ca where ca.created_at::date = gs::date) as c
        from generate_series(current_date - interval '13 days', current_date, interval '1 day') gs
      ) t
    )
  ) into v;

  return v;
end;
$$;
grant execute on function public.admin_overview() to authenticated;
