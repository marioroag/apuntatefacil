-- ============================================================================
-- Apúntate Fácil · endurecimiento de permisos de facturación (pre-lanzamiento)
-- Cierra dos agujeros que hacen PERDER DINERO, encontrados en la auditoría
-- del 2026-07-06 (verificados contra la BD real):
--
--   BUG A (catastrófico): el webhook de Stripe escribe companies.plan con el rol
--   service_role, pero service_role NO tenía UPDATE sobre companies (en este
--   backend no hereda permisos de tabla). Cada pago fallaba con 42501 y el plan
--   pagado NUNCA se aplicaba: el cliente pagaba y se quedaba en 'trial'.
--
--   BUG B (crítico): el rol authenticated tenía UPDATE sobre TODAS las columnas
--   de companies. Cualquier usuario con cuenta podía hacer un PATCH a PostgREST
--   y ponerse plan='multi' (o forjar subscription_status / stripe_subscription_id)
--   sin pasar por Stripe: acceso gratis al tier más caro.
--
-- Regla que queremos: el estado de facturación (plan, subscription_status,
-- stripe_*, billing_interval, cancel_at_period_end) SOLO lo escribe el backend
-- de confianza (webhook y checkout, vía service_role). El cliente autenticado
-- solo puede editar los datos de presentación de su empresa (name, accent),
-- y siempre acotado por la RLS a su propia empresa.
-- ============================================================================

-- BUG A: el backend de confianza (webhook + checkout) sí puede leer/escribir
-- el estado de facturación. Sin esto, ningún pago se refleja en la app.
grant select, update on public.companies to service_role;

-- BUG B: quitamos el UPDATE a la tabla completa del rol del cliente y lo
-- limitamos a las columnas realmente editables por el usuario. Las columnas de
-- facturación quedan fuera de su alcance (defensa a nivel de grant, además de
-- la RLS). La política companies_update_members sigue acotando por empresa.
revoke update on public.companies from authenticated;
grant update (name, accent) on public.companies to authenticated;
