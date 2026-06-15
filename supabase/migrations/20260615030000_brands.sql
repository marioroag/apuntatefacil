-- ============================================================================
-- Apúntate Fácil · marcas (feature Multi)
-- Una "marca" es una identidad reutilizable (nombre que ve el candidato, color
-- de acento, textos de bienvenida/gracias, mostrar logo). Entidad PROPIA,
-- separada de las sedes: una cadena puede tener varias marcas, y una marca puede
-- estar en varias sedes. Al crear o asignar un puesto a una marca, su apariencia
-- se COPIA al puesto (campaigns.branding), que sigue pudiendo sobreescribirla.
-- campaigns.brand_id es nullable: sin marca, el puesto va como hoy.
-- ============================================================================

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  accent text not null default '#4f46e5',
  welcome text not null default '',
  thanks text not null default '',
  show_logo boolean not null default true,
  created_at timestamptz not null default now()
);
create index brands_company_id_idx on public.brands(company_id);

alter table public.campaigns
  add column brand_id uuid references public.brands(id) on delete set null;
create index campaigns_brand_id_idx on public.campaigns(brand_id);

alter table public.brands enable row level security;

create policy "brands_all_members" on public.brands
  for all using (company_id in (select public.current_user_company_ids()))
  with check (company_id in (select public.current_user_company_ids()));

grant select, insert, update, delete on public.brands to authenticated;

-- El candidato ve el nombre de la MARCA del puesto (si tiene); si no, el de la
-- empresa. Es el único cambio para que la marca llegue al formulario público;
-- el resto de la apariencia ya viaja en campaigns.branding.
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
    'company_name', coalesce(b.name, co.name)
  )
  from public.campaigns c
  join public.companies co on co.id = c.company_id
  left join public.brands b on b.id = c.brand_id
  where c.slug = p_slug;
$$;
