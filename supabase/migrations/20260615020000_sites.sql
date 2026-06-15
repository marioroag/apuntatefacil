-- ============================================================================
-- Apúntate Fácil · sedes (feature Multi)
-- Una "sede" agrupa puestos de un mismo local. Entidad PROPIA, separada de las
-- marcas (una cadena puede tener varias sedes de la misma marca, o varias marcas
-- en una sede). La estructura es OPCIONAL: campaigns.site_id es nullable, así que
-- sin sedes la app funciona igual que hoy (no fuerza migración de datos).
-- Sedes ILIMITADAS dentro de Multi: nunca un contador de asientos.
-- ============================================================================

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  city text not null default '',
  created_at timestamptz not null default now()
);
create index sites_company_id_idx on public.sites(company_id);

-- Un puesto pertenece como mucho a una sede. Al borrar la sede, sus puestos
-- quedan "sin sede" (no se borran): degradado seguro, coherente con antisecuestro.
alter table public.campaigns
  add column site_id uuid references public.sites(id) on delete set null;
create index campaigns_site_id_idx on public.campaigns(site_id);

alter table public.sites enable row level security;

-- Acceso total a las sedes de la propia empresa (mismo patrón que campaigns).
create policy "sites_all_members" on public.sites
  for all using (company_id in (select public.current_user_company_ids()))
  with check (company_id in (select public.current_user_company_ids()));

grant select, insert, update, delete on public.sites to authenticated;
