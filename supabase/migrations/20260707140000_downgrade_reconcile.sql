-- ============================================================================
-- Apúntate Fácil · reconciliación de puestos al BAJAR de plan
--
-- Política (Mario): al bajar de plan NUNCA se borra ni se cierra un puesto. Los
-- candidatos recopilados son del cliente. Los puestos que sobran se PAUSAN: dejan
-- de aceptar candidaturas nuevas por su enlace, pero el puesto y TODOS sus
-- candidatos siguen visibles y exportables.
--
-- Cambio de modelo: el límite del plan pasa a contar solo puestos ACTIVOS. Pausar
-- libera cupo (los pausados quedan aparcados y no cuentan); reactivar exige un
-- hueco activo libre. Antes contaba activos + pausados ("pausar no liberaba cupo").
--
-- Al bajar de plan, el servidor pausa automáticamente los ACTIVOS que sobran (los
-- de MENOS candidaturas primero, para conservar activos los de más tracción) y
-- marca un flag para que el dueño elija cuáles mantener activos en un diálogo.
-- ============================================================================

-- 1) Flag por empresa: reconciliación pendiente tras un downgrade (el servidor
--    pausó puestos y el dueño debe elegir). null = nada pendiente.
alter table public.companies add column if not exists downgrade_reconcile_at timestamptz;

-- 2) El límite es sobre puestos ACTIVOS. Se enforca al pasar a 'activa' (crear o
--    reactivar). Pausar y cerrar nunca se bloquean ni consumen cupo.
create or replace function public.enforce_process_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  if new.status <> 'activa' then
    return new; -- pausar/cerrar: nunca bloquea
  end if;
  if tg_op = 'UPDATE' and old.status = 'activa' then
    return new; -- ya estaba activo: no consume un nuevo hueco
  end if;
  select plan into v_plan from public.companies where id = new.company_id;
  v_limit := public.plan_process_limit(v_plan);
  select count(*) into v_count
    from public.campaigns
    where company_id = new.company_id and status = 'activa' and id <> new.id;
  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = 'Pausa o cierra un puesto activo, o sube de plan.';
  end if;
  return new;
end
$$;

-- 3) Reconciliación al cambiar de plan. Pausa los ACTIVOS que exceden el nuevo
--    límite (los de menos candidaturas primero) y marca el flag. Nunca cierra.
create or replace function public.sync_campaigns_to_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_active integer;
  v_cands integer;
begin
  if new.plan is not distinct from old.plan then
    return new;
  end if;
  v_limit := public.plan_process_limit(new.plan);

  -- Subir DESDE Prueba: recuperar el puesto que el tope de candidatos pausó.
  -- (En Prueba solo hay 1 puesto y su única causa de pausa es ese tope.)
  if old.plan = 'trial' and new.plan <> 'trial' then
    update public.campaigns set status = 'activa'
      where company_id = new.id and status = 'pausada';
  end if;

  -- Pausar los ACTIVOS que sobran (menos candidaturas primero, desempate por
  -- antigüedad). Marcar el flag para que el dueño elija en el diálogo.
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

  -- Tope de candidatos del plan de Prueba: pausa aunque quede 1 activo si excede.
  if new.plan = 'trial' then
    select count(*) into v_cands from public.candidates where company_id = new.id;
    if v_cands >= public.plan_candidate_limit('trial') then
      update public.campaigns set status = 'pausada'
        where company_id = new.id and status = 'activa';
    end if;
  end if;

  return new;
end
$$;

-- 4) my_companies() viaja al cliente en cada carga: añadimos el flag al jsonb.
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
    'role', m.role
  ) order by c.created_at asc), '[]'::jsonb)
  from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;

-- 5) El dueño elige qué puestos mantener activos (hasta el límite) y el resto se
--    pausan, en UNA transacción. Resuelve el flag. Nunca toca puestos cerrados.
create or replace function public.set_active_campaigns(p_company_id uuid, p_active uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_limit integer;
  v_keep integer;
begin
  select role into v_role from public.memberships
    where company_id = p_company_id and user_id = auth.uid();
  if v_role is null or v_role <> 'owner' then
    raise exception 'Solo el propietario puede gestionar los puestos activos'
      using errcode = '42501';
  end if;

  v_limit := public.plan_process_limit((select plan from public.companies where id = p_company_id));
  v_keep := coalesce(array_length(p_active, 1), 0);
  if v_keep > v_limit then
    raise exception 'Demasiados puestos activos para tu plan' using errcode = 'P0001';
  end if;

  -- 1) Pausar los activos que NO están en la lista a mantener.
  update public.campaigns set status = 'pausada'
    where company_id = p_company_id and status = 'activa'
      and not (id = any(coalesce(p_active, '{}'::uuid[])));
  -- 2) Reactivar los pausados que SÍ están en la lista (nunca toca 'cerrada').
  update public.campaigns set status = 'activa'
    where company_id = p_company_id and status = 'pausada'
      and id = any(coalesce(p_active, '{}'::uuid[]));
  -- 3) Reconciliación resuelta.
  update public.companies set downgrade_reconcile_at = null where id = p_company_id;
end
$$;

revoke all on function public.set_active_campaigns(uuid, uuid[]) from public, anon;
grant execute on function public.set_active_campaigns(uuid, uuid[]) to authenticated;
