-- ============================================================================
-- Apúntate Fácil · plan free: SEGUIR recopilando candidatos y BLOQUEAR los que
-- exceden el tope (en vez de rechazarlos o pausar el puesto)
--
-- Cambio de comportamiento (Mario, 2026-07-07): en 'trial', al superar el tope de
-- candidatos NO se rechaza al candidato ni se pausa el puesto. El puesto sigue
-- ACTIVO y sigue recopilando; los candidatos que entran por encima del tope se
-- marcan como BLOQUEADOS (locked): el comerciante no puede verlos (RLS) hasta que
-- sube/renueva de plan, momento en que se desbloquean todos. Objetivo: no perder
-- candidatos y tentar la compra mostrando cuántos hay esperando.
--
-- Los planes de pago tienen cupo ilimitado, así que nunca bloquean.
-- ============================================================================

-- 1) Flag de bloqueo. Por defecto visible; solo el trigger lo pone a true.
alter table public.candidates add column if not exists locked boolean not null default false;

-- Índice parcial para contar/filtrar bloqueados por puesto (barato).
create index if not exists candidates_locked_idx on public.candidates(campaign_id) where locked;

-- 2) Ya NO se rechaza al candidato que excede el tope: el trigger lo marca 'locked'
-- según el cupo VISIBLE (no bloqueados) del plan. Planes de pago -> cupo ilimitado
-- -> nunca bloquea. Cubre submit_application y cualquier INSERT directo.
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
  -- Serializa los envíos simultáneos de la MISMA empresa para que el cupo sea exacto
  -- (sin el lock, dos inserts a la vez podrían leer el mismo count y colarse).
  perform pg_advisory_xact_lock(hashtext(v_company::text));
  v_limit := public.plan_candidate_limit(v_plan);
  -- Cuenta solo los VISIBLES (no bloqueados): borrar un visible libera hueco para
  -- el siguiente que llegue, pero los ya bloqueados siguen bloqueados.
  select count(*) into v_count
    from public.candidates where company_id = v_company and not locked;
  new.locked := (v_count >= v_limit);
  return new;
end
$$;

-- 3) submit_application: ya NO pausa el puesto al llegar al tope (sigue
-- recopilando). El bloqueo lo pone el trigger. Se conserva el rechazo si el puesto
-- no está activo (pausa/cierre manual) y el tope de tamaño. Firma y grant idénticos.
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
begin
  -- Tope de tamaño: un formulario real no llega ni de lejos a 200 KB de respuestas.
  if length(coalesce(p_answers, '{}'::jsonb)::text) > 200000 then
    raise exception 'Respuestas demasiado largas';
  end if;
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
  return cand_id;
end
$$;

grant execute on function public.submit_application(text, jsonb, text, text) to anon, authenticated;

-- 4) La RLS del comerciante OCULTA los bloqueados (no solo la UI): no los puede
-- leer, ni modificar, ni borrar. El acceso vuelve al desbloquearse (subir de plan).
drop policy "candidates_scoped" on public.candidates;
create policy "candidates_scoped" on public.candidates
  for all
  using (campaign_id in (select public.current_user_campaign_ids()) and not locked)
  with check (campaign_id in (select public.current_user_campaign_ids()));

-- 5) Vista previa de bloqueados por puesto para el panel (filas difuminadas +
-- aviso). security definer para leer lo que la RLS oculta, pero SOLO de los
-- puestos del propio usuario y devolviendo únicamente el RECUENTO y las FECHAS de
-- entrada (NUNCA datos personales: nombre, teléfono ni respuestas). El panel pinta
-- filas con la estructura real difuminada pero con la fecha visible, para que se
-- palpe que hay gente esperando. { campaign_id: { count, dates: [iso...] } }:
-- count es el total; dates son las 8 más recientes (las que se pintan).
create or replace function public.locked_candidates_preview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(campaign_id::text, obj), '{}'::jsonb)
  from (
    select campaign_id,
      jsonb_build_object(
        'count', count(*),
        'dates', coalesce(
          jsonb_agg(created_at order by created_at desc) filter (where rn <= 8),
          '[]'::jsonb)
      ) as obj
    from (
      select campaign_id, created_at,
        row_number() over (partition by campaign_id order by created_at desc) as rn
      from public.candidates
      where locked and campaign_id in (select public.current_user_campaign_ids())
    ) s
    group by campaign_id
  ) t
$$;

revoke all on function public.locked_candidates_preview() from public, anon;
grant execute on function public.locked_candidates_preview() to authenticated;

-- 6) Al SUBIR de plan desde trial, DESBLOQUEAR todos los candidatos de la empresa
-- (además de la reactivación de puestos, capada al cupo). En el modelo nuevo el
-- tope de candidatos ya no pausa puestos, así que se quita esa re-pausa al bajar a
-- trial (el puesto sigue activo y bloquea los nuevos que sobren). Copia de la
-- versión 20260707160000 + desbloqueo, menos la re-pausa por tope.
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
  v_limit := public.plan_process_limit(new.plan);

  if old.plan = 'trial' and new.plan <> 'trial' then
    -- Al pagar, se ve TODO lo recopilado durante el free.
    update public.candidates set locked = false
      where company_id = new.id and locked;
    -- Reactivar puestos pausados solo hasta llenar el cupo libre del plan nuevo.
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

  return new;
end
$$;
