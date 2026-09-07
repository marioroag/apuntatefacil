-- ============================================================================
-- CIERRE DE LA AUDITORÍA DE SEGURIDAD (sep 2026): lo pequeño de la base.
--
-- Cuatro cosas que no valían una migración cada una y que juntas cierran los
-- hallazgos bajos de identidad y de memoria:
--   1. `revoke from public` en las doce funciones que solo tenían `grant`.
--   2. Actualizar la EMPRESA es de owner y member, no del encargado.
--   3. `set_member_access` recibe la empresa, en vez de adivinarla.
--   4. Tope de tamaño en las columnas de texto y jsonb que aún no lo tenían.
-- ============================================================================

-- 1) EL PATRÓN DE my_companies, CERRADO EN TODAS. `grant execute ... to
-- authenticated` NO quita el EXECUTE que Postgres concede a PUBLIC al crear la
-- función, así que `anon` podía llamarlas. Todas se guardan por dentro
-- (is_support_staff, propiedad, RLS) y con anon fallaban o devolvían vacío,
-- pero "devolver vacío" es justo lo que disfrazó una sesión muerta de cuenta
-- nueva en agosto. Un anónimo tiene que recibir un 401, no un dato.
revoke all on function public.admin_accounts() from public, anon;
revoke all on function public.admin_company_detail(uuid) from public, anon;
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.current_user_peer_ids() from public, anon;
revoke all on function public.is_support_staff() from public, anon;
revoke all on function public.list_company_members(uuid) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.search_candidates(uuid, text, int) from public, anon;
revoke all on function public.set_campaign_slug(uuid, text) from public, anon;
revoke all on function public.support_get_thread(uuid) from public, anon;
revoke all on function public.support_list_tickets() from public, anon;
revoke all on function public.support_set_status(uuid, text) from public, anon;

-- 2) LA EMPRESA LA TOCAN OWNER Y MEMBER. La política de update usaba
-- current_user_company_ids(), que incluye al encargado, y los grants por
-- columna le dejaban renombrar la empresa, cambiar el acento o encender
-- meridian_auto, que cuesta dinero. El encargado está acotado por sede en todo
-- lo demás; aquí también.
drop policy "companies_update_members" on public.companies;
create policy "companies_update_members" on public.companies
  for update
  using (id in (select public.current_user_full_access_company_ids()))
  with check (id in (select public.current_user_full_access_company_ids()));

-- 3) set_member_access ADIVINABA LA EMPRESA: cogía la primera de la que el
-- usuario es propietario, por antigüedad. Con dos empresas propias, el panel
-- de la segunda gestionaba el equipo de la primera. Ahora la recibe, y la
-- comprueba como hace remove_member. La firma vieja se retira para que no
-- convivan dos.
drop function if exists public.set_member_access(uuid, text, uuid[]);
create or replace function public.set_member_access(
  p_company_id uuid,
  p_user_id uuid,
  p_role text,
  p_site_ids uuid[] default '{}'
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_company_id is null or p_company_id not in (select public.current_user_owner_company_ids()) then
    raise exception 'Solo el propietario puede gestionar el equipo';
  end if;
  if p_user_id = auth.uid() then raise exception 'No puedes cambiar tu propio rol'; end if;
  if p_role not in ('member', 'encargado') then raise exception 'Rol no válido'; end if;
  if not exists (select 1 from public.memberships where company_id = p_company_id and user_id = p_user_id and role <> 'owner') then
    raise exception 'Ese usuario no está en tu equipo';
  end if;
  if p_role = 'encargado' then
    if coalesce(array_length(p_site_ids, 1), 0) = 0 then raise exception 'Elige al menos una sede'; end if;
    if exists (select 1 from unnest(p_site_ids) s(id)
               where s.id not in (select id from public.sites where company_id = p_company_id)) then
      raise exception 'Alguna sede no pertenece a tu empresa';
    end if;
  end if;
  update public.memberships set role = p_role where company_id = p_company_id and user_id = p_user_id;
  delete from public.manager_sites where company_id = p_company_id and user_id = p_user_id;
  if p_role = 'encargado' then
    insert into public.manager_sites(company_id, user_id, site_id)
      select p_company_id, p_user_id, unnest(p_site_ids);
  end if;
end;
$$;
revoke all on function public.set_member_access(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.set_member_access(uuid, uuid, text, uuid[]) to authenticated;

-- 4) TOPES DE TAMAÑO donde faltaban. Solo escribe un miembro autenticado, así
-- que no es una puerta pública; es el mismo cinturón que ya llevan answers,
-- notes, ui_prefs, anuncio y baremo: un jsonb sin tope es un sitio donde meter
-- lo que sea. `not valid` a propósito: no se comprueban las filas que ya
-- existen en producción (la migración no puede fallar por un dato antiguo),
-- solo lo que se escriba a partir de ahora. Los números son generosos: un
-- formulario de veinte preguntas con opciones no llega a 10 KB.
alter table public.campaigns
  add constraint campaigns_fields_size check (length(fields::text) <= 50000) not valid,
  add constraint campaigns_branding_size check (length(branding::text) <= 20000) not valid,
  add constraint campaigns_title_len check (char_length(title) <= 200) not valid,
  add constraint campaigns_sector_len check (char_length(sector) <= 100) not valid,
  add constraint campaigns_location_len check (char_length(location) <= 200) not valid,
  add constraint campaigns_milanuncios_url_len check (char_length(milanuncios_url) <= 2000) not valid;
alter table public.brands
  add constraint brands_name_len check (char_length(name) <= 120) not valid,
  add constraint brands_welcome_len check (char_length(welcome) <= 2000) not valid,
  add constraint brands_thanks_len check (char_length(thanks) <= 2000) not valid;
alter table public.saved_views
  add constraint saved_views_name_len check (char_length(name) <= 120) not valid,
  add constraint saved_views_payload_size check (length(payload::text) <= 20000) not valid;
alter table public.companies
  add constraint companies_name_len check (char_length(name) <= 120) not valid;
