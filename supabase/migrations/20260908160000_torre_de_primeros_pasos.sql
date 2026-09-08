-- ============================================================================
-- Apúntate Fácil · la guía de primer uso pasa a ser una TORRE de pasos en
-- Vista general (Mario, sep 2026). Seis pasos, uno desplegado; se marcan al
-- hacerlos. Cuatro salen de los datos (puesto, probar, enlace por candidatura
-- real, equipo, logo); dos NO pueden salir de ahí (preguntas: haber entrado al
-- constructor; enlace: haberlo copiado) y los opcionales pueden OMITIRSE.
--
-- Van en columna y no en localStorage por lo mismo que onboarding_done_at
-- (20260707120000): el dueño alterna móvil y escritorio. Y la columna es
-- además el LATCH: un paso hecho no vuelve a pendiente aunque el dato que lo
-- dedujo desaparezca (borrar la candidatura de prueba no reabre "pruébalo tú
-- mismo").
--
-- Forma: {"puesto":"hecho","logo":"omitido",...}. Qué claves y valores valen
-- lo vigila el cliente (lib/primerosPasos.ts) al leer y al escribir; repetir
-- la lista aquí sería una segunda lista que se queda vieja. Aquí solo se exige
-- que sea un objeto.
-- ============================================================================

alter table public.companies
  add column if not exists onboarding_pasos jsonb not null default '{}'::jsonb;

alter table public.companies
  drop constraint if exists companies_onboarding_pasos_objeto;
alter table public.companies
  add constraint companies_onboarding_pasos_objeto
  check (jsonb_typeof(onboarding_pasos) = 'object');

-- Grant por COLUMNA, como onboarding_done_at: el hardening de facturación
-- (20260706160000) revocó el UPDATE de tabla completa a authenticated y no
-- debe reabrirse. La RLS companies_update_members acota por empresa.
grant update (onboarding_pasos) on public.companies to authenticated;

-- my_companies() viaja al cliente en cada carga. Copia ENTERA de la última
-- definición (20260908130000_prueba_primer_puesto.sql) más la columna nueva:
-- partir de una versión vieja borra lo que añadieron las de en medio.
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
    'onboarding_pasos', c.onboarding_pasos,
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
