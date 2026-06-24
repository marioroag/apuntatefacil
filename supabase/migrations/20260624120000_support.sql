-- ============================================================================
-- Apúntate Fácil · soporte (formulario de contacto/ayuda)
-- Una sola tabla para las consultas de soporte. Llegan desde dos sitios:
--   · la landing (lead anónimo, source = 'landing'): sin empresa ni usuario
--   · el panel (cliente autenticado, source = 'app'): con empresa y plan
-- El alta va SIEMPRE por el RPC security definer (como submit_application): el rol
-- anon no toca la tabla directo. Las consultas las lee el equipo de soporte por
-- service_role (Studio / edge function), nunca el merchant: no hay policies de SELECT.
-- ============================================================================

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  name text,
  message text not null,
  source text not null default 'app' check (source in ('app', 'landing')),
  plan text,
  page text,
  created_at timestamptz not null default now()
);
create index support_tickets_created_at_idx on public.support_tickets(created_at desc);
create index support_tickets_company_id_idx on public.support_tickets(company_id);

-- RLS activado y SIN policies: nadie (anon/authenticated) lee ni escribe directo.
-- El alta entra por el RPC de abajo (security definer); la lectura es de soporte.
alter table public.support_tickets enable row level security;

-- service_role (la edge function notify-support) sí lee la tabla para componer el
-- email. En este proyecto los privilegios se conceden por tabla de forma explícita
-- (ver init: grants a authenticated); service_role no hereda nada, así que hay que
-- dárselo a mano o el .select() de la función daría "permission denied".
grant select on public.support_tickets to service_role;

-- Alta de una consulta de soporte. Anónima desde la landing, identificada desde el
-- panel. La empresa y el plan solo se asocian si quien escribe está autenticado Y es
-- miembro de esa empresa (validado contra current_user_company_ids), nunca a ciegas.
create or replace function public.submit_support_request(
  p_email text,
  p_message text,
  p_name text default null,
  p_source text default 'app',
  p_page text default null,
  p_company_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_plan text;
  v_ticket uuid;
  v_email text := nullif(trim(p_email), '');
  v_message text := nullif(trim(p_message), '');
  v_source text := coalesce(nullif(trim(p_source), ''), 'app');
begin
  if v_message is null then
    raise exception 'El mensaje no puede estar vacío';
  end if;
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'Hace falta un email válido';
  end if;
  if v_source not in ('app', 'landing') then
    v_source := 'app';
  end if;

  -- Empresa + plan: solo si está autenticado y es miembro de la empresa indicada.
  if v_user is not null and p_company_id is not null
     and p_company_id in (select public.current_user_company_ids()) then
    v_company := p_company_id;
    select plan into v_plan from public.companies where id = v_company;
  end if;

  insert into public.support_tickets(company_id, user_id, email, name, message, source, plan, page)
    values (v_company, v_user, v_email, nullif(trim(p_name), ''), v_message,
            v_source, v_plan, nullif(trim(p_page), ''))
    returning id into v_ticket;
  return v_ticket;
end;
$$;

revoke all on function public.submit_support_request(text, text, text, text, text, uuid) from public;
grant execute on function public.submit_support_request(text, text, text, text, text, uuid) to anon, authenticated;
