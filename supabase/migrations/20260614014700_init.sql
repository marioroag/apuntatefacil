-- ============================================================================
-- Criba · esquema inicial (multi-tenant)
-- Empresas (companies) <- memberships -> auth.users. Cada empresa tiene puestos
-- (campaigns) y candidatos (candidates). El formulario público es anónimo y
-- escribe vía RPC security definer; los miembros acceden a sus datos vía RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  accent text not null default '#4F46E5',
  plan text not null default 'trial' check (plan in ('trial','esencial','pro','multi')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  slug text not null unique,
  title text not null,
  sector text not null default '',
  location text not null default '',
  status text not null default 'activa' check (status in ('activa','pausada','cerrada')),
  milanuncios_url text,
  fields jsonb not null default '[]'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index campaigns_company_id_idx on public.campaigns(company_id);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'nuevo' check (status in ('nuevo','contactado','entrevista','contratado','descartado')),
  source text not null default 'enlace' check (source in ('milanuncios','enlace','qr')),
  rating int not null default 0 check (rating between 0 and 3),
  notes text not null default '',
  cv_path text,
  created_at timestamptz not null default now()
);
create index candidates_campaign_id_idx on public.candidates(campaign_id);
create index candidates_company_id_idx on public.candidates(company_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Helper: ids de las empresas del usuario actual (definido tras crear las tablas;
-- evita recursión de RLS al consultar memberships desde las políticas).
create or replace function public.current_user_company_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.memberships where user_id = auth.uid()
$$;

alter table public.companies enable row level security;
alter table public.memberships enable row level security;
alter table public.campaigns enable row level security;
alter table public.candidates enable row level security;

-- companies: solo miembros leen/actualizan su empresa. Alta vía RPC create_company.
create policy "companies_select_members" on public.companies
  for select using (id in (select public.current_user_company_ids()));
create policy "companies_update_members" on public.companies
  for update using (id in (select public.current_user_company_ids()))
  with check (id in (select public.current_user_company_ids()));

-- memberships: el usuario ve su propia fila y las de su empresa. Alta vía RPC.
create policy "memberships_select" on public.memberships
  for select using (user_id = auth.uid() or company_id in (select public.current_user_company_ids()));

-- campaigns: acceso total a los puestos de la propia empresa.
create policy "campaigns_all_members" on public.campaigns
  for all using (company_id in (select public.current_user_company_ids()))
  with check (company_id in (select public.current_user_company_ids()));

-- candidates: acceso total a los candidatos de la propia empresa.
-- El alta anónima (formulario público) NO pasa por aquí, va por submit_application.
create policy "candidates_all_members" on public.candidates
  for all using (company_id in (select public.current_user_company_ids()))
  with check (company_id in (select public.current_user_company_ids()));

-- Privilegios de tabla. El rol "authenticated" opera sobre sus datos y la RLS los
-- acota a su empresa. El rol "anon" NO recibe acceso directo a las tablas: el
-- formulario público escribe solo a través de los RPC security definer.
grant usage on schema public to anon, authenticated;
grant select, update on public.companies to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.candidates to authenticated;

-- ----------------------------------------------------------------------------
-- RPCs
-- ----------------------------------------------------------------------------

-- Onboarding: crea empresa + membership owner para el usuario actual.
create or replace function public.create_company(p_name text, p_accent text default '#4F46E5')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare cid uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  insert into public.companies(name, accent)
    values (coalesce(nullif(trim(p_name), ''), 'Mi empresa'), coalesce(p_accent, '#4F46E5'))
    returning id into cid;
  insert into public.memberships(company_id, user_id, role)
    values (cid, auth.uid(), 'owner');
  return cid;
end;
$$;

-- Lectura pública de un puesto por slug (solo campos públicos, para el formulario).
create or replace function public.get_public_campaign(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'slug', c.slug,
    'title', c.title,
    'status', c.status,
    'fields', c.fields,
    'branding', c.branding,
    'company_name', co.name
  )
  from public.campaigns c
  join public.companies co on co.id = c.company_id
  where c.slug = p_slug;
$$;

-- Envío anónimo de candidatura. Valida que el puesto existe y no está cerrado.
create or replace function public.submit_application(
  p_slug text,
  p_answers jsonb,
  p_source text default 'enlace',
  p_cv_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cmp public.campaigns;
  cand_id uuid;
begin
  select * into cmp from public.campaigns where slug = p_slug;
  if not found then
    raise exception 'Puesto no encontrado';
  end if;
  if cmp.status = 'cerrada' then
    raise exception 'Este puesto ya no acepta candidaturas';
  end if;
  insert into public.candidates(campaign_id, company_id, answers, source, cv_path, status)
    values (cmp.id, cmp.company_id, coalesce(p_answers, '{}'::jsonb),
            coalesce(p_source, 'enlace'), p_cv_path, 'nuevo')
    returning id into cand_id;
  return cand_id;
end;
$$;

-- Permisos de ejecución
revoke all on function public.create_company(text, text) from public, anon;
grant execute on function public.create_company(text, text) to authenticated;
grant execute on function public.get_public_campaign(text) to anon, authenticated;
grant execute on function public.submit_application(text, jsonb, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Storage: bucket privado para los CV
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('cvs', 'cvs', false)
  on conflict (id) do nothing;

-- Cualquiera (incluido el candidato anónimo) puede SUBIR un CV al bucket cvs.
create policy "cvs_insert_anyone" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'cvs');

-- Solo usuarios autenticados (merchants) pueden leer/firmar CVs.
create policy "cvs_select_authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs');
