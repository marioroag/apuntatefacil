import { useEffect, useState } from 'react'
import { Check, CircleAlert, Loader2 } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { BTN_PRIMARY } from '../lib/buttons'
import { supabase } from '../lib/supabase'
import type { CandidateInterestResponse } from '../lib/types'

type ResponseStatus = 'loading' | 'ready' | 'confirming' | 'done' | 'invalid' | 'expired' | 'superseded' | 'error'

interface InterestContext {
  companyName: string
  campaignTitle: string
  savedResponse: CandidateInterestResponse | null
}

function isResponse(value: string | null): value is CandidateInterestResponse {
  return value === 'interested' || value === 'not_interested'
}

export function InterestResponse() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const selectedResponse = params.get('respuesta')
  const [status, setStatus] = useState<ResponseStatus>('loading')
  const [context, setContext] = useState<InterestContext | null>(null)

  useEffect(() => {
    let alive = true
    supabase.rpc('get_candidate_interest_response', { p_token: token }).then(({ data, error }) => {
      if (!alive) return
      if (error || !data) {
        setStatus('error')
        return
      }
      const result = data as {
        status: string
        company_name?: string
        campaign_title?: string
        response?: CandidateInterestResponse | null
      }
      if (result.status !== 'ok') {
        setStatus(result.status === 'expired' || result.status === 'superseded' ? result.status : 'invalid')
        return
      }
      setContext({
        companyName: result.company_name ?? 'La empresa',
        campaignTitle: result.campaign_title ?? 'tu candidatura',
        savedResponse: result.response ?? null,
      })
      setStatus(isResponse(selectedResponse) ? 'ready' : 'invalid')
    })
    return () => { alive = false }
  }, [selectedResponse, token])

  const confirm = async () => {
    if (!isResponse(selectedResponse)) return
    setStatus('confirming')
    const { data, error } = await supabase.rpc('confirm_candidate_interest_response', {
      p_token: token,
      p_response: selectedResponse,
    })
    if (error || !data) {
      setStatus('error')
      return
    }
    const result = data as { status: string }
    if (result.status === 'ok') {
      setContext((current) => current ? { ...current, savedResponse: selectedResponse } : current)
      setStatus('done')
    } else {
      setStatus(result.status === 'expired' || result.status === 'superseded' ? result.status : 'invalid')
    }
  }

  if (status === 'loading') {
    return <PageCard><Loader2 className="mx-auto size-6 animate-spin text-slate-400" aria-label="Cargando" /></PageCard>
  }

  if (status === 'done' && context) {
    return (
      <PageCard>
        <StatusIcon success />
        <h1 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-slate-950">Respuesta guardada</h1>
        <p className="mt-2 text-pretty text-sm leading-6 text-slate-600">
          Tu respuesta se ha guardado. {context.companyName} podrá verla en tu candidatura.
        </p>
      </PageCard>
    )
  }

  if (status === 'ready' || status === 'confirming') {
    const interested = selectedResponse === 'interested'
    return (
      <PageCard>
        <div className="text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{context?.companyName}</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-950">Confirma tu respuesta</h1>
          <p className="mt-2 text-pretty text-sm leading-6 text-slate-600">
            La empresa quiere saber si sigues interesado/a en <span className="font-medium text-slate-800">{context?.campaignTitle}</span>.
          </p>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <p className="text-xs font-medium text-slate-500">Tu respuesta</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {interested ? 'Sí, sigo interesado/a' : 'No, ya no me interesa'}
            </p>
          </div>
          {context?.savedResponse && context.savedResponse !== selectedResponse && (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Ya habías respondido. Al confirmar, sustituiremos tu respuesta anterior por esta.
            </p>
          )}
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={status === 'confirming'}
            className={`${BTN_PRIMARY} mt-6 w-full disabled:cursor-wait disabled:opacity-70`}
          >
            {status === 'confirming' && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Confirmar respuesta
          </button>
        </div>
      </PageCard>
    )
  }

  const messages: Record<'invalid' | 'expired' | 'superseded' | 'error', { title: string; body: string }> = {
    invalid: {
      title: 'Este enlace no es válido',
      body: 'Comprueba que has abierto el enlace completo del correo. Si el problema continúa, contacta con la empresa.',
    },
    expired: {
      title: 'Este enlace ha caducado',
      body: 'La comprobación ya no está activa. Si sigues interesado/a, contacta directamente con la empresa.',
    },
    superseded: {
      title: 'Hay una comprobación más reciente',
      body: 'Este enlace fue sustituido. Usa el correo más reciente que te haya enviado la empresa.',
    },
    error: {
      title: 'No pudimos cargar la comprobación',
      body: 'Revisa tu conexión e inténtalo de nuevo dentro de unos instantes.',
    },
  }
  const message = messages[status as keyof typeof messages]
  return (
    <PageCard>
      <StatusIcon />
      <h1 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-slate-950">{message.title}</h1>
      <p className="mt-2 text-pretty text-sm leading-6 text-slate-600">{message.body}</p>
      {status === 'error' && (
        <button type="button" onClick={() => window.location.reload()} className={`${BTN_PRIMARY} mt-6 w-full`}>
          Volver a intentarlo
        </button>
      )}
    </PageCard>
  )
}

function StatusIcon({ success = false }: { success?: boolean }) {
  return (
    <div className={`mx-auto grid size-12 place-items-center rounded-xl ${success ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      {success ? <Check className="size-6" aria-hidden /> : <CircleAlert className="size-6" aria-hidden />}
    </div>
  )
}

function PageCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold tracking-tight text-slate-900">
          <Logo className="size-6" />
          <span>apuntatefacil</span>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-card sm:px-8">
          {children}
        </section>
        <p className="mt-4 text-center text-xs text-slate-400">Respuesta segura. No compartas este enlace.</p>
      </div>
    </main>
  )
}
