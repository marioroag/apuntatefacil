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
      const plan = s.metadata?.plan
      if (companyId) {
        await admin.from('companies').update({
          plan: plan ?? 'pro',
          subscription_status: 'active',
          stripe_customer_id: typeof s.customer === 'string' ? s.customer : null,
          stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : null,
        }).eq('id', companyId)
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const sub = event.data.object as Stripe.Subscription
      const companyId = sub.metadata?.company_id
      const plan = sub.metadata?.plan
      if (companyId) {
        const canceled = event.type === 'customer.subscription.deleted' || sub.status === 'canceled'
        await admin.from('companies').update({
          plan: canceled ? 'trial' : (plan ?? 'pro'),
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
