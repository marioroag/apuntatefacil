// Punto de entrada de facturación del PAGO POR PROCESO ABIERTO (ago 2026).
// Una suscripción por empresa con el price STRIPE_PRICE_PROCESO y cantidad =
// nº de procesos abiertos (49 €/mes + IVA cada uno). Acciones:
//  - { checkout: true, activateCampaignId? } -> Stripe Checkout (alta nueva,
//    tarjeta o SEPA). Cantidad = procesos abiertos (+1 si hay un puesto creado
//    en espera de pago, que el webhook activará al completarse).
//  - { previewAdd: true, campaignId? } -> qué costaría abrir un proceso más
//    AHORA: gratis si es reabrir dentro de su ciclo ya pagado (paid_until),
//    o la parte proporcional hasta la próxima factura.
//  - { addProcess: true, campaignId? } -> un hueco más. Reabrir dentro del
//    ciclo pagado no cobra (mes empezado, mes cobrado: ese hueco ya se pagó);
//    si no, cobra la prorrata al momento (error_if_incomplete: sin cobro no
//    hay hueco). Con campaignId además reabre ese puesto.
//  - { closeProcess: campaignId } -> cierra el puesto (modo lectura), cantidad
//    -1 SIN devolución (mes empezado, mes cobrado) y apunta en paid_until hasta
//    cuándo queda pagado su ciclo (reabrir antes de esa fecha es gratis). Si no
//    queda ningún proceso abierto, la suscripción se cancela a final de periodo.
//  - { syncProcesses: true } -> reconcilia la cantidad con los procesos
//    abiertos reales (la llama el cliente tras cerrar o borrar un puesto).
//  - { portal: true } -> portal de facturación de Stripe (método de pago,
//    facturas, datos fiscales).
//  - { cancel: true } / { resume: true } -> solo para suscripciones legacy de
//    los tiers retirados (Esencial/Pro/Multi).
// Auto-reparación: si la suscripción/cliente guardados no existen en el modo
// actual, se limpian y se trata como alta nueva, en vez de dar error.
import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { corsHeaders, json } from '../_shared/cors.ts'
import { PLAZO } from '../_shared/red.ts'
import { esRegion, tipoImpositivo, type RegionFiscal } from '../_shared/impuestos.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2025-05-28.basil', timeout: PLAZO.api })

// Cliente service_role SOLO para escribir el estado de facturación (empresa y
// ciclo de los puestos). Las columnas de billing no son escribibles por el rol
// authenticated (20260706160000 y 20260824120000): el estado de pago lo fija
// siempre el backend de confianza, nunca el JWT del usuario.
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const PRICE_PROCESO = Deno.env.get('STRIPE_PRICE_PROCESO') ?? ''

// El success/cancel de Stripe vuelve al navegador: solo aceptamos returnUrl de
// nuestro propio dominio (APP_URL) o de localhost en desarrollo. Un returnUrl
// arbitrario del body sería un redirect abierto post-pago (phishing).
function safeReturnBase(returnUrl: unknown, fallback: string): string {
  if (typeof returnUrl !== 'string' || !returnUrl) return fallback
  try {
    const u = new URL(returnUrl)
    const appUrl = Deno.env.get('APP_URL')
    const allowedHost = appUrl ? new URL(appUrl).host : null
    if (u.host === allowedHost || u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return returnUrl
    }
  } catch { /* returnUrl no es una URL válida */ }
  return fallback
}

// Fin del periodo ya pagado. En la API 2025 (basil) el periodo vive en el item.
function periodEnd(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  return item?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end
    ?? null
}

const esCobrable = (e: unknown): boolean => {
  const err = e as { code?: string; message?: string }
  return err?.code === 'card_declined'
    || err?.code === 'payment_intent_authentication_failure'
    || !!err?.message?.includes('payment')
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

    const {
      checkout, activateCampaignId, previewAdd, addProcess, closeProcess,
      syncProcesses, portal, cancel, resume, returnUrl, companyId, campaignId, regionFiscal,
    } = await req.json()

    // Con el JWT del usuario, la RLS solo deja ver SUS empresas. Si el cliente
    // manda companyId (puede pertenecer a varias), facturamos ESA; sin él,
    // caemos a la única.
    let companyQuery = supabase
      .from('companies')
      .select('id,name,plan,paid_processes,stripe_customer_id,stripe_subscription_id,subscription_status,region_fiscal')
    companyQuery = typeof companyId === 'string' && companyId
      ? companyQuery.eq('id', companyId)
      : companyQuery.limit(1)
    const { data: companies } = await companyQuery
    const company = companies?.[0]
    if (!company) return json({ error: 'Sin empresa' }, 400)

    // Solo el PROPIETARIO gestiona la facturación (no miembros ni encargados).
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('company_id', company.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership || membership.role !== 'owner') {
      return json({ error: 'Solo el propietario puede gestionar la facturación' }, 403)
    }

    // Los puestos, con service_role: el estado de facturación necesita verlos
    // todos y escribir status/paid_until, que el JWT no puede tocar.
    const { data: allCampaigns } = await admin
      .from('campaigns')
      .select('id,status,paid_until')
      .eq('company_id', company.id)
    const campañas = allCampaigns ?? []
    const abiertas = campañas.filter((c) => c.status !== 'cerrada')
    const laCampaña = typeof campaignId === 'string'
      ? campañas.find((c) => c.id === campaignId) ?? null
      : null
    if (typeof campaignId === 'string' && !laCampaña) return json({ error: 'Puesto no encontrado' }, 404)

    // ¿Hay una suscripción viva en el modo actual? Consultamos SIEMPRE a Stripe
    // (la fuente de verdad), no el estado guardado.
    let subId = company.stripe_subscription_id as string | null
    let subObj: Stripe.Subscription | null = null
    let hasActiveSub = false
    if (subId) {
      try {
        subObj = await stripe.subscriptions.retrieve(subId)
        // 'past_due' sigue viva (Stripe reintenta y hay método de pago detrás).
        // 'unpaid' NO: Stripe agotó los reintentos, el webhook ya cerró los
        // procesos, y tratarla como viva dejaba al cliente en un callejón: al
        // reabrir se intentaba cobrar a esa suscripción muerta (402 "revisa tu
        // método de pago") y ningún botón le llevaba a un alta nueva. Muerta,
        // el camino es Checkout, que la cancela y crea una limpia.
        hasActiveSub = ['active', 'trialing', 'past_due'].includes(subObj.status)
      } catch (e) {
        // Solo auto-reparamos cuando la sub NO existe en este modo: limpiamos
        // SOLO la sub. Ante un error transitorio no tocamos nada.
        if ((e as { code?: string })?.code === 'resource_missing') {
          await admin.from('companies').update({
            stripe_subscription_id: null,
            subscription_status: null,
          }).eq('id', company.id)
          subId = null
          subObj = null
          hasActiveSub = false
        } else {
          return json({ error: 'No se pudo verificar tu suscripción. Inténtalo de nuevo en un momento.' }, 502)
        }
      }
    }
    const item = subObj?.items?.data?.[0] ?? null
    const esProceso = item?.price?.id === PRICE_PROCESO
    const cantidad = item?.quantity ?? 0

    // ------------------------------------------------------------------
    // Portal de facturación (método de pago, facturas).
    // ------------------------------------------------------------------
    if (portal) {
      if (!company.stripe_customer_id) return json({ error: 'Aún no tienes datos de facturación' }, 400)
      const base = safeReturnBase(returnUrl, Deno.env.get('APP_URL') || `${new URL(req.url).origin}`)
      const session = await stripe.billingPortal.sessions.create({
        customer: company.stripe_customer_id as string,
        return_url: base,
      })
      return json({ url: session.url })
    }

    // ------------------------------------------------------------------
    // Legacy: cancelar/reanudar una suscripción de los tiers retirados.
    // ------------------------------------------------------------------
    if (cancel) {
      if (!hasActiveSub) return json({ error: 'No hay suscripción activa que cancelar' }, 400)
      await stripe.subscriptions.update(subId!, { cancel_at_period_end: true })
      return json({ canceled: true })
    }
    if (resume) {
      if (!hasActiveSub) return json({ error: 'No hay suscripción que reanudar' }, 400)
      await stripe.subscriptions.update(subId!, { cancel_at_period_end: false })
      return json({ resumed: true })
    }

    // ------------------------------------------------------------------
    // Cerrar un proceso: un clic, sin fricción. Se cierra SIEMPRE, haya o no
    // suscripción; después se ajusta el cobro si la hay.
    // ------------------------------------------------------------------
    if (closeProcess) {
      if (!laCampaña) return json({ error: 'Falta el puesto a cerrar' }, 400)
      if (laCampaña.status !== 'cerrada') {
        const { error } = await admin.from('campaigns')
          .update({ status: 'cerrada' })
          .eq('id', laCampaña.id)
        if (error) return json({ error: 'No se pudo cerrar el puesto.' }, 500)
      }
      let paidUntil: string | null = null
      if (hasActiveSub && subObj && esProceso && item) {
        const abiertasAhora = abiertas.filter((c) => c.id !== laCampaña.id).length
        const fin = periodEnd(subObj)
        paidUntil = fin ? new Date(fin * 1000).toISOString() : null
        // Mes empezado, mes cobrado: la cantidad baja SIN prorrata (nada que
        // devolver) y el ciclo ya pagado queda apuntado para la reapertura gratis.
        await stripe.subscriptions.update(subId!, {
          items: [{ id: item.id, quantity: Math.max(abiertasAhora, 1) }],
          proration_behavior: 'none',
          // Sin procesos abiertos no hay nada que renovar: la suscripción muere
          // al final del periodo ya pagado (la cantidad mínima de Stripe es 1).
          cancel_at_period_end: abiertasAhora === 0,
        })
        if (paidUntil) {
          await admin.from('campaigns').update({ paid_until: paidUntil }).eq('id', laCampaña.id)
        }
        await admin.from('companies').update({ paid_processes: abiertasAhora }).eq('id', company.id)
      }
      return json({ closed: true, paidUntil })
    }

    // ------------------------------------------------------------------
    // Reconciliar la cantidad con los procesos abiertos reales (tras borrar un
    // puesto, o si un cierre se quedó sin sincronizar). Solo BAJA la cantidad:
    // subirla siempre pasa por addProcess, que es donde se cobra.
    // ------------------------------------------------------------------
    if (syncProcesses) {
      if (!hasActiveSub || !subObj || !esProceso || !item) return json({ synced: false })
      const abiertasAhora = abiertas.length
      if (abiertasAhora < cantidad) {
        await stripe.subscriptions.update(subId!, {
          items: [{ id: item.id, quantity: Math.max(abiertasAhora, 1) }],
          proration_behavior: 'none',
          cancel_at_period_end: abiertasAhora === 0,
        })
      }
      await admin.from('companies')
        .update({ paid_processes: Math.min(abiertasAhora, cantidad) })
        .eq('id', company.id)
      return json({ synced: true })
    }

    // ¿El hueco nuevo sale gratis? Dos casos: reabrir un puesto dentro de su
    // ciclo ya pagado (paid_until), o que la suscripción tenga más cantidad
    // pagada que procesos abiertos (un hueco comprado y sin estrenar).
    const reaperturaGratis = !!(laCampaña && laCampaña.status === 'cerrada'
      && laCampaña.paid_until && new Date(laCampaña.paid_until as string).getTime() > Date.now())
    const abiertasDespues = abiertas.length + 1
    const huecoGratis = reaperturaGratis || abiertasDespues <= cantidad

    // ------------------------------------------------------------------
    // Previsualizar qué costaría abrir un proceso más ahora.
    // ------------------------------------------------------------------
    if (previewAdd) {
      if (!hasActiveSub || !subObj || !esProceso || !item) return json({ notSubscribed: true })
      if (huecoGratis) {
        return json({ free: true, paidUntil: laCampaña?.paid_until ?? null })
      }
      const pv = await stripe.invoices.createPreview({
        customer: (company.stripe_customer_id as string) ?? undefined,
        subscription: subId!,
        subscription_details: {
          items: [{ id: item.id, quantity: abiertasDespues }],
          proration_behavior: 'always_invoice',
        },
      })
      const fin = periodEnd(subObj)
      return json({
        amountDue: pv.amount_due,
        currency: pv.currency,
        // Con el tipo impositivo puesto en la suscripción, amount_due ya lleva
        // el impuesto que toque (IGIC, o cero con inversión del sujeto pasivo):
        // la pantalla lo dice en vez de sumar "+ IVA" otra vez.
        impuestosIncluidos: (subObj.default_tax_rates?.length ?? 0) > 0,
        renewsAt: fin ? new Date(fin * 1000).toISOString() : null,
      })
    }

    // ------------------------------------------------------------------
    // Un proceso más en la suscripción viva (y reabrir el puesto, si viene).
    // ------------------------------------------------------------------
    if (addProcess && hasActiveSub && subObj && esProceso && item) {
      // La cantidad objetivo es "procesos abiertos tras abrir": nunca se baja
      // desde aquí (bajar es cosa de closeProcess/syncProcesses).
      const objetivo = Math.max(abiertasDespues, cantidad)
      try {
        if (objetivo > cantidad || subObj.cancel_at_period_end) {
          await stripe.subscriptions.update(subId!, {
            ...(objetivo > cantidad ? { items: [{ id: item.id, quantity: objetivo }] } : {}),
            // Un hueco ya pagado no se cobra otra vez ("se retoma el ciclo
            // donde estaba"). Si no, prorrata al momento.
            proration_behavior: huecoGratis ? 'none' : 'always_invoice',
            payment_behavior: 'error_if_incomplete',
            cancel_at_period_end: false,
            metadata: { company_id: company.id },
          })
        }
      } catch (e) {
        if (esCobrable(e)) {
          return json({ error: 'No se pudo cobrar el proceso nuevo. Revisa tu método de pago e inténtalo de nuevo.', paymentFailed: true }, 402)
        }
        throw e
      }
      // El hueco existe ANTES de abrir el puesto: el trigger de límite lo exige.
      await admin.from('companies').update({ paid_processes: objetivo }).eq('id', company.id)
      if (laCampaña && laCampaña.status === 'cerrada') {
        const { error } = await admin.from('campaigns')
          .update({ status: 'activa' })
          .eq('id', laCampaña.id)
        if (error) return json({ error: 'El cobro se hizo pero el puesto no se pudo reabrir. Reábrelo desde el panel.' }, 500)
      }
      return json({ added: true })
    }
    if (addProcess) {
      // Sin suscripción viva: el alta pasa por Checkout.
      return json({ notSubscribed: true })
    }

    if (!checkout) return json({ error: 'Acción no reconocida' }, 400)
    if (!PRICE_PROCESO) return json({ error: 'Falta configurar el price del proceso (STRIPE_PRICE_PROCESO)' }, 500)

    // DÓNDE ESTÁ EL CLIENTE decide el impuesto de su factura (somos canarios:
    // ver _shared/impuestos.ts). Lo dice en la app antes de salir a pagar; sin
    // ese dato no se puede armar la sesión, porque la primera factura se cobra
    // en la propia página de Stripe y tiene que salir bien a la primera.
    let region: RegionFiscal | null = esRegion(regionFiscal) ? regionFiscal : (esRegion(company.region_fiscal) ? company.region_fiscal : null)
    if (!region) return json({ error: 'Dinos dónde tiene tu empresa su domicilio fiscal para preparar la factura.', needsRegion: true }, 400)
    if (region !== company.region_fiscal) {
      await admin.from('companies').update({ region_fiscal: region }).eq('id', company.id)
    }
    const tipo = await tipoImpositivo(stripe, region)

    // ------------------------------------------------------------------
    // Alta nueva -> Stripe Checkout. Cantidad = procesos abiertos hoy, más el
    // puesto en espera de pago si viene (creado cerrado; el webhook lo activa).
    // ------------------------------------------------------------------
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
      await admin.from('companies').update({ stripe_customer_id: customerId }).eq('id', company.id)
    }

    const pendiente = typeof activateCampaignId === 'string' && activateCampaignId
      ? campañas.find((c) => c.id === activateCampaignId && c.status === 'cerrada') ?? null
      : null
    const cantidadAlta = Math.max(abiertas.length + (pendiente ? 1 : 0), 1)

    // Antes de crear un Checkout nuevo, comprobamos en Stripe (no solo en la BD)
    // si este customer YA tiene una suscripción viva (carrera con el webhook o
    // sesión de un intento anterior). Si la hay, la ADOPTAMOS y ajustamos su
    // cantidad, en vez de crear una segunda que facturaría en paralelo.
    const existing = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
    // Una suscripción agotada por impago ('unpaid') no se adopta: se cancela
    // aquí, antes del alta nueva, para que no siga viva en Stripe facturando
    // en paralelo a la que se va a crear. Sus procesos ya los cerró el webhook.
    for (const s of existing.data.filter((s) => s.status === 'unpaid')) {
      await stripe.subscriptions.cancel(s.id)
    }
    const live = existing.data.find((s) => ['active', 'trialing', 'past_due'].includes(s.status))
    if (live) {
      await admin.from('companies').update({ stripe_subscription_id: live.id }).eq('id', company.id)
      const liveItem = live.items.data[0]
      if (liveItem?.price?.id === PRICE_PROCESO) {
        const liveQty = liveItem.quantity ?? 0
        if (cantidadAlta > liveQty) {
          try {
            await stripe.subscriptions.update(live.id, {
              items: [{ id: liveItem.id, quantity: cantidadAlta }],
              proration_behavior: 'always_invoice',
              payment_behavior: 'error_if_incomplete',
              cancel_at_period_end: false,
              metadata: { company_id: company.id },
            })
          } catch (e) {
            if (esCobrable(e)) {
              return json({ error: 'No se pudo cobrar. Revisa tu método de pago e inténtalo de nuevo.', paymentFailed: true }, 402)
            }
            throw e
          }
        }
        if (!live.default_tax_rates?.length) {
          await stripe.subscriptions.update(live.id, { default_tax_rates: [tipo] })
        }
        await admin.from('companies').update({
          plan: 'proceso',
          paid_processes: Math.max(cantidadAlta, liveQty),
        }).eq('id', company.id)
        if (pendiente) {
          await admin.from('campaigns').update({ status: 'activa' }).eq('id', pendiente.id)
        }
        return json({ changed: true })
      }
      // Suscripción legacy viva: no la pisamos desde aquí.
      return json({ error: 'Ya tienes una suscripción activa de un plan anterior. Cancélala antes de pasar al pago por proceso.' }, 400)
    }

    const base = safeReturnBase(returnUrl, Deno.env.get('APP_URL') || `${new URL(req.url).origin}`)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: PRICE_PROCESO, quantity: cantidadAlta }],
      // SIN payment_method_types a propósito: Checkout enseña los métodos que la
      // cuenta tenga ACTIVOS en el dashboard de Stripe. Fijarlos aquí rompía el
      // alta entera cuando uno no estaba activado (se lanzó con tarjeta + SEPA en
      // duro y SEPA estaba apagado en la cuenta: ninguna sesión se podía crear).
      // Para ofrecer el recibo domiciliado (SEPA), que en pymes españolas
      // convierte mejor que la tarjeta, se activa en Configuración -> Métodos de
      // pago y aparece aquí solo, sin tocar código.
      // IMPUESTOS. El precio es "impuestos aparte" y hasta sep 2026 la sesión
      // no aplicaba ninguno: el cliente pagaba 49 € justos y la factura salía
      // sin impuesto ni mención (pasó con las dos suscripciones de prueba de
      // junio). No es Stripe Tax (con un registro en España cobraría el 21 % a
      // todo el mundo, y somos canarios): es un tipo FIJO por región, puesto
      // en la suscripción para que valga en esta factura y en las siguientes.
      // El NIF y la dirección se piden en la propia página de pago: el NIF
      // hace válida la factura entre empresas y el código postal deja que el
      // webhook contraste la región que dijo el cliente.
      subscription_data: { metadata: { company_id: company.id }, default_tax_rates: [tipo] },
      tax_id_collection: { enabled: true },
      billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' },
      success_url: `${base}?checkout=ok`,
      cancel_url: `${base}?checkout=cancel`,
      metadata: { company_id: company.id, ...(pendiente ? { activate_campaign_id: pendiente.id } : {}) },
      allow_promotion_codes: true,
      // Sesión de vida corta: reduce las sesiones "zombie" completables horas
      // después (otra vía a la doble suscripción). 31 min: el mínimo de Stripe
      // es 30, con margen para que el tiempo de proceso no lo tire bajo el límite.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    })
    return json({ url: session.url })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
