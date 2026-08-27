-- ==========================================================================
-- "SOBRE LA EMPRESA": qué cuenta de sí misma en sus anuncios (ago 2026).
--
-- La página del anuncio enseña logo, nombre y un párrafo de la empresa, debajo
-- de la descripción del puesto. El logo y el nombre ya existían (viven en la
-- MARCA); el párrafo no existía en ninguna parte y por eso ese bloque se quedó
-- sin construir cuando se hizo la página.
--
-- POR QUÉ EN `companies` Y NO EN `brands`. Se edita en AJUSTES, que es la
-- pantalla de la EMPRESA; la marca se edita en el constructor, que es otra
-- puerta y otro dueño. TENSIÓN DECLARADA: con varias marcas, la cabecera del
-- anuncio dice el nombre y el logo de la marca, y este párrafo sigue siendo el
-- de la casa. Se acepta porque describe a QUIEN CONTRATA, que es lo que le
-- interesa saber al candidato, y porque el caso normal es una sola marca. Si
-- algún día una marca necesita su propio texto, la columna nueva vive en
-- `brands` y pisa a esta; no al revés.
--
-- Texto y no jsonb: es un párrafo, no un objeto que vaya a crecer.
-- ==========================================================================

alter table public.companies
  add column if not exists descripcion text not null default '';

alter table public.companies
  drop constraint if exists companies_descripcion_size;
alter table public.companies
  add constraint companies_descripcion_size check (length(descripcion) <= 1000);

-- El UPDATE de companies está acotado por columnas desde el endurecimiento de
-- facturación: lo que no se nombre aquí, el cliente no lo puede escribir.
grant update (descripcion) on public.companies to authenticated;

-- ----------------------------------------------------------------------------
-- `my_companies` arma el objeto CAMPO A CAMPO: una columna que no se añada aquí
-- NUNCA llega al cliente y el ajuste parece no guardarse. Es la trampa que ya
-- mordió una vez, y por eso hay un guardián que la vigila
-- (src/lib/settings.test.ts).
-- ----------------------------------------------------------------------------

create or replace function public.my_companies()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'accent', c.accent,
    'plan', c.plan,
    'subscription_status', c.subscription_status,
    'billing_interval', c.billing_interval,
    'cancel_at_period_end', c.cancel_at_period_end,
    'onboarding_done_at', c.onboarding_done_at,
    'downgrade_reconcile_at', c.downgrade_reconcile_at,
    'meridian_auto', c.meridian_auto,
    'trial_ends_at', c.trial_ends_at,
    'paid_processes', c.paid_processes,
    'descripcion', c.descripcion,
    'role', m.role
  ) order by c.created_at asc), '[]'::jsonb)
  from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;

revoke all on function public.my_companies() from public, anon;
grant execute on function public.my_companies() to authenticated;

-- ----------------------------------------------------------------------------
-- Y el anuncio público la necesita: es la única puerta del candidato anónimo.
-- ----------------------------------------------------------------------------

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
