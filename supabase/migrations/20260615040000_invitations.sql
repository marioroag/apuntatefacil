-- ============================================================================
-- Apúntate Fácil · invitaciones de equipo (TODOS los planes)
-- El propietario invita por email; llega un enlace; al aceptarlo, esa persona se
-- une a la empresa. Usuarios ILIMITADOS: no se cobra por miembro. Es la base del
-- rol "encargado" (Multi 4).
-- ============================================================================

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('member')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index invitations_company_id_idx on public.invitations(company_id);
create index invitations_token_idx on public.invitations(token);

alter table public.invitations enable row level security;

-- Los miembros de la empresa ven y gestionan (revocan) sus invitaciones.
create policy "invitations_members" on public.invitations
  for all using (company_id in (select public.current_user_company_ids()))
  with check (company_id in (select public.current_user_company_ids()));

grant select, insert, update, delete on public.invitations to authenticated;

-- ----------------------------------------------------------------------------
-- RPCs
-- ----------------------------------------------------------------------------

-- Crear invitación. Solo el propietario. Devuelve el token (el cliente arma el
-- enlace y dispara el email). Token = dos uuid sin guiones (sin pgcrypto).
create or replace function public.create_invitation(p_email text, p_role text default 'member')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_token text;
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  select company_id into v_company
    from public.memberships where user_id = auth.uid() and role = 'owner' limit 1;
  if v_company is null then
    raise exception 'Solo el propietario puede invitar';
  end if;
  if p_role not in ('member') then
    raise exception 'Rol no válido';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Email no válido';
  end if;
  -- Si ya es miembro, no tiene sentido invitar.
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.company_id = v_company and lower(u.email) = v_email
  ) then
    raise exception 'Esa persona ya está en tu equipo';
  end if;
  -- Reutiliza una invitación pendiente al mismo email (regenera token).
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.invitations
    set token = v_token, status = 'pending', invited_by = auth.uid(), created_at = now(), accepted_at = null
    where company_id = v_company and email = v_email and status = 'pending'
    returning id into v_id;
  if v_id is null then
    insert into public.invitations(company_id, email, role, token, invited_by)
      values (v_company, v_email, p_role, v_token, auth.uid())
      returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;

-- Leer una invitación por token (la usa el invitado, que aún no es miembro).
create or replace function public.get_invitation(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'email', i.email,
    'role', i.role,
    'status', i.status,
    'company_name', co.name
  )
  from public.invitations i
  join public.companies co on co.id = i.company_id
  where i.token = p_token;
$$;

-- Aceptar una invitación: une al usuario actual a la empresa. Exige que su email
-- coincida con el de la invitación.
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations;
  v_email text;
begin
  select * into inv from public.invitations where token = p_token;
  if not found then
    raise exception 'Invitación no encontrada';
  end if;
  if inv.status <> 'pending' then
    raise exception 'Esta invitación ya no está disponible';
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if v_email <> inv.email then
    raise exception 'Esta invitación es para otro correo';
  end if;
  insert into public.memberships(company_id, user_id, role)
    values (inv.company_id, auth.uid(), inv.role)
    on conflict (company_id, user_id) do nothing;
  update public.invitations set status = 'accepted', accepted_at = now() where id = inv.id;
  return jsonb_build_object('company_id', inv.company_id);
end;
$$;

-- Listar los miembros de la empresa del usuario (con su email).
create or replace function public.list_members()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('user_id', m.user_id, 'email', u.email, 'role', m.role, 'is_self', m.user_id = auth.uid())
      order by (m.role = 'owner') desc, u.email
    ),
    '[]'::jsonb
  )
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.company_id in (select public.current_user_company_ids());
$$;

-- Permisos de ejecución
revoke all on function public.create_invitation(text, text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.get_invitation(text) from public, anon;
revoke all on function public.list_members() from public, anon;
grant execute on function public.create_invitation(text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.get_invitation(text) to authenticated;
grant execute on function public.list_members() to authenticated;
