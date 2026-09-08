import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react'
import { useStore } from '../lib/store'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import type { Campaign } from '../lib/types'

// ----------------------------------------------------------------------------
// Lo que queda de la guía "en dos actos" tras la torre de primeros pasos (sep
// 2026): el paso de PROBAR, que sigue viviendo incrustado en el hueco de la
// lista vacía del puesto porque la candidatura de prueba aparece literalmente
// donde la tarjeta dice que aparecerá. La torre (`TorreOnboarding`) solo LLEVA
// aquí; la tarjeta flotante y la pantalla completa de crear el primer puesto se
// retiraron con ella. El progreso se deriva de las marcas y los datos
// (`useOnboarding`); aquí solo hay estado efímero: "esperando la candidatura".
// ----------------------------------------------------------------------------

// El paso de probar, incrustado en el hueco de la lista vacía del puesto: la
// candidatura de prueba aparecerá exactamente aquí. Sustituye al empty state
// SOLO mientras ese paso es el actual de la torre.
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

  // Detección de la llegada, solo desde que se pulsa "Abrir mi enlace": al
  // volver a la pestaña se recarga al instante, y mientras está visible sondea
  // suave (5 s los dos primeros minutos, luego 30 s). El canal en vivo del store
  // ya trae la candidatura sola; esto es el respaldo para cuando no llega.
  useEffect(() => {
    if (!waiting) return
    let cancelled = false
    const started = Date.now()
    let timer = 0
    const tick = async () => {
      if (cancelled) return
      if (document.visibilityState === 'visible') await reloadCandidatesFor(campaign.id)
      if (cancelled) return
      timer = window.setTimeout(tick, Date.now() - started < 120_000 ? 5_000 : 30_000)
    }
    const onWake = () => {
      if (document.visibilityState === 'visible') void reloadCandidatesFor(campaign.id)
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
  }, [waiting, campaign.id])

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
        <h2 className="text-lg font-semibold text-slate-900">Tu puesto está en pausa</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
          Un puesto en pausa no acepta candidaturas. Reactívalo para probar tu enlace.
        </p>
      </div>
    )
  }

  return (
    <div className="px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-slate-900">Pruébalo tú mismo</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
        Abre tu enlace, responde como si fueras un candidato y envíalo.
        Tu candidatura de prueba aparecerá en esta lista.
      </p>

      <div className="mt-6 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
        <button onClick={openForm} className={BTN_PRIMARY}>
          <ExternalLink className="size-4" aria-hidden /> Abrir mi enlace
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

