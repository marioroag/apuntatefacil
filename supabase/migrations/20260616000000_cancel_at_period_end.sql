-- ============================================================================
-- Apúntate Fácil · cancelación programada al final del periodo
-- Una suscripción cancelada con cancel_at_period_end sigue ACTIVA hasta el final
-- del periodo ya pagado (no es lo mismo que subscription_status). Guardamos ese
-- flag para que el panel ofrezca "Reanudar suscripción" mientras tanto.
-- Lo escribe el webhook de Stripe desde la suscripción.
-- ============================================================================

alter table public.companies add column if not exists cancel_at_period_end boolean not null default false;
