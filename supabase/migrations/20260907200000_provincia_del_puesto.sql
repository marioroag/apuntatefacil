-- LA PROVINCIA DEL PUESTO (sep 2026).
--
-- `location` es la ciudad, en texto libre, desde el primer día. Sola no
-- siempre sitúa la oferta: un pueblo con nombre repetido, una zona, una ciudad
-- mal escrita. La provincia se ELIGE de una lista cerrada (PROVINCIAS en
-- src/lib/anuncio.ts) y por eso es comparable entre puestos; Google for Jobs la
-- lee como `addressRegion`, que es lo que hace que la oferta caiga en su sitio.
--
-- Columna propia y no parte del jsonb del anuncio, por lo mismo que `location`:
-- es un hecho del puesto que leen la cabecera del panel y la página pública, y
-- dentro del anuncio decidiría por sí sola que el puesto "tiene anuncio", que
-- es la trampa que ya se cazó con la ubicación. Nace NULL: los puestos
-- anteriores no la tienen y el cliente la lee como "sin decir". La lista de
-- valores se valida al leer (`leerProvincia`), no con un check: es el mismo
-- criterio que contrato o jornada, y así cambiar el vocabulario no cuesta una
-- migración.

alter table public.campaigns
  add column if not exists provincia text;

alter table public.campaigns
  drop constraint if exists campaigns_provincia_size;
alter table public.campaigns
  add constraint campaigns_provincia_size
  check (provincia is null or length(provincia) <= 40);

-- El UPDATE de campaigns es POR COLUMNAS: sin esto, el constructor la guardaría
-- en silencio a ninguna parte.
grant update (provincia) on public.campaigns to authenticated;

-- La página pública la pinta junto a la ciudad, también en "otros puestos".
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
    'provincia', c.provincia,
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
        'provincia', o.provincia,
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
