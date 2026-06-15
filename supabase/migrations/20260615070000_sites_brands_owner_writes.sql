-- ============================================================================
-- Apúntate Fácil · restringir la escritura de sedes y marcas a acceso PLENO
-- Tras añadir el rol encargado: un encargado es "member" de la empresa, así que
-- con la RLS anterior (todos los miembros) podría crear/editar/borrar sedes y
-- marcas (estructura organizativa que no le corresponde). Se acota: LECTURA para
-- todos los miembros (la necesitan para agrupar/ver), ESCRITURA solo owner/member
-- con acceso pleno (no encargados). Patrón: una política FOR ALL de acceso pleno
-- + una FOR SELECT de miembros (en SELECT se combinan con OR => leen todos).
-- ============================================================================

-- Sedes
drop policy "sites_all_members" on public.sites;
create policy "sites_modify_full" on public.sites
  for all using (company_id in (select public.current_user_full_access_company_ids()))
  with check (company_id in (select public.current_user_full_access_company_ids()));
create policy "sites_select_members" on public.sites
  for select using (company_id in (select public.current_user_company_ids()));

-- Marcas
drop policy "brands_all_members" on public.brands;
create policy "brands_modify_full" on public.brands
  for all using (company_id in (select public.current_user_full_access_company_ids()))
  with check (company_id in (select public.current_user_full_access_company_ids()));
create policy "brands_select_members" on public.brands
  for select using (company_id in (select public.current_user_company_ids()));
