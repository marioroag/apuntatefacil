-- ============================================================================
-- LA PRUEBA ES TU PRIMER PUESTO, Y SOLO ESE (Mario, 8-sep-2026).
--
-- Hasta hoy la prueba era "un proceso abierto a la vez": cerrar el primero
-- liberaba el hueco y se podía abrir otro distinto gratis, y otro, mientras
-- durasen los 15 días. Probándolo, Mario no lo entendió, y tenía razón:
-- "gratis" tiene que significar una cosa concreta. Ahora el hueco de la
-- prueba pertenece al PRIMER puesto que se abre (`companies.trial_campaign_id`,
-- el mismo que arranca el reloj). Ese se puede pausar, cerrar y reabrir gratis
-- durante la prueba; cualquier otro, aunque el primero esté cerrado, pasa por
-- el pago, y al pagar se cobran todos los abiertos, el primero incluido.
--
-- Si el puesto de la prueba se borra, el hueco vuelve a quedar libre para el
-- siguiente (la clave se pone a NULL), pero el reloj no se toca: los 15 días
-- siguen corriendo desde que arrancaron. Una prueba por empresa, como siempre.
-- ============================================================================

alter table public.companies
  add column if not exists trial_campaign_id uuid references public.campaigns(id) on delete set null;

-- Las cuentas que ya tienen el reloj en marcha: su puesto de prueba es el
-- primero que abrieron (el más antiguo no cerrado; si todos están cerrados,
-- el más antiguo).
update public.companies co
   set trial_campaign_id = (
     select c.id from public.campaigns c
      where c.company_id = co.id
      order by (c.status = 'cerrada') asc, c.created_at asc
      limit 1
   )
 where co.plan = 'trial'
   and co.trial_campaign_id is null
   and co.trial_ends_at is not null;

create or replace function public.start_trial_clock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Un puesto que nace cerrado (a la espera del pago) no abre ninguna prueba.
  if new.status = 'cerrada' then
    return new;
  end if;
  -- El primer puesto que se abre es EL de la prueba: arranca el reloj (si no
  -- había arrancado) y se queda con el hueco.
  update public.companies
     set trial_ends_at = coalesce(trial_ends_at, now() + interval '15 days'),
         trial_campaign_id = new.id
   where id = new.company_id and plan = 'trial' and trial_campaign_id is null;
  return new;
end
$$;

create or replace function public.enforce_process_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_paid integer;
  v_trial_campaign uuid;
  v_limit integer;
  v_count integer;
begin
  if new.status = 'cerrada' then
    return new; -- cerrar nunca se bloquea
  end if;
  select plan, paid_processes, trial_campaign_id into v_plan, v_paid, v_trial_campaign
    from public.companies where id = new.company_id;

  if v_plan = 'trial' then
    -- Solo consume hueco lo que se ABRE: un insert abierto o salir de 'cerrada'.
    if tg_op = 'UPDATE' and old.status <> 'cerrada' then
      return new; -- activa <-> pausada: sigue abierto, mismo hueco
    end if;
    -- El hueco de la prueba es de UN puesto: el primero que se abrió. Ese
    -- puede reabrirse; cualquier otro pasa por el pago.
    if v_trial_campaign is not null and new.id <> v_trial_campaign then
      raise exception 'PLAN_LIMIT_REACHED'
        using errcode = 'P0001',
              hint = 'La prueba cubre solo tu primer puesto. Añade tu método de pago para abrir otro.';
    end if;
    return new;
  end if;

  if v_plan = 'proceso' then
    if tg_op = 'UPDATE' and old.status <> 'cerrada' then
      return new;
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

  -- Tiers legacy: semántica original (solo 'activa' consume cupo).
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
    'trial_campaign_id', c.trial_campaign_id,
    'paid_processes', c.paid_processes,
    'descripcion', c.descripcion,
    'retencion_meses', c.retencion_meses,
    'region_fiscal', c.region_fiscal,
    'role', m.role
  ) order by c.created_at asc), '[]'::jsonb)
  from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;
