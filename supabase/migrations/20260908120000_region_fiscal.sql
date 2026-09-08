-- DÓNDE TIENE EL CLIENTE SU DOMICILIO FISCAL (sep 2026). Apúntate Fácil es una
-- empresa canaria, así que el impuesto de cada factura depende de dónde esté
-- el cliente: IGIC 7 % si es canario, sin IVA (inversión del sujeto pasivo) si
-- es peninsular, sin IVA si es de Ceuta o Melilla. Ver
-- supabase/functions/_shared/impuestos.ts.
--
-- Lo dice el cliente al dar de alta el pago y lo escribe SOLO la función de
-- facturación (service_role): es lo que decide el impuesto de su factura, así
-- que no puede ser una columna que el navegador escriba a su aire. El webhook
-- lo contrasta con el código postal que Stripe recoge en la página de pago.
alter table public.companies
  add column if not exists region_fiscal text
  check (region_fiscal is null or region_fiscal in ('canarias', 'peninsula', 'ceuta_melilla'));

grant update (region_fiscal) on public.companies to service_role;

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
    'retencion_meses', c.retencion_meses,
    'region_fiscal', c.region_fiscal,
    'role', m.role
  ) order by c.created_at asc), '[]'::jsonb)
  from public.memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;
