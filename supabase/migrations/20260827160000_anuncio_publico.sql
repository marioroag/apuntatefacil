-- ==========================================================================
-- EL ANUNCIO, VISTO DESDE FUERA (ago 2026).
--
-- `get_public_campaign` es la ÚNICA puerta del candidato anónimo: el rol `anon`
-- no tiene acceso directo a ninguna tabla, así que lo que no salga por aquí no
-- existe para quien abre el enlace. Se le añaden dos cosas:
--
--   1) `anuncio`, que es lo que se lee ANTES del formulario.
--   2) `others`, los demás puestos abiertos de la misma empresa.
--
-- POR QUÉ `others` SALE DEL MISMO RPC y no de una consulta aparte: son la misma
-- pantalla y la misma decisión ("esto no es para mí, ¿tienen otra cosa?"). En
-- dos llamadas, la lista aterrizaría después de que la página ya esté leída.
--
-- QUÉ SE EXPONE Y POR QUÉ ES SEGURO: título, ubicación y el enlace de cada
-- puesto ABIERTO. Es exactamente lo que esa empresa está publicando en portales
-- y lo que cualquiera ve al recibir uno de sus enlaces; no sale ni un dato de
-- candidato, ni recuentos, ni nada de la empresa que no sea su nombre público.
-- Se acota a `status = 'activa'`: un puesto pausado o cerrado no acepta
-- candidaturas, así que enseñarlo sería mandar a alguien a una puerta cerrada.
--
-- El TOPE de 5 es del producto, no de rendimiento: una columna lateral con
-- veinte tarjetas deja de ser "otras vacantes" y pasa a ser un listado.
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
    'logo_path', b.logo_path,
    'banner_path', b.banner_path,
    -- Los demás puestos abiertos de la misma empresa. Cada uno con su etiqueta
    -- de marca, porque el primer tramo del enlace sale de ella y no de la
    -- empresa (ver publicFormPath en src/lib/brand.ts).
    'others', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', o.slug,
        'title', o.title,
        'location', o.location,
        'brand_label', coalesce(ob.name, co.name)
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
