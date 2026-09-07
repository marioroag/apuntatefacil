-- Lo que necesita el prerender de la página pública (api/publico.ts) y el
-- sitemap (api/sitemap.ts) para que Google for Jobs lea cada anuncio.
--
-- 1. get_public_campaign devuelve además cuándo se creó el puesto (datePosted
--    del JobPosting) y su sector (industry). Los dos ya se enseñan o se deducen
--    de la propia página; no es información nueva hacia fuera.
-- 2. public_jobs_sitemap: la lista de puestos activos CON anuncio, que es
--    exactamente el filtro con el que el prerender decide si una página se
--    indexa. Solo slug, título y marca (lo que hace falta para escribir su
--    URL canónica): nada de la empresa que la página no diga ya. Sin lastmod,
--    porque no se guarda cuándo se tocó un anuncio y una fecha inventada no
--    ayuda a nadie.
--    Sin anuncio no se lista, porque su página lleva noindex y una URL en el
--    sitemap que Google no puede indexar es una contradicción que descuenta.

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
    'sector', c.sector,
    'created_at', c.created_at,
    'fields', c.fields,
    'branding', c.branding,
    'anuncio', c.anuncio,
    'location', c.location,
    'company_name', coalesce(b.name, co.name),
    'company_description', co.descripcion,
    'retencion_meses', co.retencion_meses,
    'logo_path', b.logo_path,
    'banner_path', b.banner_path,
    'others', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', o.slug,
        'title', o.title,
        'location', o.location,
        'brand_label', coalesce(ob.name, co.name),
        'banner_path', ob.banner_path
      ) order by o.created_at desc)
      from (
        select o2.* from public.campaigns o2
        where o2.company_id = c.company_id
          and o2.id <> c.id
          and o2.status = 'activa'
        order by o2.created_at desc
        limit 5
      ) o
      left join public.brands ob on ob.id = o.brand_id
    ), '[]'::jsonb)
  )
  from public.campaigns c
  join public.companies co on co.id = c.company_id
  left join public.brands b on b.id = c.brand_id
  where c.id = coalesce(
    (select id from public.campaigns where slug = p_slug),
    (select campaign_id from public.campaign_slug_aliases where alias = p_slug)
  );
$$;

-- "Con anuncio" es la misma pregunta que hace hayAnuncio en el cliente: alguno
-- de sus campos con algo. Se comprueba aquí con los mismos nombres de campo.
create or replace function public.public_jobs_sitemap()
returns table (slug text, title text, brand_label text)
language sql
stable
security definer
set search_path = public
as $$
  select c.slug, c.title, coalesce(b.name, co.name) as brand_label
  from public.campaigns c
  join public.companies co on co.id = c.company_id
  left join public.brands b on b.id = c.brand_id
  where c.status = 'activa'
    and c.anuncio is not null
    and (
      coalesce(c.anuncio->>'descripcion', '') <> ''
      or coalesce(c.anuncio->>'modalidad', '') <> ''
      or c.anuncio->>'salarioMin' is not null
      or c.anuncio->>'salarioMax' is not null
      or coalesce(c.anuncio->>'contrato', '') <> ''
      or coalesce(c.anuncio->>'jornada', '') <> ''
      or coalesce(c.anuncio->>'experiencia', '') <> ''
      or coalesce(c.anuncio->>'estudios', '') <> ''
      or jsonb_array_length(coalesce(c.anuncio->'conocimientos', '[]'::jsonb)) > 0
      or jsonb_array_length(coalesce(c.anuncio->'idiomas', '[]'::jsonb)) > 0
    )
  order by c.created_at desc
  limit 5000;
$$;

revoke all on function public.public_jobs_sitemap() from public;
grant execute on function public.public_jobs_sitemap() to anon, authenticated, service_role;
