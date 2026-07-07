-- ============================================================================
-- Apúntate Fácil · fix: al SUBIR de plan, reactivar puestos solo hasta el cupo
--
-- Bug (encontrado en el smoke test del go-live, 2026-07-07): sync_campaigns_to_plan
-- reactivaba TODOS los puestos pausados al subir desde 'trial'. Si había más
-- pausados que el tope del plan nuevo, esa reactivación disparaba
-- enforce_process_limit (PLAN_LIMIT_REACHED) y REVERTÍA el UPDATE del plan entero.
-- Como el webhook (applySub) no comprobaba el error de Supabase, respondía 200 OK
-- y el cliente se quedaba en 'trial' pese a haber pagado (pérdida de dinero
-- silenciosa, del mismo tipo que la auditoría prelanzamiento).
--
-- Fix: al subir desde trial, reactivar puestos pausados SOLO hasta llenar los
-- huecos libres del plan nuevo (nunca dispara el límite). El resto de pausados
-- los recupera el dueño desde el diálogo de reconciliación. Copia fiel de la
-- función salvo esa rama. Idempotente (create or replace).
-- ============================================================================

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

  -- Subir DESDE Prueba: reactivar puestos pausados SOLO hasta llenar el cupo libre
  -- del plan nuevo. Antes se reactivaban TODOS: si había más pausados que el tope,
  -- se disparaba enforce_process_limit y se revertía el cambio de plan entero.
  if old.plan = 'trial' and new.plan <> 'trial' then
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
