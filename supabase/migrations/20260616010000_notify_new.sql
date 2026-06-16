-- ============================================================================
-- Apúntate Fácil · aviso por email de candidatura nueva, por puesto
-- Cada puesto puede activar/desactivar el email al dueño cuando entra un candidato.
-- Por defecto ON (comportamiento actual). Lo respeta la función notify-new-candidate.
-- ============================================================================

alter table public.campaigns add column if not exists notify_new boolean not null default true;
