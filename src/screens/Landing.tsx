import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Database,
  FileSpreadsheet,
  Link2,
  ListFilter,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { BrowserMock } from '../components/BrowserMock'
import { BRAND, TAGLINE } from '../lib/brand'
import { TIERS, COST_TRUTHS } from '../lib/pricing'

const SECTORS = ['Hostelería', 'Construcción', 'Logística', 'Limpieza', 'Comercio', 'Reformas', 'Cuidados']

// Entrada sobria con animación CSS en montaje (fill 'both' deja el estado final
// y reduced-motion la vuelve instantánea vía el CSS global). No depende de
// scroll/IntersectionObserver, así nada se queda invisible.
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={className} style={{ animation: `reveal-up .5s var(--ease-out) ${delay}s both` }}>
      {children}
    </div>
  )
}

export function Landing() {
  return (
    <div className="min-h-svh bg-white text-slate-900">
      <SkipLink />
      <TopNav />
      <main id="contenido">
        <Hero />
        <Sectors />
        <HowItWorks />
        <Screenshot />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

function SkipLink() {
  return (
    <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
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
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6" aria-label="Principal">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="size-8" />
          <span className="text-[17px] font-bold tracking-tight">{BRAND}</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {label}
            </a>
          ))}
          <Link to="/demo" className="ml-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Ver la demo
          </Link>
          <Link to="/login" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
            Empezar gratis <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Menú" aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-slate-200 px-4 py-3 md:hidden">
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
              {label}
            </a>
          ))}
          <Link to="/demo" onClick={() => setOpen(false)} className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Ver la demo
          </Link>
          <Link to="/login" onClick={() => setOpen(false)} className="mt-1 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white">
            Empezar gratis <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[13px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
          Para quien contrata por Milanuncios y similares
        </span>
        <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
          Las respuestas a tu anuncio, en una base de datos. No en mil chats.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
          {BRAND} convierte cada respuesta a tu oferta en un candidato ordenado. Compartes un enlace,
          la gente rellena tu formulario y tú filtras y exportas a Excel cuando quieras.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-base font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-[0.98]">
            Empezar gratis <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link to="/demo" className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            Ver la demo
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">Pruébala sin registrarte. Candidatos y usuarios ilimitados en todos los planes.</p>
      </div>
      <div className="relative">
        <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-indigo-50 to-transparent" aria-hidden />
        <BrowserMock />
      </div>
    </section>
  )
}

function Sectors() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-center text-[13px] font-semibold uppercase tracking-wider text-slate-400">
          Sirve para contratar en cualquier sector
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

function HowItWorks() {
  const steps = [
    { icon: Link2, title: 'Comparte tu enlace', body: 'Pones tu anuncio en Milanuncios como siempre. A quien responde le mandas tu enlace de Criba en vez de liarte a chatear.' },
    { icon: Database, title: 'Las respuestas se ordenan solas', body: 'Cada persona rellena el formulario que tú has diseñado. Entra directa en tu base de datos, con teléfono, experiencia y lo que le hayas preguntado.' },
    { icon: FileSpreadsheet, title: 'Filtra y exporta', body: 'Filtras por lo que buscas (carnet, zona, disponibilidad) y exportas a Excel en un clic. Sin copiar y pegar de mil conversaciones.' },
  ]
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          De responder mensajes sueltos a tener tus candidatos ordenados
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.08}>
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-bold text-slate-300 tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Screenshot() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Todos los candidatos de todos tus puestos, en un sitio
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Cada puesto tiene su propia lista. Marca el estado de cada persona, ponle nota, llámala o
              escríbele por WhatsApp sin salir de la ficha. Lo que ya hacías, pero ordenado.
            </p>
            <ul className="mt-6 space-y-2.5">
              {['Estados claros: nuevo, contactado, entrevista, contratado', 'Búsqueda y filtros por cualquier campo de tu formulario', 'Exporta a Excel los que quieras, cuando quieras'].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[15px] text-slate-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <Link to="/demo" className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700">
              Abrir la demo <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <BrowserMock />
        </Reveal>
      </div>
    </section>
  )
}

function Features() {
  const items = [
    { icon: Link2, title: 'Un formulario que customizas tú', body: 'Pregunta lo que de verdad importa para tu puesto: carnet, experiencia, disponibilidad, zona. Arrastra los campos y listo.' },
    { icon: ListFilter, title: 'Filtra por lo que buscas', body: 'Cruza filtros y búsqueda para quedarte solo con quien encaja. La working list que necesitas en cada llamada.' },
    { icon: FileSpreadsheet, title: 'Export a Excel de verdad', body: 'Un .xlsx con tus columnas, listo para compartir con tu equipo o tu gestoría. Sin candados ni recortes.' },
    { icon: ShieldCheck, title: 'Tus datos son tuyos', body: 'Te los puedes llevar cuando quieras. Sin secuestrar tu base de candidatos ni cobrarte por exportar.' },
  ]
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Lo justo para contratar rápido, sin aprender a usar un programa
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.06}>
            <div className="flex h-full gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <it.icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{it.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{it.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Pricing() {
  const [annual, setAnnual] = useState(false)
  return (
    <section id="precio" className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Contratar bien cuesta menos que perder al candidato bueno
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
            No somos los más baratos. Somos los que hacen que contratar deje de doler. Mira lo que pagas hoy y luego nuestro precio.
          </p>
        </Reveal>

        {/* Ancla del coste real ANTES del precio: dos verdades (a mano vs pagando) */}
        <Reveal delay={0.05}>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Lo que cuesta contratar hoy</p>
            <div className="mt-5 grid gap-7 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-slate-200">
              {COST_TRUTHS.map((col, i) => (
                <div key={col.key} className={i === 0 ? 'sm:pr-8' : 'sm:pl-8'}>
                  <p className="text-sm font-semibold text-slate-700">{col.label}</p>
                  <ul className="mt-3 space-y-2.5">
                    {col.items.map((it) => (
                      <li key={it.lead} className="text-[15px] leading-snug text-slate-600">
                        <span className="font-bold tabular-nums text-slate-900">{it.lead}</span> {it.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[13px] text-slate-400">Cifras de referencia del sector en España, junio de 2026.</p>
          </div>
        </Reveal>

        {/* Control segmentado mensual / anual */}
        <Reveal delay={0.08}>
          <div className="mt-10 flex justify-center">
            <div role="group" aria-label="Periodicidad de facturación" className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                aria-pressed={!annual}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  !annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                aria-pressed={annual}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Anual
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    annual ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                  }`}
                >
                  2 meses gratis
                </span>
              </button>
            </div>
          </div>
        </Reveal>

        {/* Planes */}
        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-3">
          {TIERS.map((t, i) => (
            <Reveal key={t.id} delay={i * 0.06}>
              <div
                className={`relative flex h-full flex-col rounded-2xl bg-white p-7 ${
                  t.recommended ? 'border-2 border-indigo-600 shadow-card' : 'border border-slate-200'
                }`}
              >
                {t.recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[12px] font-semibold text-white">
                    Recomendado
                  </span>
                )}
                <h3 className="text-lg font-semibold text-slate-900">{t.name}</h3>
                <p className="mt-1 text-[14px] text-slate-500">{t.tagline}</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums">{annual ? t.annual : t.monthly} €</span>
                  <span className="text-slate-500">{annual ? 'al año' : 'al mes'}</span>
                </div>
                <p className="mt-1 text-[13px] text-slate-400">{annual ? 'Dos meses gratis, IVA aparte' : 'IVA aparte'}</p>
                <p className="mt-4 inline-flex w-fit rounded-lg bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-600">{t.processes}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {t.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-[15px] text-slate-700">
                      <Check className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden /> {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={`mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition-colors active:scale-[0.99] ${
                    t.recommended ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.cta} <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[14px] leading-relaxed text-slate-500">
          Candidatos y usuarios <strong className="font-semibold text-slate-700">ilimitados</strong> en todos los planes. Precios públicos, sin permanencia y sin "solicitar cotización". Tus datos siempre son tuyos.
        </p>
      </div>
    </section>
  )
}

function Faq() {
  const qs = [
    ['¿Tengo que cambiar cómo publico en Milanuncios?', 'No. Sigues poniendo tu anuncio igual que siempre. Lo único que cambia es que, en vez de gestionar las respuestas por chat, mandas tu enlace de Criba.'],
    ['¿La gente tiene que crearse una cuenta para apuntarse?', 'No. Quien responde solo abre tu enlace, rellena el formulario y envía. Ni cuentas ni contraseñas. En el móvil tarda menos de un minuto.'],
    ['¿Puedo preguntar lo que yo quiera en el formulario?', 'Sí. Añades los campos que necesites: teléfono, experiencia, carnet, disponibilidad, zona, lo que sea. Y marcas cuáles son obligatorios.'],
    ['¿Cómo exporto a Excel?', 'Con un botón. Puedes exportar todos los candidatos de un puesto o solo los que tengas filtrados. Se descarga un archivo .xlsx normal.'],
    ['¿Y si quiero irme? ¿Me quedo sin mis datos?', 'No. Tus candidatos son tuyos. Exportas todo a Excel cuando quieras, también al darte de baja. Sin candados.'],
  ]
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <Reveal>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Preguntas frecuentes</h2>
      </Reveal>
      <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
        {qs.map(([q, a], i) => (
          <details key={i} className="group py-4">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-[17px] font-semibold text-slate-900 marker:content-none">
              {q}
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <Reveal>
        <div className="overflow-hidden rounded-3xl bg-slate-900 px-8 py-14 text-center sm:px-16">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Deja de perder buenos candidatos entre mensajes
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            Crea tu cuenta en un minuto, o prueba la demo con datos de ejemplo. Sin tarjeta.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-slate-900 transition-transform hover:scale-[1.02] active:scale-[0.99]">
              Empezar gratis <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to="/demo" className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">
              Ver la demo
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <Logo className="size-6" />
          <span className="text-sm font-bold tracking-tight">{BRAND}</span>
          <span className="ml-2 text-[13px] text-slate-400">{TAGLINE}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-slate-500">
          <a href="#" className="hover:text-slate-800">Privacidad</a>
          <a href="#" className="hover:text-slate-800">Términos</a>
          <a href="#" className="hover:text-slate-800">Accesibilidad</a>
          <a href="#" className="hover:text-slate-800">Contacto</a>
        </div>
      </div>
      <p className="pb-8 text-center text-[12px] text-slate-400">© 2026 {BRAND} · Hecho en España. Precios sin IVA.</p>
    </footer>
  )
}
