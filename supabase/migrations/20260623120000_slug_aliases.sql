-- Alias de slug: permite cambiar el enlace público de un puesto SIN romper el viejo.
-- Al cambiar el slug, el anterior queda como ALIAS y sigue resolviendo al mismo puesto;
-- el nuevo pasa a ser el principal (el que se comparte y el que muestra la barra).

create table public.campaign_slug_aliases (
  alias text primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index campaign_slug_aliases_campaign_idx on public.campaign_slug_aliases(campaign_id);

alter table public.campaign_slug_aliases enable row level security;
-- Gestión por la empresa dueña del puesto. La lectura pública la hace el RPC (security
-- definer), así que la tabla no necesita acceso para anon.
create policy "aliases_scoped" on public.campaign_slug_aliases
  for all using (campaign_id in (select public.current_user_campaign_ids()))
  with check (campaign_id in (select public.current_user_campaign_ids()));

-- El formulario público resuelve por el slug ACTUAL o por un alias (enlace viejo). El
-- slug canónico tiene prioridad (coalesce), así que nunca hay ambigüedad y se devuelve
-- siempre el puesto con su slug actual.
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
    'company_name', coalesce(b.name, co.name),
    'logo_path', b.logo_path,
    'banner_path', b.banner_path
  )
  from public.campaigns c
  join public.companies co on co.id = c.company_id
  left join public.brands b on b.id = c.brand_id
  where c.id = coalesce(
    (select id from public.campaigns where slug = p_slug),
    (select campaign_id from public.campaign_slug_aliases where alias = p_slug)
  );
$$;
-- El formulario público lo llama anónimo (create or replace ya preserva el grant; explícito por claridad).
grant execute on function public.get_public_campaign(text) to anon, authenticated;

-- Cambia el enlace (slug) de un puesto: el viejo queda como alias (sigue resolviendo) y
-- el nuevo pasa a principal. Solo owner/member (NO encargado, igual que editar el puesto).
-- Valida que el nuevo no choque con otro slug ni con un alias ajeno. Devuelve el nuevo slug.
create or replace function public.set_campaign_slug(p_campaign_id uuid, p_new_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_new text := trim(p_new_slug);
begin
  if p_campaign_id not in (
    select id from public.campaigns
    where company_id in (select public.current_user_full_access_company_ids())
  ) then
    raise exception 'No autorizado para cambiar este puesto';
  end if;
  if v_new is null or v_new = '' then
    raise exception 'El enlace no puede estar vacío';
  end if;
  select slug into v_old from public.campaigns where id = p_campaign_id;
  if v_old is null then
    raise exception 'Puesto no encontrado';
  end if;
  if v_old = v_new then
    return v_new;
  end if;
  if exists (select 1 from public.campaigns where slug = v_new and id <> p_campaign_id)
     or exists (select 1 from public.campaign_slug_aliases where alias = v_new and campaign_id <> p_campaign_id) then
    raise exception 'Ese enlace ya está en uso';
  end if;
  -- el viejo pasa a alias (si no lo era ya); si el nuevo era alias de este mismo puesto,
  -- lo liberamos (ahora es el principal).
  insert into public.campaign_slug_aliases (alias, campaign_id)
    values (v_old, p_campaign_id) on conflict (alias) do nothing;
  delete from public.campaign_slug_aliases where alias = v_new and campaign_id = p_campaign_id;
  update public.campaigns set slug = v_new where id = p_campaign_id;
  return v_new;
end;
$$;

grant execute on function public.set_campaign_slug(uuid, text) to authenticated;
