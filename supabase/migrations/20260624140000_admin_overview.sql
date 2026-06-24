-- ============================================================================
-- Apúntate Fácil · overview del SaaS para el panel de admin (solo staff)
-- Un único RPC que agrega las métricas de todo el producto: cuentas, suscripciones
-- (para el MRR, que se calcula en el front con los precios de pricing.ts), candidatos
-- recolectados, puestos y soporte, más una serie de candidaturas por día. Gateado con
-- is_support_staff, como el resto de la zona de admin.
-- ============================================================================

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v jsonb;
begin
  if not public.is_support_staff() then
    raise exception 'No autorizado';
  end if;

  select jsonb_build_object(
    'accounts', jsonb_build_object(
      'companies', (select count(*) from public.companies),
      'users', (select count(*) from auth.users),
      'new_companies_7d', (select count(*) from public.companies where created_at >= now() - interval '7 days'),
      'new_companies_30d', (select count(*) from public.companies where created_at >= now() - interval '30 days')
    ),
    -- Empresas por plan (incluye trial). Siempre las 4 claves, aunque alguna sea 0.
    'plans', jsonb_build_object(
      'trial', (select count(*) from public.companies where plan = 'trial'),
      'esencial', (select count(*) from public.companies where plan = 'esencial'),
      'pro', (select count(*) from public.companies where plan = 'pro'),
      'multi', (select count(*) from public.companies where plan = 'multi')
    ),
    'subscriptions', jsonb_build_object(
      -- "Activas de pago": cualquier plan que no sea trial. El MRR se compone en el
      -- front a partir de by_plan_interval (precios en pricing.ts, fuente única).
      'active_paid', (select count(*) from public.companies where plan <> 'trial'),
      'by_plan_interval', coalesce((
        select jsonb_agg(jsonb_build_object('plan', plan, 'interval', coalesce(billing_interval, 'month'), 'count', n))
        from (
          select plan, billing_interval, count(*) n
          from public.companies
          where plan <> 'trial'
          group by plan, billing_interval
        ) s
      ), '[]'::jsonb),
      'status', coalesce((
        select jsonb_object_agg(coalesce(subscription_status, 'sin_estado'), n)
        from (
          select subscription_status, count(*) n
          from public.companies
          where plan <> 'trial'
          group by subscription_status
        ) s
      ), '{}'::jsonb)
    ),
    'candidates', jsonb_build_object(
      'total', (select count(*) from public.candidates),
      'new_7d', (select count(*) from public.candidates where created_at >= now() - interval '7 days'),
      'new_30d', (select count(*) from public.candidates where created_at >= now() - interval '30 days'),
      'by_status', coalesce((
        select jsonb_object_agg(status, n)
        from (select status, count(*) n from public.candidates group by status) s
      ), '{}'::jsonb)
    ),
    'campaigns', jsonb_build_object(
      'total', (select count(*) from public.campaigns),
      'activa', (select count(*) from public.campaigns where status = 'activa'),
      'pausada', (select count(*) from public.campaigns where status = 'pausada'),
      'cerrada', (select count(*) from public.campaigns where status = 'cerrada')
    ),
    'support', jsonb_build_object(
      'open', (select count(*) from public.support_tickets where status = 'abierto'),
      'closed', (select count(*) from public.support_tickets where status = 'cerrado'),
      'pending', (select count(*) from public.support_tickets where status = 'abierto' and awaiting = 'equipo')
    ),
    -- Candidaturas por día, últimos 14 días (incluye días a 0 para que el gráfico no salte).
    'series_candidates_14d', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d), '[]'::jsonb)
      from (
        select gs::date as d,
               (select count(*) from public.candidates ca where ca.created_at::date = gs::date) as c
        from generate_series(current_date - interval '13 days', current_date, interval '1 day') gs
      ) t
    )
  ) into v;

  return v;
end;
$$;
grant execute on function public.admin_overview() to authenticated;
