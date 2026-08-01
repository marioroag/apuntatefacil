-- ============================================================================
-- Apúntate Fácil · la marca deja de ser una función de plan superior
-- Poner tu nombre, tu logo y tu banner en el formulario es una primitiva, no
-- escala: TODOS los planes tienen una marca (incluido Prueba). Lo que sigue
-- cobrándose es tener VARIAS (Multi), que es el caso de ETTs y cadenas.
-- Espejo exacto de PLAN_BRAND_LIMIT en src/lib/pricing.ts.
-- El trigger trg_enforce_brand_limit no cambia: solo su tabla de topes.
-- ============================================================================

create or replace function public.plan_brand_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'multi' then 2147483647  -- "ilimitado"
    else 1                        -- trial, esencial, pro: su marca
  end
$$;
