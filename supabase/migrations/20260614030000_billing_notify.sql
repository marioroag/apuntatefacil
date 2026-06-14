-- Email del dueño de una empresa (para avisos por email). Solo service_role.
create or replace function public.get_company_owner_email(p_company uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.company_id = p_company and m.role = 'owner'
  order by m.created_at asc
  limit 1
$$;
revoke all on function public.get_company_owner_email(uuid) from public, anon, authenticated;
grant execute on function public.get_company_owner_email(uuid) to service_role;
