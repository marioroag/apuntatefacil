-- ============================================================================
-- Apúntate Fácil · rol ENCARGADO acotado por sede (feature Multi 4)
-- Un encargado ve, gestiona y exporta SOLO los candidatos de SUS sedes; nunca
-- los de otras. El owner sigue viendo todo. Aislamiento real en RLS para
-- campaigns, candidates y los CVs en Storage. PIEZA DE MÁXIMO RIESGO: un fallo
-- aquí filtra datos personales entre sedes, así que el aislamiento se prueba.
--
-- Modelo: memberships.role gana 'encargado'. manager_sites lista las sedes de
-- cada encargado. Toda la visibilidad se canaliza por current_user_campaign_ids().
-- ============================================================================

-- 1) Rol encargado
alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check check (role in ('owner', 'member', 'encargado'));

-- 2) Sedes que gestiona cada encargado
create table public.manager_sites (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  primary key (user_id, site_id)
);
create index manager_sites_company_idx on public.manager_sites(company_id);

alter table public.manager_sites enable row level security;
-- Los miembros de la empresa pueden leer las asignaciones (el owner las gestiona
-- por RPC). Sin DML directo: la escritura va por RPC owner-only.
create policy "manager_sites_select" on public.manager_sites
  for select using (company_id in (select public.current_user_company_ids()));
grant select on public.manager_sites to authenticated;

-- 3) Invitaciones: permitir invitar como encargado con sus sedes
alter table public.invitations drop constraint invitations_role_check;
alter table public.invitations
  add constraint invitations_role_check check (role in ('member', 'encargado'));
alter table public.invitations
  add column if not exists site_ids uuid[] not null default '{}';

-- ----------------------------------------------------------------------------
-- Helpers de visibilidad (security definer: no recursión de RLS)
-- ----------------------------------------------------------------------------

-- Empresas donde el usuario tiene acceso PLENO (owner o member, no encargado).
create or replace function public.current_user_full_access_company_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select company_id from public.memberships
  where user_id = auth.uid() and role in ('owner', 'member')
$$;

-- Puestos que el usuario puede ver: todos los de sus empresas con acceso pleno,
-- más solo los de las sedes asignadas en las empresas donde es encargado.
create or replace function public.current_user_campaign_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select c.id from public.campaigns c
   where c.company_id in (select public.current_user_full_access_company_ids())
  union
  select c.id from public.campaigns c
   join public.manager_sites ms on ms.site_id = c.site_id and ms.user_id = auth.uid()
   where c.company_id in (
     select company_id from public.memberships where user_id = auth.uid() and role = 'encargado'
   )
$$;

-- ----------------------------------------------------------------------------
-- Reescritura de RLS: campaigns (lectura acotada; escritura solo acceso pleno)
-- ----------------------------------------------------------------------------
drop policy "campaigns_all_members" on public.campaigns;

create policy "campaigns_select" on public.campaigns
  for select using (id in (select public.current_user_campaign_ids()));
create policy "campaigns_insert" on public.campaigns
  for insert with check (company_id in (select public.current_user_full_access_company_ids()));
create policy "campaigns_update" on public.campaigns
  for update using (company_id in (select public.current_user_full_access_company_ids()))
  with check (company_id in (select public.current_user_full_access_company_ids()));
create policy "campaigns_delete" on public.campaigns
  for delete using (company_id in (select public.current_user_full_access_company_ids()));

-- candidates: acceso total a los candidatos de los puestos visibles (el encargado
-- gestiona los de sus sedes; el owner/member, todos).
drop policy "candidates_all_members" on public.candidates;
create policy "candidates_scoped" on public.candidates
  for all using (campaign_id in (select public.current_user_campaign_ids()))
  with check (campaign_id in (select public.current_user_campaign_ids()));

-- CVs en Storage: el nombre del objeto es '{slug}/{uuid}.ext'. Solo se puede leer
-- si el slug pertenece a un puesto visible para el usuario (acotado por sede).
drop policy "cvs_select_authenticated" on storage.objects;
create policy "cvs_select_visible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and split_part(name, '/', 1) in (
      select slug from public.campaigns where id in (select public.current_user_campaign_ids())
    )
  );

-- ----------------------------------------------------------------------------
-- RPCs (owner-only) para gestionar encargados y sus sedes
-- ----------------------------------------------------------------------------

-- Reemplaza create_invitation para aceptar rol + sedes (encargado).
drop function if exists public.create_invitation(text, text);
create or replace function public.create_invitation(p_email text, p_role text default 'member', p_site_ids uuid[] default '{}')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_company uuid; v_token text; v_id uuid; v_email text := lower(trim(p_email));
begin
  select company_id into v_company from public.memberships
    where user_id = auth.uid() and role = 'owner' order by created_at limit 1;
  if v_company is null then raise exception 'Solo el propietario puede invitar'; end if;
  if p_role not in ('member', 'encargado') then raise exception 'Rol no válido'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'Email no válido'; end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.company_id = v_company and lower(u.email) = v_email
  ) then raise exception 'Esa persona ya está en tu equipo'; end if;
  if p_role = 'encargado' then
    if coalesce(array_length(p_site_ids, 1), 0) = 0 then
      raise exception 'Elige al menos una sede para el encargado';
    end if;
    if exists (select 1 from unnest(p_site_ids) s(id)
               where s.id not in (select id from public.sites where company_id = v_company)) then
      raise exception 'Alguna sede no pertenece a tu empresa';
    end if;
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.invitations
    set token = v_token, status = 'pending', invited_by = auth.uid(), created_at = now(),
        accepted_at = null, expires_at = now() + interval '7 days',
        role = p_role, site_ids = case when p_role = 'encargado' then p_site_ids else '{}' end
    where company_id = v_company and email = v_email and status = 'pending'
    returning id into v_id;
  if v_id is null then
    insert into public.invitations(company_id, email, role, token, invited_by, site_ids)
      values (v_company, v_email, p_role, v_token, auth.uid(),
              case when p_role = 'encargado' then p_site_ids else '{}' end)
      returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;

-- accept_invitation: además del membership, crea las manager_sites si es encargado.
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare inv public.invitations; v_email text; s uuid;
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
    foreach s in array inv.site_ids loop
      insert into public.manager_sites(company_id, user_id, site_id)
        values (inv.company_id, auth.uid(), s)
        on conflict (user_id, site_id) do nothing;
    end loop;
  end if;
  update public.invitations set status = 'accepted', accepted_at = now() where id = inv.id;
  return jsonb_build_object('company_id', inv.company_id);
end;
$$;

-- set_member_access: el owner cambia el rol y/o las sedes de un miembro existente.
-- No puede tocar a otro owner ni a sí mismo. role en ('member','encargado').
create or replace function public.set_member_access(p_user_id uuid, p_role text, p_site_ids uuid[] default '{}')
returns void
language plpgsql security definer set search_path = public
as $$
declare v_company uuid;
begin
  select company_id into v_company from public.memberships
    where user_id = auth.uid() and role = 'owner' order by created_at limit 1;
  if v_company is null then raise exception 'Solo el propietario puede gestionar el equipo'; end if;
  if p_user_id = auth.uid() then raise exception 'No puedes cambiar tu propio rol'; end if;
  if p_role not in ('member', 'encargado') then raise exception 'Rol no válido'; end if;
  if not exists (select 1 from public.memberships where company_id = v_company and user_id = p_user_id and role <> 'owner') then
    raise exception 'Ese usuario no está en tu equipo';
  end if;
  if p_role = 'encargado' then
    if coalesce(array_length(p_site_ids, 1), 0) = 0 then raise exception 'Elige al menos una sede'; end if;
    if exists (select 1 from unnest(p_site_ids) s(id)
               where s.id not in (select id from public.sites where company_id = v_company)) then
      raise exception 'Alguna sede no pertenece a tu empresa';
    end if;
  end if;
  update public.memberships set role = p_role where company_id = v_company and user_id = p_user_id;
  delete from public.manager_sites where company_id = v_company and user_id = p_user_id;
  if p_role = 'encargado' then
    insert into public.manager_sites(company_id, user_id, site_id)
      select v_company, p_user_id, unnest(p_site_ids);
  end if;
end;
$$;

-- list_members: añade las sedes (ids) de cada encargado.
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
  where m.company_id in (select public.current_user_company_ids());
$$;

revoke all on function public.create_invitation(text, text, uuid[]) from public, anon;
revoke all on function public.set_member_access(uuid, text, uuid[]) from public, anon;
grant execute on function public.create_invitation(text, text, uuid[]) to authenticated;
grant execute on function public.set_member_access(uuid, text, uuid[]) to authenticated;
