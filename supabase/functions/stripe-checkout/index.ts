// Crea una sesión de Stripe Checkout (suscripción) para el plan elegido.
// Requiere usuario autenticado. Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ESENCIAL,
// STRIPE_PRICE_PRO, STRIPE_PRICE_MULTI.
import Stripe from 'npm:stripe@18'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2025-05-28.basil' })

const PRICES: Record<string, string | undefined> = {
  esencial: Deno.env.get('STRIPE_PRICE_ESENCIAL'),
  pro: Deno.env.get('STRIPE_PRICE_PRO'),
  multi: Deno.env.get('STRIPE_PRICE_MULTI'),
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'No autenticado' }, 401)

    const { plan, returnUrl } = await req.json()
    const price = PRICES[plan]
    if (!price) return json({ error: 'Plan no válido o sin price configurado' }, 400)

    const { data: companies } = await supabase
      .from('companies').select('id,name,stripe_customer_id').limit(1)
    const company = companies?.[0]
    if (!company) return json({ error: 'Sin empresa' }, 400)

    let customerId = company.stripe_customer_id as string | null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: company.name,
        metadata: { company_id: company.id },
      })
      customerId = customer.id
      await supabase.from('companies').update({ stripe_customer_id: customerId }).eq('id', company.id)
    }

    const base = (returnUrl as string) || `${new URL(req.url).origin}`
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${base}?checkout=ok`,
      cancel_url: `${base}?checkout=cancel`,
      metadata: { company_id: company.id, plan },
      subscription_data: { metadata: { company_id: company.id, plan } },
      allow_promotion_codes: true,
    })
    return json({ url: session.url })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
