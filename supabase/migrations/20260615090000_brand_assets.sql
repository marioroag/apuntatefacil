-- ============================================================================
-- Apúntate Fácil · imágenes de marca (logo + banner) para los formularios
-- Las marcas (Multi) pueden subir una foto de perfil (logo) y un banner que se
-- muestran en el formulario público. Las imágenes son PÚBLICAS (el formulario es
-- anónimo), en su propio bucket. La escritura la limita la empresa por el prefijo
-- del path ({company_id}/...), a acceso pleno (owner/member).
-- ============================================================================

alter table public.brands add column logo_path text;
alter table public.brands add column banner_path text;

-- Bucket público para logos/banners de marca.
insert into storage.buckets (id, name, public)
  values ('brand-assets', 'brand-assets', true)
  on conflict (id) do nothing;

-- Lectura pública (el formulario anónimo muestra las imágenes).
create policy "brand_assets_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'brand-assets');

-- Escritura solo del owner/member de la empresa dueña (prefijo del path = company_id).
create policy "brand_assets_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and split_part(name, '/', 1) in (select cid::text from public.current_user_full_access_company_ids() cid)
  );
create policy "brand_assets_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and split_part(name, '/', 1) in (select cid::text from public.current_user_full_access_company_ids() cid)
  )
  with check (
    bucket_id = 'brand-assets'
    and split_part(name, '/', 1) in (select cid::text from public.current_user_full_access_company_ids() cid)
  );
create policy "brand_assets_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and split_part(name, '/', 1) in (select cid::text from public.current_user_full_access_company_ids() cid)
  );

-- El formulario público recibe también el logo y banner de la marca (si tiene).
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
  where c.slug = p_slug;
$$;
