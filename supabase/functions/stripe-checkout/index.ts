// Punto de entrada de facturación. Acciones según el estado real de la empresa:
//  - Sin suscripción válida + plan -> Stripe Checkout (alta nueva).
//  - Con suscripción válida + plan -> actualiza la existente (cambio con prorrateo).
//  - { cancel: true } -> cancela al final del periodo.
//  - { preview: true } -> importe que se cobraría ahora al cambiar a `plan`.
// Auto-reparación: si la suscripción/cliente guardados no existen en el modo actual
// (p.ej. datos de prueba tras pasar a modo real, o borrados), se limpian y se trata
// como alta nueva, en vez de dar error.
import Stripe from 'npm:stripe@18'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2025-05-28.basil' })

const PRICES: Record<string, string | undefined> = {
  esencial: Deno.env.get('STRIPE_PRICE_ESENCIAL'),
  pro: Deno.env.get('STRIPE_PRICE_PRO'),
  multi: Deno.env.get('STRIPE_PRICE_MULTI'),
}
const ACTIVE = ['active', 'trialing', 'past_due', 'unpaid']

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

    const { plan, returnUrl, cancel, preview } = await req.json()

    const { data: companies } = await supabase
      .from('companies')
      .select('id,name,stripe_customer_id,stripe_subscription_id,subscription_status')
      .limit(1)
    const company = companies?.[0]
    if (!company) return json({ error: 'Sin empresa' }, 400)

    // Solo el PROPIETARIO gestiona el plan/facturación (no miembros ni encargados).
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('company_id', company.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership || membership.role !== 'owner') {
      return json({ error: 'Solo el propietario puede gestionar el plan' }, 403)
    }

    // ¿Hay una suscripción REALMENTE válida en el modo actual? Si la referencia
    // guardada no existe aquí (datos de test en live, o borrada), se limpia.
    let subId = company.stripe_subscription_id as string | null
    let subObj: Stripe.Subscription | null = null
    let hasActiveSub = false
    if (subId && ACTIVE.includes((company.subscription_status as string) ?? '')) {
      try {
        subObj = await stripe.subscriptions.retrieve(subId)
        hasActiveSub = ACTIVE.includes(subObj.status)
      } catch (_e) {
        await supabase.from('companies').update({
          stripe_subscription_id: null,
          subscription_status: null,
          stripe_customer_id: null,
          plan: 'trial',
        }).eq('id', company.id)
        subId = null
        company.stripe_customer_id = null
        hasActiveSub = false
      }
    }

    // 1) Cancelar (al final del periodo ya pagado).
    if (cancel) {
      if (!hasActiveSub) return json({ error: 'No hay suscripción activa que cancelar' }, 400)
      await stripe.subscriptions.update(subId!, { cancel_at_period_end: true })
      return json({ canceled: true })
    }

    const price = PRICES[plan]
    if (!price) return json({ error: 'Plan no válido o sin price configurado' }, 400)

    // 2) Previsualizar el importe inmediato al cambiar a `plan`.
    if (preview) {
      if (!hasActiveSub || !subObj) return json({ amountDue: 0, notSubscribed: true })
      const itemId = subObj.items.data[0]?.id
      if (!itemId) return json({ amountDue: 0, notSubscribed: true })
      const pv = await stripe.invoices.createPreview({
        customer: (company.stripe_customer_id as string) ?? undefined,
        subscription: subId!,
        subscription_details: {
          items: [{ id: itemId, price }],
          proration_behavior: 'always_invoice',
        },
      })
      return json({ amountDue: pv.amount_due, total: pv.total, currency: pv.currency })
    }

    // 3) Cambiar de plan en la suscripción existente (sin crear otra).
    if (hasActiveSub && subObj) {
      const itemId = subObj.items.data[0]?.id
      if (!itemId) return json({ error: 'Suscripción sin líneas' }, 400)
      await stripe.subscriptions.update(subId!, {
        items: [{ id: itemId, price }],
        proration_behavior: 'always_invoice',
        cancel_at_period_end: false,
        metadata: { company_id: company.id, plan },
      })
      return json({ changed: true, plan })
    }

    // 4) Alta nueva -> Stripe Checkout. Aseguramos un customer válido en este modo.
    let customerId = company.stripe_customer_id as string | null
    if (customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId)
        if ((c as { deleted?: boolean }).deleted) customerId = null
      } catch (_e) {
        customerId = null
      }
    }
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
