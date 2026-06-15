-- ============================================================================
-- Apúntate Fácil · límite de "procesos" (puestos) activos por plan
-- Un proceso cuenta si está 'activa' o 'pausada' (pausar no libera cupo).
-- Topes: trial 0, esencial 2, pro 10, multi ilimitado.
-- Enforcement en servidor (no saltable desde la API). El cliente lo refleja en UI.
-- ============================================================================

create or replace function public.plan_process_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'esencial' then 2
    when 'pro' then 10
    when 'multi' then 2147483647   -- "ilimitado"
    else 0                         -- trial / cualquier otro: sin procesos
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
  v_limit integer;
  v_count integer;
begin
  -- Solo importa al ABRIR un proceso (queda activo o pausado).
  if new.status not in ('activa', 'pausada') then
    return new;
  end if;
  -- En update: si ya estaba abierto, no consume un nuevo cupo (p.ej. activa<->pausada).
  if tg_op = 'UPDATE' and old.status in ('activa', 'pausada') then
    return new;
  end if;

  select plan into v_plan from public.companies where id = new.company_id;
  v_limit := public.plan_process_limit(v_plan);

  select count(*) into v_count
  from public.campaigns
  where company_id = new.company_id
    and status in ('activa', 'pausada')
    and id <> new.id;

  if v_count >= v_limit then
    raise exception 'PLAN_LIMIT_REACHED'
      using errcode = 'P0001',
            hint = 'Cierra un proceso o sube de plan para abrir otro.';
  end if;

  return new;
end
$$;

drop trigger if exists trg_enforce_process_limit on public.campaigns;
create trigger trg_enforce_process_limit
  before insert or update on public.campaigns
  for each row execute function public.enforce_process_limit();
