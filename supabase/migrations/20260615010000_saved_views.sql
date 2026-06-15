-- ============================================================================
-- Apúntate Fácil · vistas guardadas (feature Pro/Multi)
-- Una vista guarda una combinación de filtros del panel con un nombre.
--   scope='global'   -> campaign_id NULL, vale para TODOS los puestos.
--                       Solo guarda búsqueda + estados + orden (universales).
--   scope='campaign' -> campaign_id NOT NULL, vive dentro de un puesto.
--                       Además puede guardar filtros de valor (atados a sus campos).
-- payload jsonb: { search, statuses[], valueFilters[{fieldId,label,value}], sort{key,dir} }
-- Multi-tenant: acotado por empresa con el mismo patrón que campaigns/candidates.
-- ============================================================================

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text not null,
  scope text not null check (scope in ('global', 'campaign')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- Coherencia: global sin puesto; por puesto con puesto.
  constraint saved_views_scope_chk check (
    (scope = 'global' and campaign_id is null) or
    (scope = 'campaign' and campaign_id is not null)
  )
);
create index saved_views_company_id_idx on public.saved_views(company_id);
create index saved_views_campaign_id_idx on public.saved_views(campaign_id);

alter table public.saved_views enable row level security;

-- Acceso total a las vistas de la propia empresa (mismo patrón que campaigns).
create policy "saved_views_all_members" on public.saved_views
  for all using (company_id in (select public.current_user_company_ids()))
  with check (company_id in (select public.current_user_company_ids()));

grant select, insert, update, delete on public.saved_views to authenticated;
