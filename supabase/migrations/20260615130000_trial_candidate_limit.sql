-- ============================================================================
-- Apúntate Fácil · plan de Prueba con acceso al panel: 1 puesto y 15 candidatos
-- El plan 'trial' deja de ser un muro de pago y pasa a tener acceso REAL al panel,
-- con dos topes: 1 puesto abierto y 15 candidatos en total. Al recibir el 15º
-- candidato el puesto se PAUSA (deja de aceptar candidaturas) hasta que el cliente
-- suba de plan. Enforcement en servidor (no saltable desde la API); el cliente lo
-- refleja en src/lib/pricing.ts (PLAN_PROCESS_LIMIT, PLAN_CANDIDATE_LIMIT).
-- ============================================================================

-- 1) El plan de Prueba permite 1 puesto abierto (antes caía en el else -> 0).
create or replace function public.plan_process_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'trial' then 1
    when 'esencial' then 2
    when 'pro' then 10
    when 'multi' then 2147483647   -- "ilimitado"
    else 0                         -- plan desconocido: sin procesos
  end
$$;

-- 2) Tope de candidatos por plan. Solo 'trial' tiene tope (15); el resto ilimitado.
-- Espejo en cliente: PLAN_CANDIDATE_LIMIT en src/lib/pricing.ts. Mantener sincronizado.
create or replace function public.plan_candidate_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'trial' then 15
    else 2147483647   -- "ilimitado"
  end
$$;

-- 3) Hard cap de candidatos: bloquea el candidato que excede el tope del plan.
-- Cubre TODA inserción (submit_application y cualquier INSERT directo por PostgREST).
-- Deriva empresa y plan desde el puesto, así no depende del orden de los triggers.
create or replace function public.enforce_candidate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  select co.id, co.plan into v_company, v_plan
    from public.campaigns c
    join public.companies co on co.id = c.company_id
    where c.id = new.campaign_id;
  if v_company is null then
    return new; -- el trigger de integridad ya valida que el puesto exista
  end if;
  -- Serializa los envíos simultáneos de la MISMA empresa para que el tope sea exacto
  -- (sin el lock, dos inserts a la vez podrían leer el mismo count y colarse al 16).
  perform pg_advisory_xact_lock(hashtext(v_company::text));
  v_limit := public.plan_candidate_limit(v_plan);
  select count(*) into v_count from public.candidates where company_id = v_company;
  if v_count >= v_limit then
    raise exception 'CANDIDATE_LIMIT_REACHED'
      using errcode = 'P0001', hint = 'Sube de plan para recibir más candidatos.';
  end if;
  return new;
end
$$;

drop trigger if exists trg_enforce_candidate_limit on public.candidates;
create trigger trg_enforce_candidate_limit
  before insert on public.candidates
  for each row execute function public.enforce_candidate_limit();

-- 4) submit_application: ahora solo acepta puestos ACTIVOS (antes solo rechazaba
-- 'cerrada', dejaba pasar los 'pausada') y AUTO-PAUSA el puesto al alcanzar el tope
-- de candidatos del plan, para que deje de aceptar candidaturas. Firma idéntica:
-- el grant a anon se conserva.
create or replace function public.submit_application(
  p_slug text,
  p_answers jsonb,
  p_source text default 'enlace',
  p_cv_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cmp public.campaigns;
  cand_id uuid;
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  select * into cmp from public.campaigns where slug = p_slug;
  if not found then
    raise exception 'Puesto no encontrado';
  end if;
  if cmp.status <> 'activa' then
    raise exception 'Este puesto ya no acepta candidaturas';
  end if;
  insert into public.candidates(campaign_id, company_id, answers, source, cv_path, status)
    values (cmp.id, cmp.company_id, coalesce(p_answers, '{}'::jsonb),
            coalesce(p_source, 'enlace'), p_cv_path, 'nuevo')
    returning id into cand_id;
  -- ¿alcanzado el tope del plan con este candidato? entonces pausamos el puesto.
  select plan into v_plan from public.companies where id = cmp.company_id;
  v_limit := public.plan_candidate_limit(v_plan);
  select count(*) into v_count from public.candidates where company_id = cmp.company_id;
  if v_count >= v_limit then
    update public.campaigns set status = 'pausada' where id = cmp.id and status = 'activa';
  end if;
  return cand_id;
end
$$;

grant execute on function public.submit_application(text, jsonb, text, text) to anon, authenticated;

-- 5) Reconcilia los puestos con el plan cuando este cambia (cubre el webhook de
-- Stripe y cualquier cambio manual). Al subir de Prueba a pago se levanta el tope:
-- reactivamos el puesto que el tope hubiera pausado. Al bajar a Prueba estando por
-- encima del tope, pausamos los puestos activos (el tope bloquearía la entrada, así
-- el estado mostrado es honesto y el cliente sabe que debe subir de plan).
-- En Prueba la ÚNICA causa de pausa es el tope, así que reactivar al subir es seguro.
create or replace function public.sync_campaigns_to_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.plan is distinct from old.plan then
    if old.plan = 'trial' and new.plan <> 'trial' then
      update public.campaigns set status = 'activa'
        where company_id = new.id and status = 'pausada';
    elsif new.plan = 'trial' and old.plan <> 'trial' then
      select count(*) into v_count from public.candidates where company_id = new.id;
      if v_count >= public.plan_candidate_limit('trial') then
        update public.campaigns set status = 'pausada'
          where company_id = new.id and status = 'activa';
      end if;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_sync_campaigns_to_plan on public.companies;
create trigger trg_sync_campaigns_to_plan
  after update of plan on public.companies
  for each row execute function public.sync_campaigns_to_plan();
