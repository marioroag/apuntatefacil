-- ============================================================================
-- Apúntate Fácil · listado de cuentas para el panel de admin (solo staff)
-- admin_accounts(): todas las empresas con su plan, dueño, nº de usuarios,
-- puestos y candidatos, para el drill-down de "Cuentas registradas".
-- admin_company_detail(id): el detalle de una cuenta (usuarios con último
-- acceso + puestos con sus candidatos). Mismo gate is_support_staff que
-- admin_overview; security definer porque lee auth.users y cruza empresas.
-- ============================================================================

create or replace function public.admin_accounts()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v jsonb;
begin
  if not public.is_support_staff() then
    raise exception 'No autorizado';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'plan', c.plan,
    'interval', c.billing_interval,
    'subscription_status', c.subscription_status,
    'created_at', c.created_at,
    'users', (select count(*) from public.memberships m where m.company_id = c.id),
    -- El primer owner por antigüedad hace de "email de contacto" de la cuenta.
    'owner_email', (
      select u.email
      from public.memberships m
      join auth.users u on u.id = m.user_id
      where m.company_id = c.id and m.role = 'owner'
      order by m.created_at
      limit 1
    ),
    'campaigns', (select count(*) from public.campaigns ca where ca.company_id = c.id),
    'candidates', (select count(*) from public.candidates cd where cd.company_id = c.id),
    'candidates_7d', (select count(*) from public.candidates cd where cd.company_id = c.id and cd.created_at >= now() - interval '7 days')
  ) order by c.created_at desc), '[]'::jsonb)
  into v
  from public.companies c;

  return v;
end;
$$;

grant execute on function public.admin_accounts() to authenticated;

create or replace function public.admin_company_detail(p_company uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v jsonb;
begin
  if not public.is_support_staff() then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'email', u.email,
        'role', m.role,
        'created_at', m.created_at,
        'last_sign_in_at', u.last_sign_in_at
      ) order by m.created_at)
      from public.memberships m
      join auth.users u on u.id = m.user_id
      where m.company_id = p_company
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ca.id,
        'title', ca.title,
        'status', ca.status,
        'created_at', ca.created_at,
        'candidates', (select count(*) from public.candidates cd where cd.campaign_id = ca.id)
      ) order by ca.created_at desc)
      from public.campaigns ca
      where ca.company_id = p_company
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

grant execute on function public.admin_company_detail(uuid) to authenticated;
