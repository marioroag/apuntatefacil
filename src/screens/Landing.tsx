import { useEffect, useId, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  ArrowRight, Check, ChevronRight, Database, FileSpreadsheet, Filter,
  Infinity as InfinityIcon, Link2, ListChecks, Megaphone, Menu, MessagesSquare,
  Phone, PhoneCall, RotateCcw, Sliders, Trash2, Users, X,
  type LucideIcon,
} from 'lucide-react'
import { initials, memberAvatarTone } from '../lib/format'
import { STATUS_META, type CandidateStatus } from '../lib/types'
import { BrowserMock } from '../components/BrowserMock'
import { Logo } from '../components/Logo'
import { BetaBadge } from '../components/BetaBadge'
import { BRAND, TAGLINE } from '../lib/brand'
import { SupportDialog } from '../components/SupportDialog'
import {
  COST_TRUTHS,
  COST_TRUTHS_FOOTNOTE,
  TIERS,
  TRIAL_REASSURANCE,
  PLAN_PROCESS_LIMIT,
  type Tier,
} from '../lib/pricing'
import { TierPrice } from '../components/TierPrice'
import { BTN_INVERTED_LG, BTN_PRIMARY, BTN_PRIMARY_LG, BTN_SECONDARY_LG } from '../lib/buttons'

const DEFAULT_PRICING_TIER = 'pro'

const TIER_TAB_HINT: Record<string, string> = {
  esencial: '2 procesos',
  pro: '10 procesos',
  multi: 'Ilimitado',
}

const SECTORS = ['Construcción', 'Logística', 'Limpieza', 'Reformas', 'Comercio', 'Cuidados']

// Muestra mini de "la lista en una pantalla" para el feature-héroe: estados con su
// paleta fija (nuevo slate, contactado azul, contratado verde), punto + texto.
const FEATURE_MINI = [
  { ini: 'LF', name: 'Lucía Fernández', role: 'Mozo/a almacén', label: 'Nuevo', pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
  { ini: 'SV', name: 'Sergio Vidal', role: 'Electricista', label: 'Nuevo', pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
  { ini: 'ME', name: 'Mohamed El Amrani', role: 'Peón albañil', label: 'Contactado', pill: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  { ini: 'MG', name: 'Marta Gil', role: 'Carretillera', label: 'Entrevista', pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { ini: 'DR', name: 'David Romero', role: 'Oficial 1ª', label: 'Contratado', pill: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
]

// Entrada sobria con animación CSS en montaje (fill 'both' deja el estado final;
// reduced-motion la vuelve instantánea con el CSS global). No depende de
// IntersectionObserver, así nada se queda invisible en un preview embebido.
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={className} style={{ animation: `reveal-up .5s var(--ease-out) ${delay}s both` }}>
      {children}
    </div>
  )
}

export function Landing() {
  // Si ya hay sesión, el sitio "abre" directo en el panel, no en el marketing.
  const { session, loading } = useAuth()
  if (!loading && session) return <Navigate to="/app" replace />

  return (
    <div className="min-h-svh bg-white text-slate-900">
      <SkipLink />
      <TopNav />
      <main id="contenido">
        <Hero />
        <Sectors />
        <Compare />
        <HowItWorks />
        <Features />
        <Team />
        <CostAnchor />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

// Lockup de marca de la landing: mark bicolor + wordmark "apuntatefacil" (una
// palabra, minúsculas, sin tildes, estilo dominio) en Manrope extrabold, tinta
// sólida. El nombre propio "Apúntate Fácil" se expone a lectores de pantalla con un
// sr-only. Solo en la landing; el resto de la app usa el <Logo/> (solo el monograma).
function BrandLockup({ compact = false }: { compact?: boolean }) {
  const markSize = compact ? 'size-7' : 'size-8'
  const textSize = compact ? 'text-sm' : 'text-lockup'
  return (
    <span className="flex items-center gap-2">
      <Logo className={markSize} />
      <span className={`${textSize} brand-wordmark text-slate-900`} aria-hidden translate="no">apuntatefacil</span>
      <BetaBadge />
      <span className="sr-only">{BRAND}</span>
    </span>
  )
}

function SkipLink() {
  return (
    <a
      href="#contenido"
      className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-[max(1rem,env(safe-area-inset-top))] focus-visible:z-50 focus-visible:rounded-lg focus-visible:bg-indigo-600 focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-white"
    >
      Saltar al contenido
    </a>
  )
}

function TopNav() {
  const [open, setOpen] = useState(false)
  const links = [
    ['Cómo funciona', '#como-funciona'],
    ['Precio', '#precio'],
    ['Preguntas', '#faq'],
  ] as const
  // Esc cierra el menú móvil (teclado en pantallas estrechas).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6" aria-label="Principal">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center" aria-label={BRAND}>
            <BrandLockup />
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {links.map(([label, href]) => (
              <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <Link to="/demo" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Ver la demo
          </Link>
          <Link to="/login" className={`${BTN_PRIMARY} group ml-1`}>
            Empezar <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="grid size-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Menú" aria-expanded={open}>
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 motion-reduce:animate-none md:hidden" style={{ animation: 'drop-in .18s var(--ease-out)' }}>
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200">
              {label}
            </a>
          ))}
          {/* Acciones separadas de los enlaces de sección (espeja el nav de escritorio). */}
          <div className="mt-2 border-t border-slate-100 pt-2">
            <Link to="/demo" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200">
              Ver la demo
            </Link>
            <Link to="/login" onClick={() => setOpen(false)} className={`${BTN_PRIMARY} mt-1 w-full`}>
              Empezar <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-10 px-4 pb-12 pt-14 sm:px-6 lg:grid-cols-[1.04fr_1fr] lg:pb-20 lg:pt-24">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-label font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          Para contratar desde anuncios y mensajes
        </span>
        <h1 className="mt-4 text-balance text-hero font-[680] text-slate-900 sm:text-hero-lg">
          Todas las respuestas a tu anuncio, en un solo lugar
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-slate-600">
          Sigue publicando en Milanuncios, WhatsApp, Instagram o donde quieras. Envía un enlace y recibe cada candidatura completa, ordenada y filtrable en un solo sitio.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link to="/login" className={`${BTN_PRIMARY_LG} group`}>
            Crea tu primer puesto gratis <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link to="/demo" className={BTN_SECONDARY_LG}>
            Ver la demo
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">{TRIAL_REASSURANCE}</p>
      </div>
      <div className="relative">
        <div className="absolute -inset-4 -z-10 rounded-2xl bg-slate-50" aria-hidden />
        <BrowserMock dropIn />
      </div>
    </section>
  )
}

function Sectors() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-center text-copy-md font-medium text-slate-600">
          Para construcción, hostelería, logística, comercio y mucho más
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {SECTORS.map((s) => (
            <span key={s} className="rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// Burbujas de chat para la sección comparativa.
function Bubble({ children, from, muted = false }: { children: React.ReactNode; from: 'them' | 'you'; muted?: boolean }) {
  if (from === 'them') {
    return (
      <div
        className={`max-w-[82%] self-start rounded-2xl rounded-tl-md px-3.5 py-2 text-copy leading-snug ring-1 ${
          muted ? 'bg-slate-100 italic text-slate-500 ring-slate-200/70' : 'bg-white text-slate-700 ring-slate-200'
        }`}
      >
        {children}
      </div>
    )
  }
  return (
    <div className="max-w-[82%] self-end rounded-2xl rounded-tr-md bg-slate-200/80 px-3.5 py-2 text-copy leading-snug text-slate-700">
      {children}
    </div>
  )
}

function ChatTime({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-center text-caption text-slate-500">{children}</p>
}

function Compare() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl section-x section-y">
        <Reveal className="text-center">
          <p className="text-sm font-semibold text-slate-500">La misma vacante, dos conversaciones</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-heading-xl">
            Mira la diferencia en el propio chat
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
            Primero, la conversación de siempre: preguntas sueltas y respuestas a medias. Después, un enlace y el perfil completo en tu lista.
          </p>
        </Reveal>

        {/* grid-cols-1 explícito en móvil: sin él la columna es un track `auto` que se dimensiona
            al contenido de las tarjetas de chat y crece más que el viewport (overflow). Con
            minmax(0,1fr) las tarjetas se acotan al ancho disponible. */}
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Antes: por el chat */}
          <Reveal>
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-caption font-bold text-slate-500">AN</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-copy-md font-semibold text-slate-900">Antonio, respuesta al anuncio</p>
                  <p className="truncate text-label text-slate-500">por el chat, como hasta ahora</p>
                </div>
                <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-caption font-semibold text-red-600 ring-1 ring-inset ring-red-100">Poco eficaz</span>
              </div>
              <div className="flex flex-1 flex-col gap-2.5 bg-slate-50 px-4 py-5">
                <ChatTime>Lunes, 10:42</ChatTime>
                <Bubble from="them">Hola, ¿sigue libre lo del peón?</Bubble>
                <Bubble from="you">Sí. ¿Qué experiencia tienes?</Bubble>
                <Bubble from="them">algo de obra</Bubble>
                <Bubble from="you">¿Cuántos años? ¿Tienes carnet de conducir?</Bubble>
                <ChatTime>11:58, más de una hora después</ChatTime>
                <Bubble from="them">si carnet B</Bubble>
                <Bubble from="you">¿De qué zona eres? ¿Puedes empezar mañana a las 8?</Bubble>
                <p className="self-end pr-1 text-caption text-slate-500">Visto ✓✓, sin respuesta</p>
                <Bubble from="them" muted>…y lo mismo con otros 37 candidatos</Bubble>
              </div>
            </div>
          </Reveal>

          {/* Después: con Apúntate Fácil */}
          <Reveal delay={0.08} className="resolved-card">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-green-200 bg-white shadow-card">
              <div className="flex items-center gap-3 border-b border-green-100 px-4 py-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-green-100 text-caption font-bold text-green-700">AN</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-copy-md font-semibold text-slate-900">Antonio, respuesta al anuncio</p>
                  <p className="truncate text-label text-slate-500">con {BRAND}</p>
                </div>
                <span className="resolved-stamp shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-caption font-semibold text-green-700 ring-1 ring-inset ring-green-200">Resuelto</span>
              </div>
              <div className="flex flex-1 flex-col gap-2.5 bg-green-50/50 px-4 py-5">
                <ChatTime>Lunes, 10:42</ChatTime>
                <Bubble from="them">Hola, ¿sigue libre lo del peón?</Bubble>
                <div className="max-w-[82%] self-end rounded-2xl rounded-tr-md bg-slate-200/80 px-3.5 py-2 text-copy leading-snug text-slate-700">
                  ¡Hola! Sí 🙂 Apúntate aquí en 1 min y me llega todo:{' '}
                  <span className="font-semibold underline decoration-slate-400 underline-offset-2">apuntatefacil.com/peon</span>
                </div>
                <ChatTime>10:44, dos minutos después</ChatTime>
                <Bubble from="them">¡Hecho! 👍</Bubble>

                <div className="mt-1.5 rounded-xl border border-green-200 bg-white p-3.5">
                  <p className="flex items-center gap-1.5 text-label font-semibold text-green-700">
                    <Check className="size-4 shrink-0" aria-hidden /> Te llega ordenado en tu lista, sin preguntar nada
                  </p>
                  <div className="mt-3 flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-caption font-bold text-slate-500">AN</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-copy font-semibold text-slate-900">Antonio Navarro</p>
                      <p className="truncate text-caption text-slate-500">Carpintero, 8 años</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-micro font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">Nuevo</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {['Carnet B', 'Zona: Getafe', 'Empieza ya', '627 41…'].map((p) => (
                      <span key={p} className="rounded-lg bg-slate-50 px-2.5 py-1 text-caption font-medium text-slate-600 ring-1 ring-inset ring-slate-200 tabular-nums">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { icon: Megaphone, title: 'Publica tu anuncio', body: 'El anuncio sigue en tu canal habitual y las respuestas llegan por ahí. No cambias dónde publicas ni cómo te encuentran.' },
    { icon: Link2, title: 'Envía un enlace al candidato', body: 'Cuando llega una respuesta, compartes un enlace con las preguntas del puesto. El candidato completa el formulario en el móvil, con menos fricción que el chat.' },
    { icon: ListChecks, title: 'Gestiona todo desde un panel', body: 'Cada candidatura queda en tu lista, ordenada. Filtras por lo relevante, actualizas el estado y decides a quién contactar.' },
  ]
  return (
    <section id="como-funciona" className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl section-x section-y">
        <Reveal>
          <h2 className="max-w-2xl text-balance text-3xl font-bold tracking-tight text-slate-900 max-lg:mx-auto max-lg:text-center sm:text-4xl">
            Tres pasos para dejar de gestionar por chat
          </h2>
        </Reveal>
        <div className="relative mt-12">
          <div className="relative grid gap-10 lg:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="relative text-center lg:text-left">
                  {i < steps.length - 1 ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-5 z-0 hidden h-px bg-slate-200 lg:block"
                      style={{ left: '1.25rem', width: 'calc(100% - 1.25rem + 2.5rem)' }}
                    />
                  ) : null}
                  <div className="relative z-10 mx-auto grid size-10 place-items-center rounded-full bg-slate-900 text-white ring-8 ring-slate-50 lg:mx-0">
                    <s.icon className="size-5" aria-hidden />
                    <span className="sr-only">Paso {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-copy-md text-slate-600 lg:mx-0 lg:max-w-none">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const FEATURE_MINI_MOBILE_COUNT = 3

function FeatureMiniRow({ m, index }: { m: (typeof FEATURE_MINI)[number]; index: number }) {
  return (
    <div className={`flex items-center gap-3 px-3.5 py-2.5 ${index > 0 ? 'border-t border-slate-200/70' : ''}`}>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-micro font-bold text-slate-500 ring-1 ring-slate-200">{m.ini}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label font-medium text-slate-800">{m.name}</span>
        <span className="block text-micro text-slate-500">{m.role}</span>
      </span>
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-micro font-medium ${m.pill}`}>
        <span className={`size-1.5 shrink-0 rounded-full ${m.dot}`} aria-hidden />
        {m.label}
      </span>
    </div>
  )
}

function FeatureMiniList({ rows }: { rows: typeof FEATURE_MINI }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      {rows.map((m, i) => (
        <FeatureMiniRow key={m.name} m={m} index={i} />
      ))}
    </div>
  )
}

function FeaturesHeroCard({
  icon: Icon,
  title,
  body,
  compactMock,
}: {
  icon: LucideIcon
  title: string
  body: string
  compactMock: boolean
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white card-pad shadow-card lg:card-pad-loose">
      <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-copy-md text-slate-600">{body}</p>
      {compactMock ? (
        <FeatureMiniList rows={FEATURE_MINI.slice(0, FEATURE_MINI_MOBILE_COUNT)} />
      ) : (
        <div className="mt-6 min-h-0 flex-1">
          <BrowserMock dropIn className="shadow-card" />
        </div>
      )}
    </div>
  )
}

function FeatureSecondaryRow({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex gap-3.5 px-6 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <h3 className="text-copy-md font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-copy leading-relaxed text-slate-600">{body}</p>
      </div>
    </div>
  )
}

function FeatureSecondaryCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-title font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-copy-md text-slate-600">{body}</p>
    </div>
  )
}

function Features() {
  const items = [
    { icon: ListChecks, title: 'Todas las respuestas en una sola pantalla', body: 'Cada candidatura entra en tu lista, ordenada y junta. Sin revisar conversaciones dispersas ni anotar datos en otro sitio.' },
    { icon: Filter, title: 'Filtra por carnet, zona y experiencia', body: 'Identifica en segundos a quien encaja. Carnet, zona o los criterios del puesto: descarta el resto con un clic.' },
    { icon: PhoneCall, title: 'Estado de cada candidato, siempre visible', body: 'Marca el estado según avanzas. Evita contactar dos veces al mismo perfil y no pierdas candidatos relevantes.' },
    { icon: Sliders, title: 'Formulario adaptado a cada puesto', body: 'Defines las preguntas del puesto. El candidato las responde en el móvil, con mayor tasa de finalización.' },
    { icon: FileSpreadsheet, title: 'Exportación a Excel cuando la necesites', body: 'Tus candidatos son tuyos. Exporta la lista a Excel en cualquier momento, también si dejas el servicio.' },
    { icon: InfinityIcon, title: 'Candidatos sin límite', body: 'Recibe 20 candidaturas o 200: todas quedan en tu lista. En Pro, tu equipo colabora sin coste por usuario.' },
  ]
  const [hero, ...rest] = items
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl section-x section-y">
        <h2 className="max-w-2xl text-balance text-3xl font-bold tracking-tight text-slate-900 max-lg:mx-auto max-lg:text-center sm:text-4xl">
          Todo lo que necesitas para elegir bien, sin perder a nadie
        </h2>

        {/* Móvil/tablet: hero compacto + panel de filas */}
        <div className="mt-12 lg:hidden">
          <FeaturesHeroCard icon={hero.icon} title={hero.title} body={hero.body} compactMock />
          <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-card">
            {rest.map((it) => (
              <FeatureSecondaryRow key={it.title} icon={it.icon} title={it.title} body={it.body} />
            ))}
          </div>
        </div>

        {/* Escritorio: bento 2×2 + tarjetas */}
        <div className="mt-12 hidden gap-5 lg:grid lg:grid-cols-3">
          <div className="lg:col-span-2 lg:row-span-2">
            <FeaturesHeroCard icon={hero.icon} title={hero.title} body={hero.body} compactMock={false} />
          </div>
          {rest.map((it) => (
            <FeatureSecondaryCard key={it.title} icon={it.icon} title={it.title} body={it.body} />
          ))}
        </div>
      </div>
    </section>
  )
}

// Mock condensado del panel real (req_inventario de la demo): misma anatomía
// que TeamRequestPanel, pero solo el tramo que cuenta la historia, para empatar
// la altura del copy de la sección.
const TEAM_PROPOSALS: { name: string; role: string; status: CandidateStatus }[] = [
  { name: 'Óscar Ortega', role: 'Mozo/a de almacén', status: 'contratado' },
  { name: 'Elena Serrano', role: 'Mozo/a de almacén', status: 'contratado' },
]

function TeamBoardMock() {
  const sergio = memberAvatarTone('sergio@tuempresa.es')
  const laura = memberAvatarTone('laura@tuempresa.es')
  const you = memberAvatarTone('demo@apuntatefacil.com')

  return (
    <div aria-hidden className="relative">
      <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {/* Cabecera tipo SlideOver */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <p className="min-w-0 flex-1 text-balance text-[15px] font-semibold leading-snug text-slate-900 sm:text-base">
            Refuerzo para el inventario del sábado
          </p>
          <div className="-mr-1 flex shrink-0 items-center gap-0.5 text-slate-500">
            <span className="grid size-8 place-items-center rounded-lg">
              <RotateCcw className="size-4" />
            </span>
            <span className="grid size-8 place-items-center rounded-lg">
              <Trash2 className="size-4" />
            </span>
            <span className="grid size-8 place-items-center rounded-lg">
              <X className="size-4" />
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <p className="text-[13px] leading-snug text-slate-600 sm:text-sm sm:leading-5">
            Dos mozos para el recuento anual en Madrid, jornada de 8 a 15. Se paga plus de fin de semana.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-slate-800">2 candidatos propuestos</p>
            <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {TEAM_PROPOSALS.map((p, i) => {
                const meta = STATUS_META[p.status]
                return (
                  <li
                    key={p.name}
                    className={`flex min-h-10 items-center gap-0.5 pr-1 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                        {initials(p.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-4 text-slate-900">{p.name}</span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
                          <span className="inline-flex items-center gap-1.5 text-[12px] leading-4 text-slate-500">
                            <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} />
                            <span>{meta.label}</span>
                          </span>
                          <span className="shrink-0 text-slate-300">·</span>
                          <span className="truncate text-[12px] leading-4 text-slate-500">{p.role}</span>
                        </span>
                      </span>
                    </span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500">
                      <Phone className="size-3.5" />
                    </span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400">
                      <X className="size-3.5" />
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Actividad</p>
              <span className="num text-[12px] text-slate-500">3 mensajes</span>
            </div>
            <ol className="flex flex-col">
              <li className="flex gap-3">
                <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${laura.bg} ${laura.text}`}>
                  {initials('laura@tuempresa.es')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-x-1.5 text-[13px]">
                    <span className={`font-semibold ${laura.name}`}>laura</span>
                    <span className="text-slate-300">·</span>
                    <span className="num text-slate-500">19:24</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-[1.45] text-slate-700 sm:text-[14px]">
                    Solo sábado, 8 a 15. Plus de fin de semana incluido.
                  </p>
                </div>
              </li>
              <li className="mt-3 flex gap-3 border-t border-slate-100 pt-3">
                <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${you.bg} ${you.text}`}>
                  {initials('demo@apuntatefacil.com')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-x-1.5 text-[13px]">
                    <span className="font-semibold text-slate-900">Tú</span>
                    <span className="text-slate-300">·</span>
                    <span className="num text-slate-500">19:44</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-[1.45] text-slate-700 sm:text-[14px]">
                    Estos dos viven cerca de la nave y tienen disponibilidad inmediata.
                  </p>
                  <span className="mt-2 flex min-h-9 w-full max-w-md items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-3">
                    <span className="flex shrink-0 items-center pl-0.5">
                      {TEAM_PROPOSALS.map((p, i) => (
                        <span
                          key={p.name}
                          className={`grid size-7 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white ring-2 ring-white ${i > 0 ? '-ml-1.5' : ''}`}
                          style={{ zIndex: TEAM_PROPOSALS.length - i }}
                        >
                          {initials(p.name)}
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">2 candidatos</span>
                    <ChevronRight className="size-3.5 shrink-0 text-slate-400" />
                  </span>
                </div>
              </li>
              <li className="mt-3 flex gap-3 border-t border-slate-100 pt-3">
                <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${sergio.bg} ${sergio.text}`}>
                  {initials('sergio@tuempresa.es')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-x-1.5 text-[13px]">
                    <span className="font-semibold text-slate-900">sergio</span>
                    <span className="text-slate-300">·</span>
                    <span className="num text-slate-500">03:24</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-[1.45] text-slate-700 sm:text-[14px]">
                    Les he escrito por WhatsApp. Confirman los dos. Los paso a contactado.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <p className="text-[13px] text-slate-500">Petición completada por ti.</p>
          <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-medium text-slate-800 ring-1 ring-slate-300/80 shadow-[0_1px_2px_rgba(18,22,34,0.06)]">
            <RotateCcw className="size-3.5" />
            Reabrir
          </span>
        </div>
      </div>
    </div>
  )
}

function Team() {
  const points = [
    {
      icon: MessagesSquare,
      title: 'Reúne en un tablón lo que hoy se reparte por mensajes',
      body: 'Cada respuesta incluye perfil, estado y teléfono. Sin buscar el hilo en el chat.',
    },
    {
      icon: Database,
      title: 'Recupera candidatos de procesos anteriores',
      body: 'Dejan de perderse en mensajes o correos. El equipo los propone cuando vuelve a hacer falta cubrir un puesto.',
    },
    {
      icon: Users,
      title: 'Mantén al equipo alineado sobre cada necesidad',
      body: 'La petición, las propuestas y el contacto viven en el mismo flujo. Menos ida y vuelta, más decisiones con información completa.',
    },
  ]
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 section-x section-y lg:grid-cols-2 lg:items-start lg:gap-14">
        <Reveal delay={0.08} className="max-lg:order-last lg:pl-4">
          <TeamBoardMock />
        </Reveal>
        <Reveal>
          <p className="text-sm font-semibold text-slate-500">Equipo, desde el plan Pro</p>
          <h2 className="mt-3 max-w-xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Coordina necesidades internas con tu base de candidatos
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-slate-600">
            Publica en el tablón lo que necesitas cubrir. Tu equipo propone candidatos de la base, con estado y teléfono, listos para llamar.
          </p>
          <ul className="mt-7 space-y-4">
            {points.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <p.icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-copy-md font-semibold text-slate-900">{p.title}</h3>
                  <p className="mt-1 max-w-md text-copy leading-relaxed text-slate-600">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/demo/equipo" className={`${BTN_SECONDARY_LG} mt-7`}>
            Ver el tablón en la demo
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

// Señuelo explícito de la tarjeta Pro: la comparación de capacidad frente a
// Esencial (p. ej. "5× la capacidad de Esencial"), calculada de los datos reales.
function proDecoyLine(): string | null {
  const esencial = TIERS.find((x) => x.id === 'esencial')
  const pro = TIERS.find((x) => x.id === 'pro')
  if (!esencial || !pro) return null
  const times = PLAN_PROCESS_LIMIT.pro / PLAN_PROCESS_LIMIT.esencial
  return `${times}× la capacidad de Esencial`
}

function PricingTierCard({ tier: t, annual, gridEmphasis = false }: { tier: Tier; annual: boolean; gridEmphasis?: boolean }) {
  const recommended = !!t.recommended
  // En la landing, el bullet de capacidad de Pro es redundante con el badge
  // "10 procesos a la vez" de justo encima. Se filtra SOLO aquí: en /app/plan
  // no hay badge y ese bullet sigue siendo la única mención a la capacidad.
  const features = t.id === 'pro' ? t.features.filter((f) => !f.includes('10 procesos')) : t.features
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl card-pad ${
        t.available === false
          ? 'border border-slate-200 bg-slate-50'
          : recommended
            ? `border-2 border-indigo-600 bg-white shadow-card${gridEmphasis ? ' lg:scale-[1.02] lg:z-10' : ''}`
            : 'border border-slate-200 bg-white shadow-card'
      }`}
    >
      {t.available === false ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-200 px-3 py-1 text-caption font-semibold text-slate-500">
          Próximamente
        </span>
      ) : recommended ? (
        <span className="hidden rounded-full bg-indigo-600 px-3 py-1 text-caption font-semibold text-white ring-1 ring-inset ring-indigo-800/60 lg:absolute lg:-top-3 lg:left-1/2 lg:inline-flex lg:-translate-x-1/2">
          Recomendado
        </span>
      ) : null}
      <h3 className="text-lg font-semibold text-slate-900">{t.name}</h3>
      <p className="mt-1 text-copy text-slate-500">{t.tagline}</p>
      <TierPrice tier={t} annual={annual} />
      <p className="mt-4 inline-flex w-fit rounded-lg bg-slate-100 px-2.5 py-1 text-label font-medium text-slate-600">{t.processes}</p>
      {t.id === 'pro' && <p className="mt-1.5 text-copy text-slate-700">{proDecoyLine()}</p>}
      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((feat) => (
          <li key={feat} className="flex items-start gap-2.5 text-copy-md text-slate-700">
            <Check className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden /> {feat}
          </li>
        ))}
      </ul>
      {t.available === false ? (
        <div className="mt-7 flex h-12 w-full items-center justify-center rounded-lg bg-slate-100 text-base font-semibold text-slate-500">
          Próximamente
        </div>
      ) : (
        <Link to="/login" className={`${BTN_PRIMARY_LG} group mt-7 w-full`}>
          {t.cta} <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
    </div>
  )
}

const TIER_IDS = TIERS.map((t) => t.id)

function focusTierTab(tierId: string) {
  requestAnimationFrame(() => document.getElementById(`tier-tab-${tierId}`)?.focus())
}

function onTierTabKeyDown(
  e: React.KeyboardEvent,
  selectedTier: string,
  setSelectedTier: (id: string) => void,
) {
  const idx = TIER_IDS.indexOf(selectedTier)
  if (idx < 0) return
  let next = idx
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    next = (idx + 1) % TIER_IDS.length
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    next = (idx - 1 + TIER_IDS.length) % TIER_IDS.length
  } else if (e.key === 'Home') {
    e.preventDefault()
    next = 0
  } else if (e.key === 'End') {
    e.preventDefault()
    next = TIER_IDS.length - 1
  } else {
    return
  }
  const tierId = TIER_IDS[next]
  setSelectedTier(tierId)
  focusTierTab(tierId)
}

function CostAnchor() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl section-x section-y">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-slate-500">Antes de comparar planes</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Contratar desordenado también tiene un coste
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
            Apúntate Fácil no sustituye dónde publicas. Evita que las respuestas se queden repartidas entre chats, llamadas y hojas de cálculo.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {COST_TRUTHS.map((truth, index) => (
            <div
              key={truth.key}
              className={index === 0
                ? 'rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-7'
                : 'rounded-2xl bg-slate-900 p-6 text-white sm:p-7'}
            >
              <h3 className={index === 0 ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-white'}>
                {truth.label}
              </h3>
              <ul className="mt-6 space-y-4">
                {truth.items.map((item) => (
                  <li key={item.lead} className="flex gap-3">
                    <Check className={index === 0 ? 'mt-0.5 size-4 shrink-0 text-slate-500' : 'mt-0.5 size-4 shrink-0 text-slate-300'} aria-hidden />
                    <p className={index === 0 ? 'text-copy-md leading-relaxed text-slate-600' : 'text-copy-md leading-relaxed text-slate-300'}>
                      <strong className={index === 0 ? 'font-semibold text-slate-900' : 'font-semibold text-white'}>{item.lead}</strong>{' '}
                      {item.text}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-slate-500">
          {COST_TRUTHS_FOOTNOTE}
        </p>
      </div>
    </section>
  )
}

function Pricing() {
  const [annual, setAnnual] = useState(false)
  const [selectedTier, setSelectedTier] = useState(DEFAULT_PRICING_TIER)
  const activeTier = TIERS.find((t) => t.id === selectedTier) ?? TIERS[1]

  return (
    <section id="precio" className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl section-x section-y">
      <div className="text-center">
        <h2 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Un precio claro, sin “desde” ni letra pequeña
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
          Empieza gratis y sube de plan cuando lo necesites. Candidatos sin límite en los planes de pago; Equipo desde Pro.
        </p>
      </div>

      {/* Toggle mensual / anual */}
      <div className="mt-10 flex justify-center">
        <div
          role="group"
          aria-label="Periodicidad de facturación"
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault()
              setAnnual(true)
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault()
              setAnnual(false)
            }
          }}
        >
          <button type="button" onClick={() => setAnnual(false)} aria-pressed={!annual} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${!annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            Mensual
          </button>
          <button type="button" onClick={() => setAnnual(true)} aria-pressed={annual} className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            Anual
            <span className={`rounded-full px-1.5 py-0.5 text-micro font-semibold ${annual ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>2 meses gratis</span>
          </button>
        </div>
      </div>

      {/* Móvil: selector de plan + una tarjeta */}
      <div className="mt-8 lg:hidden">
        <div
          role="tablist"
          aria-label="Planes de suscripción"
          className="mx-auto flex w-full max-w-md gap-1 rounded-full border border-slate-200 bg-white p-1"
          onKeyDown={(e) => onTierTabKeyDown(e, selectedTier, setSelectedTier)}
        >
          {TIERS.map((t) => {
            const selected = selectedTier === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tier-tab-${t.id}`}
                tabIndex={selected ? 0 : -1}
                aria-selected={selected}
                aria-controls="tier-panel"
                onClick={() => setSelectedTier(t.id)}
                className={`flex min-h-11 flex-1 flex-col items-center justify-center rounded-full px-2 py-2 transition-colors duration-150 ease-[var(--ease-out)] ${
                  selected ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="text-sm font-semibold leading-tight">{t.name}</span>
                <span className={`mt-0.5 text-micro font-medium leading-tight ${selected ? 'text-white/75' : 'text-slate-400'}`}>
                  {t.recommended ? 'Recomendado' : TIER_TAB_HINT[t.id]}
                </span>
              </button>
            )
          })}
        </div>
        <div
          key={activeTier.id}
          role="tabpanel"
          id="tier-panel"
          aria-labelledby={`tier-tab-${activeTier.id}`}
          className="mt-6 motion-reduce:animate-none"
          style={{ animation: 'reveal-up .18s var(--ease-out) both' }}
        >
          <PricingTierCard tier={activeTier} annual={annual} />
        </div>
      </div>

      {/* Escritorio: tres columnas */}
      <div className="mt-8 hidden items-stretch gap-6 lg:grid lg:grid-cols-3">
        {TIERS.map((t) => (
          <PricingTierCard key={t.id} tier={t} annual={annual} gridEmphasis={!!t.recommended} />
        ))}
      </div>

      {/* El aviso del IVA va aparte y en letra pequeña: es información necesaria,
          no un mensaje, y no debe compartir línea con "Sin permanencia" (el
          positivo arrastra al negativo). */}
      <div className="mx-auto mt-10 max-w-2xl text-center">
        <p className="text-copy leading-relaxed text-slate-500">
          En los planes de pago: candidatos <strong className="font-semibold text-slate-700">sin límite</strong>. Equipo desde Pro. Lo que ves es lo que pagas.
        </p>
        <p className="mt-2 text-sm text-slate-500">Precios sin IVA.</p>
      </div>
      </div>
    </section>
  )
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const buttonId = useId()
  const panelId = useId()
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-4 text-left text-title font-semibold text-slate-900 sm:px-5"
      >
        {q}
        <span
          aria-hidden
          className={`grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-transform duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${open ? 'rotate-45' : ''}`}
        >
          +
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={!open || undefined}
        className={`grid transition-[grid-template-rows] duration-[180ms] ease-[var(--ease-out)] motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-4 text-copy-md text-slate-600 sm:px-5">{a}</p>
        </div>
      </div>
    </div>
  )
}

function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const qs: [string, string][] = [
    ['¿Qué hace exactamente Apúntate Fácil?', 'Apúntate Fácil convierte las respuestas de tu anuncio en candidatos ordenados. En lugar de seguir hablando por chat, envías un enlace. Cada persona completa un formulario y toda la información aparece organizada para que puedas filtrar, valorar y elegir.'],
    ['¿Tengo que cambiar cómo publico mis anuncios?', 'No. Sigue publicando donde lo haces normalmente: Milanuncios, Instagram, WhatsApp, un QR, tu web o cualquier otro canal. Cuando alguien quiera apuntarse, solo tienes que enviarle tu enlace.'],
    ['¿La gente realmente completa el formulario?', 'En la práctica suele completarse más gente, no menos. Son pocas preguntas, adaptadas al móvil, y tardan menos que escribir por el chat.'],
    ['¿Es difícil empezar?', 'No. En menos de cinco minutos tendrás tu primer formulario listo para recibir candidatos. Después solo tienes que compartir el enlace y empezar a recibir las candidaturas ordenadas.'],
    ['¿Hay permanencia?', 'No. Pagas mes a mes y puedes darte de baja cuando quieras, desde tu cuenta. Sin llamadas de retención ni trámites adicionales.'],
    ['¿Los candidatos son míos si cancelo?', 'Sí. Toda la lista es tuya: puedes exportarla a Excel en cualquier momento y llevártela contigo si dejas el servicio.'],
    ['¿Hay costes ocultos o precios “desde”?', 'No. Son 149, 249 o 499 € al mes según el plan, con candidatos sin límite. El Equipo (tablón e invitaciones) entra en Pro. Lo que ves aquí es lo que pagas. IVA aparte.'],
    ['¿Puedo probarlo sin registrarme ni tarjeta?', 'Sí. La demo funciona con datos de ejemplo, sin cuenta ni tarjeta. Si creas una cuenta, el plan de Prueba es gratuito: 1 puesto y hasta 15 candidatos, también sin tarjeta.'],
  ]
  return (
    <section id="faq" className="bg-white">
      <div className="mx-auto max-w-3xl section-x section-y">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-900 max-lg:text-center sm:text-4xl">Respuestas claras antes de empezar</h2>
        <div className="mt-10 overflow-hidden border-y border-slate-200 bg-white">
          {qs.map(([q, a], i) => (
            <FaqItem
              key={q}
              q={q}
              a={a}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl section-x section-y">
      <div className="overflow-hidden rounded-3xl bg-slate-900 px-8 py-14 text-center sm:px-16">
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Prueba el panel con candidatos de ejemplo
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-relaxed text-slate-300">
          Filtra, revisa estados y exporta a Excel como en un puesto real. La demo no pide registro ni tarjeta.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/demo" className={`${BTN_INVERTED_LG} group`}>
            Ver la demo <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-lg px-5 text-base font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:bg-white/15">
            Empezar
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const [supportOpen, setSupportOpen] = useState(false)
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:grid sm:grid-cols-3 sm:items-center sm:px-6">
        <div className="sm:justify-self-start">
          <BrandLockup compact />
        </div>
        <p className="order-last text-center text-label text-slate-500 sm:order-none sm:justify-self-center">{TAGLINE}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-label text-slate-500 sm:justify-self-end">
          <button onClick={() => setSupportOpen(true)} className="hover:text-slate-800">Contacto</button>
          <Link to="/privacidad" className="hover:text-slate-800">Privacidad</Link>
          <Link to="/terminos" className="hover:text-slate-800">Términos</Link>
          <Link to="/login" className="hover:text-slate-800">Entrar</Link>
        </div>
      </div>
      <p className="pb-8 text-center text-caption text-slate-500">© 2026 {BRAND}. Hecho en España.</p>
      <SupportDialog open={supportOpen} onClose={() => setSupportOpen(false)} source="landing" page="landing" />
    </footer>
  )
}
