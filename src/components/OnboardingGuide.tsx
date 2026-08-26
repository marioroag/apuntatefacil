import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ExternalLink, Link2, Loader2, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { useOnboarding } from '../lib/onboarding'
import { useAppBase } from '../lib/useAppBase'
import { useToast } from './ui/Toast'
import { TemplateGrid, useCreateFromTemplate } from './NewCampaignWizard'
import type { SectorTemplate } from '../lib/templates'
import { PRUEBA_CANDIDATOS } from '../lib/pricing'
import { BTN_PRIMARY, BTN_SECONDARY, botonIcono } from '../lib/buttons'
import type { Campaign } from '../lib/types'

// ----------------------------------------------------------------------------
// Guía de primer uso, "wizard en dos actos" sobre el producto REAL:
//  - Paso 2 (OnboardingCreatePuesto): pantalla completa en /app mientras no hay
//    puestos, con la misma rejilla de plantillas del modal "Crear puesto".
//  - Pasos 3-4 (OnboardingGuide): tarjeta acoplada que muestra UN paso con UNA
//    acción, encima del Builder y del panel reales. El paso 4 vive incrustado en
//    el hueco de la lista vacía (OnboardingTestCard): la candidatura de prueba
//    aparece literalmente donde la tarjeta dice que aparecerá.
// El progreso se deriva de datos reales (useOnboarding); aquí solo hay estado
// efímero: "esperando la candidatura" y el latch del cierre.
// ----------------------------------------------------------------------------

// Indicador de progreso del wizard: 4 segmentos en tinta (los cumplidos) + la
// etiqueta "Paso N de 4". Orienta al usuario no técnico ("son pocos pasos, voy
// por aquí") sin ruido. Tinta, no el acento (reservado a acción/nav/foco). Es
// inline-flex: se alinea solo a la izquierda o al centro según el contenedor.
export function StepProgress({ current, total = 4 }: { current: number; total?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5 align-middle">
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 w-6 rounded-full ${i < current ? 'bg-slate-900' : 'bg-slate-200'}`} />
        ))}
      </span>
      <span className="text-[12px] font-semibold text-slate-500">Paso {current} de {total}</span>
    </span>
  )
}

// Tarjeta flotante: recuerda el paso actual fuera de su pantalla, muestra el
// paso 3 en el Builder y la tarjeta final al llegar la primera candidatura.
export function OnboardingGuide() {
  const ob = useOnboarding()
  const { company, setOnboardingDone } = useAuth()
  const { candidates, reloadCandidatesFor, deleteCandidate } = useStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const base = useAppBase()
  const toast = useToast()

  // La fase se deriva de los datos, sin latch en memoria: los dos botones de la
  // tarjeta final ("Terminar" y "Borrar la prueba") CIERRAN la guía, así que la
  // fase nunca puede regresar a 'probar' tras el hito (era el bug: borrar la
  // prueba dejaba candidates=0 y el Dashboard, que lee el hook, remostraba el
  // paso 4 mientras la flotante seguía en 'hecho').
  const phase = ob.phase
  const campaignId = ob.campaign?.id ?? null

  // Detección de la llegada (fase 'probar'), centralizada aquí: al volver a la
  // pestaña se recarga al instante, y mientras está visible sondea suave (5 s los
  // dos primeros minutos, luego 30 s). Se apaga solo al salir de la fase.
  const polling = ob.active && phase === 'probar' && campaignId != null
  useEffect(() => {
    if (!polling || !campaignId) return
    let cancelled = false
    const started = Date.now()
    let timer = 0
    const tick = async () => {
      if (cancelled) return
      if (document.visibilityState === 'visible') await reloadCandidatesFor(campaignId)
      if (cancelled) return
      timer = window.setTimeout(tick, Date.now() - started < 120_000 ? 5_000 : 30_000)
    }
    const onWake = () => {
      if (document.visibilityState === 'visible') void reloadCandidatesFor(campaignId)
    }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    timer = window.setTimeout(tick, 5_000)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, campaignId])

  if (!ob.active) return null

  // Dónde NO flota: en /app sin puestos (el paso 2 ocupa la pantalla) y en el
  // panel del puesto durante la prueba (ahí el paso 4 vive incrustado en la lista).
  const onIndex = pathname === base || pathname === `${base}/`
  const onCampaignDash = campaignId != null && pathname === `${base}/puestos/${campaignId}`
  if (phase === 'puesto' && onIndex) return null
  if (phase === 'probar' && onCampaignDash) return null

  const dismiss = async () => {
    await setOnboardingDone(true)
    toast.show('Guía cerrada. La tienes arriba, en Primeros pasos.', {
      action: { label: 'Deshacer', onClick: () => void setOnboardingDone(false) },
    })
  }

  const testCandidate = candidates.find((c) => c.source === 'prueba')

  return (
    // El hueco contra el lateral es el MISMO que la tarjeta se deja por los otros
    // dos lados (20px, `bottom-5`/`left-5`). Estaba en 16.25rem = 260px contra un
    // lateral de 256 + 1 de filo: 3px de aire, o sea pegada por un lado y suelta
    // por los otros dos. La cuenta se deja escrita para que se mueva con el
    // lateral si alguna vez cambia de ancho.
    <div
      className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[380px] lg:left-[calc(16rem+1px+1.25rem)]"
      style={{ animation: 'reveal-up .18s var(--ease-out) both' }}
      role="complementary"
      aria-label="Guía de primeros pasos"
    >
      <div className="relative rounded-xl filo bg-white p-4 shadow-pop">
        {/* De `botonIcono`, no de un `p-1.5` a mano: medía 28px y no crecía en
            táctil, y en un móvil esta tarjeta vive fija abajo, así que cerrarla es
            lo único que se puede hacer con ella. */}
        <button
          onClick={dismiss}
          aria-label="Cerrar la guía"
          className={botonIcono('ghost', 'md', 'absolute right-2 top-2')}
        >
          <X className="size-4" aria-hidden />
        </button>

        {phase === 'puesto' && (
          <>
            <StepProgress current={2} />
            <p className="mt-2 pr-9 text-[15px] font-semibold text-slate-900">Crea tu primer puesto</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Con una plantilla de tu sector lo tienes listo en un minuto.
            </p>
            <button onClick={() => navigate(base)} className={`${BTN_PRIMARY} mt-3`}>
              Crear un puesto
            </button>
          </>
        )}

        {phase === 'formulario' && (
          <>
            <StepProgress current={3} />
            <p className="mt-2 pr-9 text-[15px] font-semibold text-slate-900">Esto es lo que verá quien abra tu enlace</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Retoca las preguntas si quieres. Los cambios se guardan solos.
            </p>
            <button
              onClick={() => campaignId && navigate(`${base}/puestos/${campaignId}`)}
              className={`${BTN_PRIMARY} mt-3`}
            >
              Continuar
            </button>
          </>
        )}

        {phase === 'probar' && (
          <>
            <StepProgress current={4} />
            <p className="mt-2 pr-9 text-[15px] font-semibold text-slate-900">Pruébalo tú mismo</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Te falta enviarte una candidatura de prueba para ver cómo llega.
            </p>
            <button
              onClick={() => campaignId && navigate(`${base}/puestos/${campaignId}`)}
              className={`${BTN_PRIMARY} mt-3`}
            >
              Ir a mi puesto
            </button>
          </>
        )}

        {phase === 'hecho' && (
          <div className="flex items-start gap-3">
            {/* El hito del primer uso: la insignia asienta y el check se dibuja de
                un trazo. Un único momento ganado, sobrio; en tinta (el verde es de
                "contratado"). SVG propio para controlar el trazo del dibujo. */}
            <span className="onboarding-badge grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white">
              {/* El trazo se expresa RELATIVO al del sistema, no como un número suelto:
                  es un check de celebración y va más gordo a propósito, pero si algún
                  día se mueve `--stroke-icon` este se mueve con él en vez de quedarse
                  descolgado (que es justo lo que le pasó cuando el sistema bajó a 1,75). */}
              <svg
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeLinecap="round" strokeLinejoin="round"
                className="onboarding-check size-5 [stroke-width:calc(var(--stroke-icon)*1.4)]" aria-hidden
              >
                <path d="M20 6 9 17l-5-5" pathLength={1} />
              </svg>
            </span>
            {/* El hueco que se reserva a la derecha sigue a la equis: con el botón
                a 36px (44 en táctil) y pegado a 8px del filo, un `pr-5` dejaba el
                final de la línea por debajo del control. */}
            <div className="min-w-0 pr-9">
              <p className="text-[15px] font-semibold text-slate-900">Ya está. Tu primera candidatura ha llegado</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                Así entrará cada persona que rellene tu enlace: ordenada y con sus respuestas.
                Cuando publiques tu anuncio, comparte el enlace con quien responda.
              </p>
              {testCandidate && company?.plan === 'trial' && (
                <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                  La candidatura de prueba cuenta para las {PRUEBA_CANDIDATOS} de tu prueba.
                  Bórrala cuando ya no la necesites.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => void setOnboardingDone(true)} className={BTN_PRIMARY}>
                  Terminar
                </button>
                {testCandidate && (
                  <button
                    onClick={() => { deleteCandidate(testCandidate.id); void setOnboardingDone(true) }}
                    className={BTN_SECONDARY}
                  >
                    Borrar la prueba
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Paso 4 incrustado en el hueco de la lista vacía del puesto: la candidatura de
// prueba aparecerá exactamente aquí. Sustituye al empty state SOLO durante la guía.
export function OnboardingTestCard({ campaign, shareUrl, onCopy }: {
  campaign: Campaign
  shareUrl: string
  onCopy: () => void
}) {
  const { reloadCandidatesFor } = useStore()
  const navigate = useNavigate()
  const [waiting, setWaiting] = useState(false)
  const [slow, setSlow] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Si en ~60 s no ha llegado nada, ofrecemos actualizar a mano y la vía de ayuda.
  useEffect(() => {
    if (!waiting) return
    const t = window.setTimeout(() => setSlow(true), 60_000)
    return () => window.clearTimeout(t)
  }, [waiting])

  const openForm = () => {
    setWaiting(true)
    const url = new URL(shareUrl)
    url.searchParams.set('prueba', '1')
    if (window.matchMedia('(min-width: 640px)').matches) {
      // Escritorio: pestaña nueva; el panel queda esperando a la vista.
      window.open(url.toString(), '_blank', 'noopener')
    } else {
      // Móvil: misma pestaña (es la misma SPA); la vuelta la da el botón del
      // "gracias" y, al remontar el panel, la candidatura ya está cargada.
      navigate(url.pathname + url.search)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await reloadCandidatesFor(campaign.id)
    setRefreshing(false)
  }

  if (campaign.status !== 'activa') {
    return (
      <div className="px-6 py-14 text-center">
        <StepProgress current={4} />
        <h2 className="mt-2 text-lg font-semibold text-slate-900">Tu puesto está en pausa</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
          Un puesto en pausa no acepta candidaturas. Reactívalo para probar tu enlace.
        </p>
      </div>
    )
  }

  return (
    <div className="px-6 py-14 text-center">
      <StepProgress current={4} />
      <h2 className="mt-2 text-lg font-semibold text-slate-900">Pruébalo tú mismo</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
        Abre tu enlace, rellena el formulario como si fueras un candidato y envíalo.
        Tu candidatura de prueba aparecerá en esta lista.
      </p>

      <div className="mt-6 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
        <button onClick={openForm} className={BTN_PRIMARY}>
          <ExternalLink className="size-4" aria-hidden /> Abrir mi formulario
        </button>
        <button onClick={onCopy} className={BTN_SECONDARY}>
          <Link2 className="size-4 text-slate-400" aria-hidden /> Copiar enlace
        </button>
      </div>
      <p className="mt-2 hidden text-[12px] text-slate-500 sm:block">Se abre en una pestaña nueva.</p>

      {waiting && (
        <div className="mx-auto mt-7 max-w-sm rounded-xl bg-slate-50 px-4 py-3.5">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-slate-800">
            <Loader2 className="size-4 animate-spin text-slate-500" aria-hidden />
            Esperando tu candidatura de prueba
          </p>
          <p className="mt-1 text-[13px] text-slate-500">En cuanto la envíes, aparecerá aquí sola.</p>
          {slow && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-[13px] text-slate-500">
                ¿No llega? Pulsa Actualizar. Si algo falla, escríbenos desde Ayuda.
              </p>
              <button onClick={refresh} disabled={refreshing} className={`${BTN_SECONDARY} mt-2 disabled:opacity-60`}>
                {refreshing
                  ? <Loader2 className="size-4 animate-spin" aria-hidden />
                  : <RefreshCw className="size-4 text-slate-400" aria-hidden />}
                Actualizar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Paso 2 a pantalla completa: sustituye al empty state de /app mientras la guía
// está activa y aún no hay puestos. Misma rejilla de plantillas que el modal.
export function OnboardingCreatePuesto() {
  const { busy, create } = useCreateFromTemplate()
  const { setOnboardingDone } = useAuth()
  const navigate = useNavigate()
  const base = useAppBase()

  const pick = async (key: string, t?: SectorTemplate) => {
    const c = await create(key, t)
    if (c) navigate(`${base}/puestos/${c.id}/formulario`)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <StepProgress current={2} />
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Crea tu primer puesto</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Elige un punto de partida según tu sector. Podrás cambiarlo todo después.
      </p>
      <div className="mt-6">
        <TemplateGrid busyKey={busy} onPick={pick} />
      </div>
      <button
        onClick={() => void setOnboardingDone(true)}
        className="mt-6 text-[13px] font-medium text-slate-500 underline hover:text-slate-700"
      >
        Ahora no, quiero ver el panel
      </button>
    </div>
  )
}
