-- ============================================================================
-- Apúntate Fácil · periodo de facturación de la suscripción (mensual/anual)
-- Guardamos el intervalo del precio activo para que el panel de plan sepa si el
-- cliente está en mensual o anual y permita cambiar SOLO el periodo sin cambiar
-- de plan. Lo escribe el webhook de Stripe desde el precio de la suscripción.
-- ============================================================================

alter table public.companies add column if not exists billing_interval text;
