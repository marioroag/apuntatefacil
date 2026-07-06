-- ============================================================================
-- Apúntate Fácil · onboarding guiado de primer uso
-- 1) Flag "guía cerrada/terminada" por EMPRESA (columna, no localStorage: el
--    dueño alterna móvil/escritorio y el estado debe viajar). El resto del
--    progreso NO se persiste: se deriva de datos reales (¿hay puesto? ¿hay
--    candidatura?), así el onboarding se retoma solo y no puede desincronizarse.
-- 2) Origen 'prueba' para la candidatura que el dueño se envía a sí mismo al
--    probar su enlace ("pruébalo tú mismo"). Se pinta como chip neutro y puede
--    borrarse para liberar cupo del tope del plan de Prueba.
-- ============================================================================

alter table public.companies add column if not exists onboarding_done_at timestamptz;

-- Las cuentas EXISTENTES no deben ver la guía: ya conocen el producto.
update public.companies set onboarding_done_at = now() where onboarding_done_at is null;

-- El dueño marca la guía como cerrada/terminada desde el cliente. El grant es
-- por columna: el hardening de facturación (20260706160000) revocó el UPDATE de
-- tabla completa a authenticated y NO debe reabrirse (plan/stripe_* siguen
-- siendo solo del backend). La RLS companies_update_members acota por empresa.
grant update (onboarding_done_at) on public.companies to authenticated;

-- my_companies() viaja al cliente en cada carga: añadimos el flag al jsonb.
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
    'role', m.role
  ) order by c.created_at asc), '[]'::jsonb)
  from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;

-- Origen 'prueba': la candidatura que el dueño se envía al probar su formulario.
-- El enlace canónico nunca lleva el marcador (solo el botón "Abrir mi formulario"
-- añade ?prueba=1), así una candidatura real jamás puede marcarse como prueba.
alter table public.candidates drop constraint if exists candidates_source_check;
alter table public.candidates
  add constraint candidates_source_check
  check (source in ('milanuncios', 'enlace', 'qr', 'prueba'));
