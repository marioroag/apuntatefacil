-- ============================================================================
-- Apúntate Fácil · grants para que notify-new-candidate pueda leer como service_role
-- ----------------------------------------------------------------------------
-- En este backend los privilegios de tabla se conceden EXPLÍCITAMENTE por rol
-- (ver 20260614014700_init.sql): solo "authenticated" recibe DML, y "service_role"
-- no hereda nada. La edge function notify-new-candidate lee con el cliente admin
-- (service_role) directo vía PostgREST: admin.from('candidates') y
-- admin.from('campaigns'). Sin estos grants devuelve 42501 (permission denied),
-- y como el formulario público la invoca best-effort (.catch), el fallo pasa
-- desapercibido: la candidatura se guarda pero el aviso nunca saldría aunque se
-- enchufe Resend.
-- get_company_owner_email ya funciona (security definer con execute a service_role,
-- ver 20260614030000_billing_notify.sql), así que solo faltan los SELECT.
grant select on public.candidates to service_role;
grant select on public.campaigns to service_role;
