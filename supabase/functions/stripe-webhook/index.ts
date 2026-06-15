// Webhook de Stripe: actualiza el plan y el estado de suscripción de la empresa.
// verify_jwt = false (lo verifica la firma de Stripe). Secrets: STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY.
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
      const plan = s.metadata?.plan ?? 'pro'
      if (companyId) {
        // El estado de los puestos al cambiar de plan lo reconcilia el trigger de BD
        // sync_campaigns_to_plan (reactiva al subir de Prueba, pausa al bajar).
        await admin.from('companies').update({
          plan,
          subscription_status: 'active',
          stripe_customer_id: typeof s.customer === 'string' ? s.customer : null,
          stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : null,
        }).eq('id', companyId)
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const sub = event.data.object as Stripe.Subscription
      const companyId = sub.metadata?.company_id
      if (companyId) {
        const canceled = event.type === 'customer.subscription.deleted' || sub.status === 'canceled'
        const priceId = sub.items?.data?.[0]?.price?.id
        const planFromPrice = priceId ? PRICE_TO_PLAN[priceId] : undefined
        const plan = canceled ? 'trial' : (planFromPrice ?? sub.metadata?.plan ?? 'pro')
        await admin.from('companies').update({
          plan,
          subscription_status: sub.status,
          stripe_subscription_id: sub.id,
        }).eq('id', companyId)
      }
    }
  } catch (e) {
    return new Response(`Error procesando: ${e instanceof Error ? e.message : e}`, { status: 500 })
  }

  return new Response('ok')
})
