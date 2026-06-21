-- ============================================================================
-- FIX: crear puesto daba 403 (42501 "new row violates row-level security policy").
--
-- Causa: la policy `campaigns_select` se AUTORREFERENCIABA con la propia tabla:
--   using (id in (select current_user_campaign_ids()))
-- y current_user_campaign_ids() reescanea `campaigns`. Al crear un puesto, PostgREST
-- hace INSERT ... RETURNING (return=representation, por el .select('*') del cliente),
-- y PostgreSQL aplica la policy de SELECT a la fila recién insertada. Esa fila aún no
-- es visible para el reescaneo de current_user_campaign_ids() (no se ve a sí misma
-- dentro del mismo comando), así que la policy la rechaza -> 42501. El INSERT en sí
-- (WITH CHECK) era correcto; lo que fallaba era el RETURNING.
--
-- Solución: comprobar la fila DIRECTAMENTE por company_id/site_id, sin reescanear
-- campaigns. Es exactamente la misma lógica/seguridad que current_user_campaign_ids()
-- (owner/member ven los puestos de su empresa; el encargado, los de sus sedes), pero
-- evaluada sobre la propia fila, por lo que ya no se rompe con INSERT ... RETURNING.
-- ============================================================================
alter policy campaigns_select on public.campaigns using (
  company_id in (select public.current_user_full_access_company_ids())
  or (
    site_id in (select ms.site_id from public.manager_sites ms where ms.user_id = auth.uid())
    and company_id in (select company_id from public.memberships
                       where user_id = auth.uid() and role = 'encargado')
  )
);
