-- ============================================================================
-- Apúntate Fácil: ajustes (correos por persona + Meridian por empresa)
-- ----------------------------------------------------------------------------
-- Dos ejes distintos, guardados en dos sitios distintos a propósito:
--
--   * Lo que TÚ quieres recibir en tu bandeja es de la PERSONA. Vive en
--     profiles.email_prefs, junto a tu nombre y tu foto, y te sigue a todas las
--     empresas de las que seas miembro.
--   * Lo que la EMPRESA hace (analizar o no cada candidatura con Meridian, que
--     cuesta dinero y afecta a todo el equipo) vive en companies.
--
-- email_prefs es JSONB y no una columna por aviso: añadir un aviso nuevo no
-- puede costar una migración. La clave AUSENTE significa "sí" (los avisos vienen
-- puestos), así que solo se guarda lo que el usuario apaga y una cuenta nueva no
-- necesita fila. Las claves vivas están en src/lib/settings.tsx.
-- ============================================================================

alter table public.profiles
  add column email_prefs jsonb not null default '{}'::jsonb;

-- Cota de tamaño: es un puñado de booleanos, no un cajón de sastre.
alter table public.profiles
  add constraint profiles_email_prefs_size check (length(email_prefs::text) <= 2000);

-- ----------------------------------------------------------------------------
-- A quién se le manda de verdad
-- ----------------------------------------------------------------------------
-- Un solo sitio donde se decide si un aviso sale o no. Las edge functions pasan
-- los destinatarios candidatos y la clave del aviso, y reciben SOLO a quien lo
-- quiere, ya con su dirección. Así no hay tres copias de la misma regla, y el
-- día que se añada un aviso basta con pasar su clave.
--
-- Sin fila en profiles, o sin esa clave, se recibe: el ajuste guarda solo lo
-- apagado. La comparación es contra el literal 'false' en vez de un cast a
-- boolean para que un valor inesperado no reviente el envío.
--
-- security definer: lee auth.users, que el invocador no puede tocar.
create or replace function public.email_recipients(p_user_ids uuid[], p_key text)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text
  from unnest(coalesce(p_user_ids, '{}')) as t(uid)
  join auth.users u on u.id = t.uid
  left join public.profiles p on p.user_id = u.id
  where u.email is not null
    and not coalesce(p.email_prefs -> p_key = 'false'::jsonb, false)
$$;

-- Quién es el dueño de una empresa. Ya existe get_company_owner_email, pero para
-- filtrar por preferencias hace falta su id, no su dirección.
create or replace function public.company_owner_id(p_company uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id
  from public.memberships m
  where m.company_id = p_company and m.role = 'owner'
  order by m.created_at
  limit 1
$$;

-- Solo las edge functions (service_role) deciden a quién se escribe. El cliente
-- no tiene por qué poder listar direcciones de su equipo con esta vía.
revoke execute on function public.email_recipients(uuid[], text) from public, anon, authenticated;
revoke execute on function public.company_owner_id(uuid) from public, anon, authenticated;
grant execute on function public.email_recipients(uuid[], text) to service_role;
grant execute on function public.company_owner_id(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- Meridian: analizar o no cada candidatura al entrar
-- ----------------------------------------------------------------------------
-- Por defecto sí, que es lo que hace hoy. Es de la empresa y no de la persona:
-- el análisis se guarda en la candidatura y lo ve todo el equipo.
alter table public.companies
  add column meridian_auto boolean not null default true;

-- El UPDATE sobre companies está acotado por columnas desde el endurecimiento de
-- facturación (20260706160000): sin este grant, el interruptor no escribiría.
grant update (meridian_auto) on public.companies to authenticated;

-- my_companies arma el objeto CAMPO A CAMPO, así que una columna nueva no llega
-- sola al cliente: sin esto el interruptor se guardaba bien y volvía a su sitio
-- en la siguiente carga. Toda columna de `companies` que use la app tiene que
-- añadirse también aquí.
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
    'role', m.role
  ) order by c.created_at asc), '[]'::jsonb)
  from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;
