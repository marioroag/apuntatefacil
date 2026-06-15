-- ============================================================================
-- Apúntate Fácil · invitaciones pendientes del usuario actual (por su email)
-- Para que un invitado que entra (aunque no venga por el enlace, p.ej. tras
-- confirmar el email) vea que le han invitado y se UNA a esa empresa, en vez de
-- caer en el onboarding (crear empresa) y el muro de pago. La empresa ya la paga
-- el propietario. Security definer: el invitado aún no es miembro.
-- ============================================================================

create or replace function public.my_pending_invitations()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', i.id, 'token', i.token, 'company_name', co.name, 'role', i.role
    ) order by i.created_at desc),
    '[]'::jsonb
  )
  from public.invitations i
  join public.companies co on co.id = i.company_id
  join auth.users u on u.id = auth.uid()
  where i.status = 'pending'
    and i.expires_at > now()
    and lower(i.email) = lower(u.email);
$$;

revoke all on function public.my_pending_invitations() from public, anon;
grant execute on function public.my_pending_invitations() to authenticated;
