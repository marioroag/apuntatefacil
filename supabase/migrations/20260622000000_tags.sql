-- ============================================================================
-- Apúntate Fácil · Etiquetas (clasificación libre del empresario)
-- Capa de clasificación que pone el empresario sobre cada candidato, además del
-- estado y la valoración. El candidato NUNCA las ve ni las rellena.
--   tags            -> vocabulario a nivel EMPRESA (reutilizable, normalizado).
--   candidate_tags  -> qué etiquetas tiene cada candidato (relación N:M).
-- Permisos: owner/member crean/renombran/borran el vocabulario; el encargado solo
-- aplica/quita etiquetas existentes a candidatos de SUS sedes. Aislamiento real en
-- RLS reutilizando current_user_campaign_ids() (mismo predicado que candidates).
-- El formulario público anónimo NO toca estas tablas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create index tags_company_id_idx on public.tags(company_id);
-- Unicidad case-insensitive por empresa: 'apto', 'Apto' y 'APTO' son la misma.
-- (la normalización de espacios la garantiza el trigger de abajo)
create unique index tags_company_name_lower_idx on public.tags(company_id, lower(name));

create table public.candidate_tags (
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_id, tag_id)
);
-- Índice por tag_id: el filtro "candidatos con la etiqueta X" y el recuento de uso
-- en el modal de gestión van por aquí.
create index candidate_tags_tag_id_idx on public.candidate_tags(tag_id);
create index candidate_tags_candidate_id_idx on public.candidate_tags(candidate_id);

-- ----------------------------------------------------------------------------
-- Normalización del nombre de etiqueta (trim + colapsar espacios)
-- Hace efectiva la unicidad case-insensitive: sin esto, 'apto' y 'apto ' serían
-- distintos para el índice lower(name). Se aplica en insert y update.
-- ----------------------------------------------------------------------------
create or replace function public.normalize_tag_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  if char_length(new.name) = 0 then
    raise exception 'TAG_NAME_EMPTY';
  end if;
  return new;
end;
$$;
create trigger tags_normalize
  before insert or update on public.tags
  for each row execute function public.normalize_tag_name();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.tags enable row level security;
alter table public.candidate_tags enable row level security;

-- tags: cualquier miembro de la empresa LEE el vocabulario (el encargado lo
-- necesita para aplicar etiquetas). Crear/renombrar/borrar solo acceso PLENO
-- (owner/member): el encargado no crea vocabulario.
create policy "tags_select" on public.tags
  for select using (company_id in (select public.current_user_company_ids()));
create policy "tags_insert" on public.tags
  for insert with check (company_id in (select public.current_user_full_access_company_ids()));
create policy "tags_update" on public.tags
  for update using (company_id in (select public.current_user_full_access_company_ids()))
  with check (company_id in (select public.current_user_full_access_company_ids()));
create policy "tags_delete" on public.tags
  for delete using (company_id in (select public.current_user_full_access_company_ids()));

-- candidate_tags: aplicar/quitar acotado a los candidatos VISIBLES para el usuario
-- (el encargado, solo los de sus sedes; owner/member, todos). Se reutiliza el mismo
-- predicado que la RLS de candidates (campaign_id in current_user_campaign_ids()).
-- En el insert, además, la etiqueta debe pertenecer a una empresa del usuario: así
-- nadie puede pegar una etiqueta ajena a un candidato.
create policy "candidate_tags_select" on public.candidate_tags
  for select using (
    candidate_id in (
      select id from public.candidates where campaign_id in (select public.current_user_campaign_ids())
    )
  );
create policy "candidate_tags_insert" on public.candidate_tags
  for insert with check (
    candidate_id in (
      select id from public.candidates where campaign_id in (select public.current_user_campaign_ids())
    )
    and tag_id in (
      select id from public.tags where company_id in (select public.current_user_company_ids())
    )
  );
create policy "candidate_tags_delete" on public.candidate_tags
  for delete using (
    candidate_id in (
      select id from public.candidates where campaign_id in (select public.current_user_campaign_ids())
    )
  );

-- Privilegios de tabla. El rol anon NO recibe nada (el formulario público no toca
-- etiquetas). authenticated opera y la RLS lo acota. candidate_tags no se actualiza
-- (solo se crea/borra la relación), por eso sin update.
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, delete on public.candidate_tags to authenticated;
