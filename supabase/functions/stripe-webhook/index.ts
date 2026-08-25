// Webhook de Stripe: actualiza el estado de facturación de la empresa.
// verify_jwt = false (lo verifica la firma de Stripe). Secrets: STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY.
//
// Modelo de PAGO POR PROCESO (ago 2026): la suscripción usa el price
// STRIPE_PRICE_PROCESO y su CANTIDAD son los procesos abiertos pagados, que
// aquí se escriben en companies.paid_processes (el tope real que aplica el
// trigger de límite). Si la suscripción muere (cancelada, o impago con los
// reintentos agotados), los procesos abiertos se CIERRAN: dejan de aceptar
// candidaturas y de cobrarse, pero se conservan enteros y exportables. El plan
// nunca vuelve a 'trial' (una prueba por empresa): queda en 'proceso' con 0.
//
// Los prices de los tiers retirados (Esencial/Pro/Multi) se siguen mapeando
// mientras queden suscripciones antiguas vivas.
import Stripe from 'npm:stripe@18'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2025-05-28.basil' })
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const PRICE_PROCESO = Deno.env.get('STRIPE_PRICE_PROCESO') ?? ''

// Precio de Stripe -> plan legacy. Solo para las suscripciones de los tiers
// retirados; el modelo nuevo se reconoce por PRICE_PROCESO.
const PRICE_TO_PLAN: Record<string, string> = {}
const _pe = Deno.env.get('STRIPE_PRICE_ESENCIAL'); if (_pe) PRICE_TO_PLAN[_pe] = 'esencial'
const _pp = Deno.env.get('STRIPE_PRICE_PRO'); if (_pp) PRICE_TO_PLAN[_pp] = 'pro'
const _pm = Deno.env.get('STRIPE_PRICE_MULTI'); if (_pm) PRICE_TO_PLAN[_pm] = 'multi'
const _pea = Deno.env.get('STRIPE_PRICE_ESENCIAL_ANNUAL'); if (_pea) PRICE_TO_PLAN[_pea] = 'esencial'
const _ppa = Deno.env.get('STRIPE_PRICE_PRO_ANNUAL'); if (_ppa) PRICE_TO_PLAN[_ppa] = 'pro'
const _pma = Deno.env.get('STRIPE_PRICE_MULTI_ANNUAL'); if (_pma) PRICE_TO_PLAN[_pma] = 'multi'

// Sin pago que lo sostenga, un proceso no puede seguir abierto: se cierra
// (deja de aceptar candidaturas y de cobrarse; se conserva entero, en lectura).
async function closeOpenCampaigns(companyId: string) {
  const { error } = await admin.from('campaigns')
    .update({ status: 'cerrada' })
    .eq('company_id', companyId)
    .neq('status', 'cerrada')
  if (error) {
    throw new Error(`No se pudieron cerrar los procesos de la empresa ${companyId}: ${error.message}`)
  }
}

// Escribe en companies el estado REAL de una suscripción. Fuente única para
// checkout y eventos.
async function applySub(companyId: string, sub: Stripe.Subscription) {
  const item = sub.items?.data?.[0]
  const priceId = item?.price?.id
  const canceled = sub.status === 'canceled'
  // 'unpaid' = Stripe agotó los reintentos (3-5-7 días) sin cobrar: el acceso
  // de pago se acaba. 'past_due' NO corta nada: los reintentos siguen en curso.
  const dead = canceled || sub.status === 'unpaid' || sub.status === 'incomplete_expired'

  if (priceId && priceId === PRICE_PROCESO) {
    const qty = dead ? 0 : (item?.quantity ?? 1)
    const { error } = await admin.from('companies').update({
      plan: 'proceso',
      subscription_status: sub.status,
      stripe_subscription_id: sub.id,
      billing_interval: canceled ? null : (item?.price?.recurring?.interval ?? 'month'),
      cancel_at_period_end: canceled ? false : (sub.cancel_at_period_end ?? false),
      paid_processes: qty,
    }).eq('id', companyId)
    if (error) {
      throw new Error(`No se pudo aplicar el pago por proceso a la empresa ${companyId}: ${error.message}`)
    }
    if (dead) await closeOpenCampaigns(companyId)
    return
  }

  // Suscripción legacy (tiers retirados). Al morir NO se vuelve a 'trial' (una
  // prueba por empresa): la empresa pasa a 'proceso' con 0 procesos pagados.
  const planFromPrice = priceId ? PRICE_TO_PLAN[priceId] : undefined
  const plan = dead ? 'proceso' : (planFromPrice ?? sub.metadata?.plan ?? 'pro')
  const interval = canceled ? null : (item?.price?.recurring?.interval ?? null)
  const { error } = await admin.from('companies').update({
    plan,
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    billing_interval: interval,
    cancel_at_period_end: canceled ? false : (sub.cancel_at_period_end ?? false),
    ...(dead ? { paid_processes: 0 } : {}),
  }).eq('id', companyId)
  // NO tragarnos el error del UPDATE: si falla, responder 500 hace que Stripe
  // reintente y quede visible en el panel. Antes se devolvía 'ok' con el plan
  // sin escribir: el cliente pagaba y se quedaba en trial en silencio.
  if (error) {
    throw new Error(`No se pudo aplicar el plan '${plan}' a la empresa ${companyId}: ${error.message}`)
  }
  if (dead) await closeOpenCampaigns(companyId)
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
        // Leemos la suscripción real en vez de fijar valores a mano: así la
        // cantidad pagada queda bien desde el primer evento.
        if (typeof s.subscription === 'string') {
          try {
            const sub = await stripe.subscriptions.retrieve(s.subscription)
            await applySub(companyId, sub)
          } catch (_e) {
            // Fallo transitorio leyendo la sub recién creada: escribimos lo
            // básico (no 500 -> evita la tormenta de reintentos de Stripe). El
            // evento customer.subscription.created completará el resto después.
            await admin.from('companies').update({
              plan: 'proceso',
              subscription_status: 'active',
              stripe_subscription_id: s.subscription,
              paid_processes: 1,
            }).eq('id', companyId)
          }
        }
        // El puesto que esperaba el pago (creado cerrado desde el asistente):
        // se abre ahora que su hueco existe. Si el trigger de límite lo
        // rechazara (carrera con otra apertura), se queda cerrado y el dueño
        // lo reabre desde el panel: nunca 500 (Stripe reintentaría todo).
        const activar = s.metadata?.activate_campaign_id
        if (activar) {
          await admin.from('campaigns')
            .update({ status: 'activa' })
            .eq('id', activar)
            .eq('company_id', companyId)
            .eq('status', 'cerrada')
        }
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const subEvent = event.data.object as Stripe.Subscription
      const companyId = subEvent.metadata?.company_id
      if (companyId) {
        // Releemos la suscripción EN VIVO (salvo en delete, que es terminal):
        // así el estado guardado es el ACTUAL aunque los eventos lleguen
        // desordenados o repetidos.
        let sub = subEvent
        if (event.type !== 'customer.subscription.deleted') {
          try {
            sub = await stripe.subscriptions.retrieve(subEvent.id)
          } catch (e) {
            // Si la sub YA NO existe, NO la resucitemos con el payload viejo:
            // trátala como cancelada. Otros errores (transitorios): el payload.
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
