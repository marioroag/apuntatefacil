-- ============================================================================
-- Apúntate Fácil · endurecimiento de seguridad de las invitaciones
-- Tras revisión adversarial. PROBLEMA RAÍZ (alta): la tabla invitations tenía
-- grants de DML directo + política FOR ALL acotada solo por empresa (no por rol),
-- así que cualquier MIEMBRO podía insertar/editar/borrar invitaciones por PostgREST
-- saltándose el RPC owner-only (escalada de privilegios + sabotaje).
-- Cierre: SELECT solo para owners, y TODA escritura por RPCs security definer
-- que exigen rol owner. Más: caducidad, filtro de estado, email confirmado.
-- ============================================================================

-- Caducidad de tokens (un enlace filtrado no vale para siempre).
alter table public.invitations
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days');

-- Helper: empresas donde el usuario actual es OWNER (security definer, como
-- current_user_company_ids(), para no depender de la RLS de memberships).
create or replace function public.current_user_owner_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.memberships where user_id = auth.uid() and role = 'owner'
$$;

-- Quitar la escritura directa por PostgREST y la política FOR ALL.
revoke insert, update, delete on public.invitations from authenticated;
drop policy if exists "invitations_members" on public.invitations;

-- Solo los OWNER ven las invitaciones de su empresa (incluye el token, que es
-- de confianza en manos del propietario; los miembros no lo ven).
create policy "invitations_select_owner" on public.invitations
  for select using (company_id in (select public.current_user_owner_company_ids()));

-- create_invitation: selección de empresa determinista (order by) + caducidad.
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
    from public.memberships where user_id = auth.uid() and role = 'owner'
    order by created_at limit 1;
  if v_company is null then
    raise exception 'Solo el propietario puede invitar';
  end if;
  if p_role not in ('member') then
    raise exception 'Rol no válido';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Email no válido';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.company_id = v_company and lower(u.email) = v_email
  ) then
    raise exception 'Esa persona ya está en tu equipo';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.invitations
    set token = v_token, status = 'pending', invited_by = auth.uid(), created_at = now(),
        accepted_at = null, expires_at = now() + interval '7 days'
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

-- revoke_invitation: revocar una invitación pendiente. Solo el owner de su empresa.
create or replace function public.revoke_invitation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.invitations where id = p_id;
  if v_company is null then
    raise exception 'Invitación no encontrada';
  end if;
  if not exists (
    select 1 from public.memberships where user_id = auth.uid() and company_id = v_company and role = 'owner'
  ) then
    raise exception 'Solo el propietario puede revocar invitaciones';
  end if;
  update public.invitations set status = 'revoked' where id = p_id and status = 'pending';
end;
$$;

-- get_invitation: solo pendientes y no caducadas.
create or replace function public.get_invitation(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('email', i.email, 'role', i.role, 'status', i.status, 'company_name', co.name)
  from public.invitations i
  join public.companies co on co.id = i.company_id
  where i.token = p_token and i.status = 'pending' and i.expires_at > now();
$$;

-- accept_invitation: exige email confirmado + invitación vigente.
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
  if inv.expires_at <= now() then
    raise exception 'Esta invitación ha caducado';
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Confirma tu email antes de aceptar la invitación';
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

revoke all on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;
