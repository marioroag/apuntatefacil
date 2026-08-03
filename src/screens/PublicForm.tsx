import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Link2Off, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ApplicationForm } from '../components/ApplicationForm'
import { validateField } from '../components/FieldRenderer'
import type { FieldValue } from '../components/FieldRenderer'
import { readableOn } from '../lib/colors'
import { BRAND, publicFormPathPretty } from '../lib/brand'
import { FORM_THANKS_DEFAULT } from '../lib/defaults'
import { CONSENT_VERSION } from '../lib/consent'
import { brandAssetUrl } from '../lib/brandAsset'
import type { Campaign } from '../lib/types'

interface PublicCampaign extends Campaign {
  companyName: string
  logoUrl: string | null
  bannerUrl: string | null
}

export function PublicForm() {
  const { slug } = useParams()
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null)
  // ¿Es la prueba del propio dueño (onboarding)? Se lee UNA vez al montar, ANTES
  // de que el replaceState de abajo embellezca la URL y borre el parámetro de la
  // barra: así el enlace que pueda re-compartirse ya no lleva el marcador y una
  // candidatura real jamás se marca como prueba.
  const [isTest] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('prueba'),
  )

  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'uploading' | 'submitting'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState('')
  const formTop = useRef<HTMLDivElement>(null)
  // Anti-bot sin fricción: campo trampa oculto (honeypot) + tiempo mínimo desde que
  // se monta el formulario. Frena bots que rellenan y envían al instante. No es una
  // barrera fuerte (un ataque directo al RPC la esquiva), pero cubre el spam común.
  const [honeypot, setHoneypot] = useState('')
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    let alive = true
    setState('loading')
    supabase.rpc('get_public_campaign', { p_slug: slug }).then(({ data, error }) => {
      if (!alive) return
      if (error || !data) {
        setState('notfound')
        return
      }
      const d = data as {
        id: string; slug: string; title: string; status: Campaign['status']
        fields: Campaign['fields']; branding: Campaign['branding']; company_name: string
        logo_path: string | null; banner_path: string | null
      }
      setCampaign({
        id: d.id, slug: d.slug, title: d.title, status: d.status,
        sector: '', location: '', createdAt: '', fields: d.fields ?? [], branding: d.branding,
        siteId: null, brandId: null,
        companyName: d.company_name,
        logoUrl: brandAssetUrl(d.logo_path),
        bannerUrl: brandAssetUrl(d.banner_path),
      })
      setState('ok')
      // Embellece la barra con el título ACTUAL sin cambiar el enlace compartido
      // (/<marca>/<slug> -> /<marca>/<slug>/<título>). replaceState directo: no es una
      // navegación de React Router, solo cambia la URL visible. El enlace que se comparte
      // sigue siendo el corto y estable.
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', publicFormPathPretty(d.slug, d.company_name, d.title))
      }
    })
    return () => { alive = false }
  }, [slug])

  if (state === 'loading') {
    return (
      <div className="grid min-h-svh place-items-center bg-slate-50" role="status" aria-label="Cargando">
        <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
      </div>
    )
  }

  if (state === 'notfound' || !campaign || campaign.status === 'cerrada' || campaign.status === 'pausada') {
    const paused = campaign?.status === 'pausada'
    return (
      <CenteredCard>
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
          <Link2Off className="size-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          {paused ? 'Esta oferta no admite candidaturas ahora mismo' : 'Este enlace ya no está activo'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {paused
            ? 'La empresa ha pausado esta oferta. Si crees que es un error, contacta con quien te lo compartió.'
            : 'La empresa ha cerrado esta oferta. Si crees que es un error, contacta con quien te lo compartió.'}
        </p>
      </CenteredCard>
    )
  }

  if (done) return <ThankYou campaign={campaign} isTest={isTest} />

  const onChange = (id: string, v: FieldValue) => {
    setValues((p) => ({ ...p, [id]: v }))
    setErrors((p) => (p[id] ? { ...p, [id]: '' } : p))
  }
  const onBlur = (id: string) => {
    const field = campaign.fields.find((f) => f.id === id)!
    setErrors((p) => ({ ...p, [id]: validateField(field, values[id]) ?? '' }))
  }
  const onFile = (id: string, file: File | null) => {
    setFiles((p) => {
      const next = { ...p }
      if (file) next[id] = file
      else delete next[id]
      return next
    })
  }

  const submit = async () => {
    // Señales de bot: honeypot relleno o envío antes de 1,5 s. Abortamos en silencio
    // (sin crear candidatura ni mostrar error). Un humano que caiga por el tiempo puede
    // reintentar: al segundo clic la ventana ya habrá pasado.
    if (honeypot !== '' || Date.now() - mountedAt.current < 1500) return
    const next: Record<string, string> = {}
    for (const f of campaign.fields) {
      const err = validateField(f, values[f.id])
      if (err) next[f.id] = err
    }
    setErrors(next)
    const consentMissing = !consent
    setConsentError(consentMissing ? 'Marca la casilla para aceptar la política de privacidad.' : '')
    if (Object.values(next).some(Boolean)) {
      formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (consentMissing) {
      // No hay errores de campos, solo falta el consentimiento: lo enfocamos (está junto al botón).
      const el = document.getElementById('consent-check')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus({ preventScroll: true })
      return
    }
    setSubmitError(null)

    // Sube el primer CV adjunto (si hay) al bucket cvs.
    let cvPath: string | null = null
    const fileEntry = Object.values(files)[0]
    if (fileEntry) {
      setSubmitPhase('uploading')
      const ext = fileEntry.name.split('.').pop()?.toLowerCase() || 'pdf'
      const path = `${campaign.slug}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('cvs').upload(path, fileEntry, { upsert: false })
      if (up.error) {
        setSubmitPhase('idle')
        setSubmitError('No pudimos subir tu CV. Inténtalo de nuevo o quítalo para continuar.')
        formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      cvPath = up.data.path
    }

    setSubmitPhase('submitting')
    const { data: candidateId, error } = await supabase.rpc('submit_application', {
      p_slug: campaign.slug,
      p_answers: values,
      p_source: isTest ? 'prueba' : 'enlace',
      p_cv_path: cvPath,
      // Qué texto aceptó. La FECHA la pone el servidor: es la prueba, y una
      // prueba que manda el cliente no prueba nada.
      p_consent_version: CONSENT_VERSION,
    })
    setSubmitPhase('idle')
    if (error) {
      // El CV ya se subió antes del RPC: si la candidatura se rechaza, lo borramos
      // para no dejar ficheros huérfanos (con PII) sin candidato que los referencie.
      if (cvPath) supabase.storage.from('cvs').remove([cvPath]).catch(() => {})
      // El puesto puede haberse llenado o pausado entre que se cargó y se envió.
      const msg = error.message ?? ''
      const full = msg.includes('CANDIDATE_LIMIT_REACHED') || msg.includes('no acepta candidaturas')
      setSubmitError(
        full
          ? 'Esta oferta ya ha cubierto todas sus plazas y no admite más candidaturas.'
          : 'No pudimos enviar tu candidatura. Inténtalo de nuevo.',
      )
      formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    // Aviso al merchant por email + triaje de Meridian (ambos best-effort, no
    // bloquean la pantalla de gracias). La función gatea por plan y clave: si la
    // empresa no es Pro/Multi, es un no-op silencioso.
    if (candidateId) {
      supabase.functions.invoke('notify-new-candidate', { body: { candidate_id: candidateId } }).catch(() => {})
      supabase.functions.invoke('analyze-candidate', { body: { candidate_id: candidateId, auto: true } }).catch(() => {})
    }
    setDone(true)
  }

  const cleanErrors = Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Record<string, string>

  return (
    <div className="min-h-svh bg-slate-50 px-4 py-8 sm:py-12">
      <div ref={formTop} className="mx-auto w-full max-w-[480px]">
        {submitError && (
          <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {submitError}
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7">
          <ApplicationForm
            campaign={campaign}
            values={values}
            errors={cleanErrors}
            onChange={onChange}
            onBlur={onBlur}
            onFile={onFile}
            onSubmit={submit}
            submitPhase={submitPhase}
            companyName={campaign.companyName}
            logoUrl={campaign.logoUrl}
            bannerUrl={campaign.bannerUrl}
            consent={consent}
            onConsentChange={(v) => { setConsent(v); setConsentError('') }}
            consentError={consentError}
          />
          {/* Honeypot: invisible y fuera del recorrido de teclado/lector. Un humano no lo
              rellena; un bot que autocompleta campos, sí. Envuelto en un contenedor 0x0 con
              overflow-hidden: oculta sin sacarlo de pantalla (nada de -left:-9999px, que
              provocaría scroll horizontal) y sin display:none (que algunos bots saltan). */}
          <div aria-hidden="true" className="h-0 w-0 overflow-hidden">
            <input
              type="text"
              name="empresa_web"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
        </div>
        <p className="mt-4 text-center text-[12px] text-slate-500">Formulario con {BRAND}</p>
      </div>
    </div>
  )
}

function ThankYou({ campaign, isTest = false }: { campaign: PublicCampaign; isTest?: boolean }) {
  const h1 = useRef<HTMLHeadingElement>(null)
  useEffect(() => { h1.current?.focus() }, [])
  const accent = campaign.branding.accent
  return (
    <div
      className="min-h-svh bg-slate-50 px-4 py-8 sm:py-12"
      style={{ ['--accent' as string]: accent, ['--accent-contrast' as string]: readableOn(accent) }}
    >
      <div className="mx-auto w-full max-w-[480px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-card" role="status">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
            className="mx-auto grid size-14 place-items-center rounded-full bg-green-100 text-green-600"
          >
            <Check className="size-7" aria-hidden />
          </motion.div>
          <h1 ref={h1} tabIndex={-1} className="mt-4 text-[22px] font-bold tracking-tight text-slate-900 outline-none">
            Gracias, hemos recibido tu candidatura
          </h1>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">
            {campaign.branding.thanks || FORM_THANKS_DEFAULT}
          </p>
          {/* Solo en la candidatura de prueba del dueño (onboarding): el camino de
              vuelta a su lista. Un candidato real nunca ve este botón. */}
          {isTest && (
            <Link
              to={`/app/puestos/${campaign.id}`}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-[15px] font-semibold text-white hover:bg-slate-800"
            >
              Volver a tu lista de candidatos
            </Link>
          )}
        </div>
        <p className="mt-4 text-center text-[12px] text-slate-500">
          Formulario con {BRAND}, enviado a {campaign.companyName}
        </p>
      </div>
    </div>
  )
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-card">
        {children}
      </div>
    </div>
  )
}
