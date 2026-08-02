-- ============================================================================
-- Apúntate Fácil · la marca deja de ser una función de plan superior
--
-- RENOMBRADA de 20260801120000 a 20260801130000 (ago 2026). Nació en la rama de
-- sedes y marcas con el mismo número que 20260801120000_interviews.sql, de la
-- rama de entrevistas. Cada una se desplegó por su lado y ninguna se enteró;
-- al juntarlas, `supabase db reset` se caía con duplicate key en
-- schema_migrations, o sea que el proyecto ya no se podía levantar de cero.
--
-- Se renombra ESTA y no la otra porque su cuerpo es un `create or replace`:
-- volver a ejecutarla en producción, donde su efecto ya está aplicado, no
-- cambia nada. La de entrevistas crea tablas y no se puede repetir.
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
