// Webhook de Stripe: actualiza el plan y el estado de suscripción de la empresa.
// verify_jwt = false (lo verifica la firma de Stripe). Secrets: STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY.
// Mapea precios (mensual + anual) a plan; registra el periodo de facturación.
import Stripe from 'npm:stripe@18'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2025-05-28.basil' })
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

// Precio de Stripe -> nombre de plan. Permite saber el plan real tras un cambio
// (los metadatos de la suscripción no se actualizan solos al cambiar de precio).
const PRICE_TO_PLAN: Record<string, string> = {}
const _pe = Deno.env.get('STRIPE_PRICE_ESENCIAL'); if (_pe) PRICE_TO_PLAN[_pe] = 'esencial'
const _pp = Deno.env.get('STRIPE_PRICE_PRO'); if (_pp) PRICE_TO_PLAN[_pp] = 'pro'
const _pm = Deno.env.get('STRIPE_PRICE_MULTI'); if (_pm) PRICE_TO_PLAN[_pm] = 'multi'
const _pea = Deno.env.get('STRIPE_PRICE_ESENCIAL_ANNUAL'); if (_pea) PRICE_TO_PLAN[_pea] = 'esencial'
const _ppa = Deno.env.get('STRIPE_PRICE_PRO_ANNUAL'); if (_ppa) PRICE_TO_PLAN[_ppa] = 'pro'
const _pma = Deno.env.get('STRIPE_PRICE_MULTI_ANNUAL'); if (_pma) PRICE_TO_PLAN[_pma] = 'multi'

// Escribe en companies el estado REAL de una suscripción (plan según el precio,
// estado, periodo, cancelación programada). Fuente única para checkout y eventos.
async function applySub(companyId: string, sub: Stripe.Subscription) {
  const canceled = sub.status === 'canceled'
  const priceId = sub.items?.data?.[0]?.price?.id
  const planFromPrice = priceId ? PRICE_TO_PLAN[priceId] : undefined
  const plan = canceled ? 'trial' : (planFromPrice ?? sub.metadata?.plan ?? 'pro')
  const interval = canceled ? null : (sub.items?.data?.[0]?.price?.recurring?.interval ?? null)
  await admin.from('companies').update({
    plan,
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    billing_interval: interval,
    cancel_at_period_end: canceled ? false : (sub.cancel_at_period_end ?? false),
  }).eq('id', companyId)
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature') ?? ''
  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (e) {
    return new Response(`Firma no válida: ${e instanceof Error ? e.message : e}`, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session
      const companyId = s.metadata?.company_id
      if (companyId) {
        if (typeof s.customer === 'string') {
          await admin.from('companies').update({ stripe_customer_id: s.customer }).eq('id', companyId)
        }
        // Leemos la suscripción real (plan, periodo, cancelación) en vez de fijar
        // valores a mano: así el periodo (mensual/anual) queda bien desde el primer evento.
        if (typeof s.subscription === 'string') {
          try {
            const sub = await stripe.subscriptions.retrieve(s.subscription)
            await applySub(companyId, sub)
          } catch (_e) {
            // Fallo transitorio leyendo la sub recién creada: escribimos lo básico
            // (no 500 -> evita la tormenta de reintentos de Stripe). El evento
            // customer.subscription.created completará el periodo después.
            await admin.from('companies').update({
              plan: s.metadata?.plan ?? 'pro',
              subscription_status: 'active',
              stripe_subscription_id: s.subscription,
            }).eq('id', companyId)
          }
        } else {
          await admin.from('companies')
            .update({ plan: s.metadata?.plan ?? 'pro', subscription_status: 'active' })
            .eq('id', companyId)
        }
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const subEvent = event.data.object as Stripe.Subscription
      const companyId = subEvent.metadata?.company_id
      if (companyId) {
        // Releemos la suscripción EN VIVO (salvo en delete, que es terminal): así el
        // estado guardado es el ACTUAL aunque los eventos lleguen desordenados o
        // repetidos (Stripe no garantiza orden ni unicidad de entrega).
        let sub = subEvent
        if (event.type !== 'customer.subscription.deleted') {
          try {
            sub = await stripe.subscriptions.retrieve(subEvent.id)
          } catch (e) {
            // Si la sub YA NO existe, NO la resucitemos con el payload viejo (un
            // 'updated' reintentado tras un 'deleted' daría acceso gratis): trátala
            // como cancelada. Otros errores (transitorios): usa el payload.
            if ((e as { code?: string })?.code === 'resource_missing') {
              sub = { ...subEvent, status: 'canceled' } as Stripe.Subscription
            }
          }
        }
        await applySub(companyId, sub)
      }
    }
  } catch (e) {
    return new Response(`Error procesando: ${e instanceof Error ? e.message : e}`, { status: 500 })
  }

  return new Response('ok')
})
