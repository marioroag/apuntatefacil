-- Multi-equipo: un usuario puede pertenecer a varias empresas y cambiar entre ellas.
-- El modelo ya lo permite (memberships PK (company_id,user_id)). Faltaban dos RPC:
-- la lista de empresas del usuario (para el cambiador) y los miembros de UNA empresa.
-- Aditivo: NO toca list_members() (que el frontend en vivo sigue usando) hasta que
-- el frontend nuevo lo reemplace.

-- Empresas del usuario (con su rol en cada una), ordenadas por antigüedad.
create or replace function public.my_companies()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'accent', c.accent,
    'plan', c.plan,
    'subscription_status', c.subscription_status,
    'billing_interval', c.billing_interval,
    'cancel_at_period_end', c.cancel_at_period_end,
    'role', m.role
  ) order by c.created_at asc), '[]'::jsonb)
  from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;
grant execute on function public.my_companies() to authenticated;

-- Miembros de UNA empresa (la activa), no de todas. Comprueba que el llamante pertenece
-- a esa empresa (si no, devuelve lista vacía). Sustituye a list_members() para el roster.
create or replace function public.list_company_members(p_company_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', m.user_id,
    'email', u.email,
    'role', m.role,
    'is_self', m.user_id = auth.uid(),
    'site_ids', coalesce((select jsonb_agg(ms.site_id) from public.manager_sites ms
                          where ms.user_id = m.user_id and ms.company_id = m.company_id), '[]'::jsonb)
  ) order by (m.role = 'owner') desc, u.email), '[]'::jsonb)
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.company_id = p_company_id
    and p_company_id in (select public.current_user_company_ids());
$$;
grant execute on function public.list_company_members(uuid) to authenticated;
