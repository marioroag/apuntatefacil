-- Eliminar un miembro del equipo (desde la pestaña Equipo). Solo el OWNER de esa empresa.
-- No te puedes quitar a ti mismo ni a otro propietario (protege la empresa). Limpia también
-- las sedes que gestionaba (si era encargado) y su membresía.
create or replace function public.remove_member(p_company_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_company_id not in (select public.current_user_owner_company_ids()) then
    raise exception 'No autorizado';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'No puedes eliminarte a ti mismo';
  end if;
  if exists (
    select 1 from public.memberships
    where company_id = p_company_id and user_id = p_user_id and role = 'owner'
  ) then
    raise exception 'No se puede eliminar a un propietario';
  end if;
  delete from public.manager_sites where company_id = p_company_id and user_id = p_user_id;
  delete from public.memberships where company_id = p_company_id and user_id = p_user_id;
end;
$$;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
