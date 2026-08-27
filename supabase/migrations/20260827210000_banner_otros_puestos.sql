-- ==========================================================================
-- LA FOTO DE CADA "otro puesto abierto" (ago 2026).
--
-- En la página del anuncio, las tarjetas de los demás puestos de la empresa
-- pasan a usar de fondo la foto de cabecera de SU marca. Sin foto se quedan
-- blancas, así que el dato tiene que llegar por puesto y no por empresa: dos
-- puestos de la misma empresa pueden ser de marcas distintas y enseñar cada uno
-- la suya.
--
-- Es el único cambio: un campo más dentro de `others`, que ya salía de aquí.
-- ==========================================================================

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
    'anuncio', c.anuncio,
    'location', c.location,
    'company_name', coalesce(b.name, co.name),
    'company_description', co.descripcion,
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

grant execute on function public.get_public_campaign(text) to anon, authenticated;
