-- ============================================================================
-- Apúntate Fácil · tope de marcas por plan
-- La función de marcas pasa a estar también en Pro, pero limitada a 1 marca.
-- Multi: ilimitadas. Esencial/trial: 0 (no tienen la función). Enforcement en
-- servidor (no saltable desde la API); el cliente avisa antes y ofrece subir.
-- ============================================================================

create or replace function public.plan_brand_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'pro' then 1
    when 'multi' then 2147483647  -- "ilimitado"
    else 0
  end
$$;

create or replace function public.enforce_brand_limit()
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
  select plan into v_plan from public.companies where id = new.company_id;
  v_limit := public.plan_brand_limit(v_plan);
  select count(*) into v_count from public.brands where company_id = new.company_id;
  if v_count >= v_limit then
    raise exception 'BRAND_LIMIT_REACHED'
      using errcode = 'P0001', hint = 'Sube de plan para crear más marcas.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_brand_limit on public.brands;
create trigger trg_enforce_brand_limit
  before insert on public.brands
  for each row execute function public.enforce_brand_limit();
