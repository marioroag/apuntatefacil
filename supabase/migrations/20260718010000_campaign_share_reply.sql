-- Respuesta reutilizable del puesto al compartir su enlace.
-- Nullable: sin plantilla personalizada, la interfaz genera una respuesta base
-- con el título y el enlace actual del puesto.
alter table public.campaigns
  add column if not exists share_reply text;
