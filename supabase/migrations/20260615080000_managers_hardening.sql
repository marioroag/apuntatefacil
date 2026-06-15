-- ============================================================================
-- Apúntate Fácil · endurecimiento tras revisión de la RLS de encargados
-- 1) ALTA: el acceso a un CV se decidía por el PREFIJO del nombre del objeto, no
--    por la fila del candidato. Se ata el fichero a la fila + un trigger impide
--    que un candidato apunte a un CV fuera del slug de su puesto (anti-spoofing).
-- 2) MEDIA: candidates.company_id lo fija el puesto (invariante), no el cliente.
-- 3) MEDIA: integridad sede<->empresa en el esquema (FK compuesta) + revalidación
--    de sedes al aceptar una invitación de encargado (cierra ventana TOCTOU).
-- 4) BAJA: la lista de equipo y las asignaciones solo para el owner (o uno mismo).
-- ============================================================================

-- 1+2) Trigger de integridad de candidatos: fija company_id desde el puesto y
-- exige que el cv_path viva bajo el slug de SU puesto. Cubre tanto submit_application
-- como cualquier INSERT/UPDATE directo por PostgREST.
create or replace function public.enforce_candidate_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_company uuid;
begin
  select slug, company_id into v_slug, v_company from public.campaigns where id = new.campaign_id;
  if v_company is null then
    raise exception 'Puesto no encontrado';
  end if;
  new.company_id := v_company; -- la empresa la manda el puesto, no el cliente
  if new.cv_path is not null and split_part(new.cv_path, '/', 1) <> v_slug then
    raise exception 'cv_path no corresponde al puesto';
  end if;
  return new;
end;
$$;

create trigger trg_candidate_integrity
  before insert or update on public.candidates
  for each row execute function public.enforce_candidate_integrity();

-- 1) CVs: la visibilidad se deriva de la FILA del candidato (misma clave que el
-- gate de filas), no del prefijo del nombre. Un fichero solo es legible si existe
-- un candidato que lo referencia y cuyo puesto es visible para el usuario.
drop policy "cvs_select_visible" on storage.objects;
create policy "cvs_select_visible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and exists (
      select 1 from public.candidates c
      where c.cv_path = name
        and c.campaign_id in (select public.current_user_campaign_ids())
    )
  );

-- 3) Integridad sede<->empresa a nivel de esquema.
alter table public.sites add constraint sites_id_company_uq unique (id, company_id);
alter table public.manager_sites
  add constraint manager_sites_site_company_fk
  foreign key (site_id, company_id) references public.sites(id, company_id) on delete cascade;

-- Defensa en profundidad: el join de visibilidad de encargado exige misma empresa.
create or replace function public.current_user_campaign_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select c.id from public.campaigns c
   where c.company_id in (select public.current_user_full_access_company_ids())
  union
  select c.id from public.campaigns c
   join public.manager_sites ms
     on ms.site_id = c.site_id and ms.company_id = c.company_id and ms.user_id = auth.uid()
   where c.company_id in (
     select company_id from public.memberships where user_id = auth.uid() and role = 'encargado'
   )
$$;

-- 3) accept_invitation: al aceptar como encargado, solo se asignan sedes que
-- SIGAN siendo de la empresa (cierra la ventana entre crear y aceptar).
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare inv public.invitations; v_email text;
begin
  select * into inv from public.invitations where token = p_token;
  if not found then raise exception 'Invitación no encontrada'; end if;
  if inv.status <> 'pending' then raise exception 'Esta invitación ya no está disponible'; end if;
  if inv.expires_at <= now() then raise exception 'Esta invitación ha caducado'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'Confirma tu email antes de aceptar la invitación'; end if;
  if v_email <> inv.email then raise exception 'Esta invitación es para otro correo'; end if;
  insert into public.memberships(company_id, user_id, role)
    values (inv.company_id, auth.uid(), inv.role)
    on conflict (company_id, user_id) do update set role = excluded.role;
  if inv.role = 'encargado' then
    insert into public.manager_sites(company_id, user_id, site_id)
      select inv.company_id, auth.uid(), si.id
      from unnest(inv.site_ids) s(id)
      join public.sites si on si.id = s.id and si.company_id = inv.company_id
      on conflict (user_id, site_id) do nothing;
  end if;
  update public.invitations set status = 'accepted', accepted_at = now() where id = inv.id;
  return jsonb_build_object('company_id', inv.company_id);
end;
$$;

-- 4) El equipo y las asignaciones de sede son cosa del OWNER. Los no-owner solo
-- se ven a sí mismos (un encargado no necesita ver toda la plantilla).
drop policy "manager_sites_select" on public.manager_sites;
create policy "manager_sites_select" on public.manager_sites
  for select using (
    company_id in (select public.current_user_owner_company_ids()) or user_id = auth.uid()
  );

create or replace function public.list_members()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', m.user_id, 'email', u.email, 'role', m.role, 'is_self', m.user_id = auth.uid(),
        'site_ids', coalesce((select jsonb_agg(ms.site_id) from public.manager_sites ms
                              where ms.user_id = m.user_id and ms.company_id = m.company_id), '[]'::jsonb)
      )
      order by (m.role = 'owner') desc, u.email
    ),
    '[]'::jsonb
  )
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.company_id in (select public.current_user_owner_company_ids())  -- solo el owner ve la plantilla
     or (m.user_id = auth.uid());                                          -- cada uno se ve a sí mismo
$$;
