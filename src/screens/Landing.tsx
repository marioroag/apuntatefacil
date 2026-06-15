import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Check, FileSpreadsheet, Filter, Infinity as InfinityIcon,
  Link2, ListChecks, Megaphone, Menu, PhoneCall, Sliders, X,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { BrowserMock } from '../components/BrowserMock'
import { BRAND, TAGLINE } from '../lib/brand'
import { TIERS, COST_TRUTHS } from '../lib/pricing'

const SECTORS = ['Hostelería', 'Construcción', 'Logística', 'Limpieza', 'Comercio', 'Reformas', 'Cuidados']

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
  return (
    <div className="min-h-svh bg-white text-slate-900">
      <SkipLink />
      <TopNav />
      <main id="contenido">
        <Hero />
        <Sectors />
        <Problem />
        <HowItWorks />
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
            Empezar <ArrowRight className="size-4" aria-hidden />
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
            Empezar <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-14 sm:px-6 lg:grid-cols-[1.04fr_1fr] lg:pb-20 lg:pt-24">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[13px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
          Para quien contrata por Milanuncios
        </span>
        <h1 className="mt-4 text-[34px] font-bold leading-[1.07] tracking-tight text-slate-900 sm:text-[52px]">
          Contrata por Milanuncios sin perderte en mil chats
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
          Cada vacante del sector recibe 56 respuestas de media. Que te lleguen todas ordenadas en un sitio, no sueltas por el chat. Pones tu anuncio como siempre, a quien te conteste le mandas un enlace y eliges sin perder a nadie.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link to="/demo" className="inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-base font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-[0.98]">
            Probar la demo sin registrarme <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link to="/login" className="inline-flex h-12 items-center rounded-xl px-5 text-base font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            Empezar
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">Sin permanencia. Sin tarjeta para probar.</p>
      </div>
      <div className="relative">
        <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-indigo-50 to-transparent" aria-hidden />
        <BrowserMock dropIn />
      </div>
    </section>
  )
}

function Sectors() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-center text-[13px] font-semibold uppercase tracking-wider text-slate-500">
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

function Problem() {
  const bullets = [
    'Respondes los mismos cuarenta mensajes uno por uno, a deshoras.',
    'Copias teléfonos a Excel a mano y no sabes a quién ya has llamado.',
    'El bueno se va a otra oferta mientras tú sigues contestando el chat.',
    'La mitad ni tiene carnet ni vive cerca, y lo descubres leyéndolos todos.',
  ]
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-24">
      <Reveal>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-[40px] sm:leading-[1.1]">
          Así es contratar hoy por el chat: la mañana se te va y los buenos se escapan
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-slate-600">
          No es que te falte gente que te escriba, es que te sobra y no hay forma de no perderte. Contestas lo mismo treinta veces, copias teléfonos a una libreta y, para cuando llamas al bueno, ya está pillado en otro sitio. Cribar a 56 personas lleva su tiempo. La diferencia es si lo haces tú a mano o lo hace el sistema por ti.
        </p>
      </Reveal>
      <ul className="mt-7 space-y-3">
        {bullets.map((b, i) => (
          <Reveal key={b} delay={0.05 + i * 0.05}>
            <li className="flex items-start gap-3 text-[15px] text-slate-700">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                <X className="size-3.5" aria-hidden />
              </span>
              {b}
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { icon: Megaphone, title: 'Pon tu anuncio como siempre', body: 'Sigues publicando en Milanuncios igual que hasta hoy. No cambias nada de tu forma de buscar gente, y a la gente la sigues trayendo tú con tu anuncio.' },
    { icon: Link2, title: 'A quien te conteste, mándale un enlace', body: 'En vez de liarte en el chat, le pasas un enlace. La persona rellena un formulario corto con las preguntas que tú decidas: carnet, zona, experiencia, cuándo puede empezar. Tarda menos que en escribirte.' },
    { icon: ListChecks, title: 'Recíbelo todo ordenado, listo para elegir', body: 'Cada respuesta entra en tu lista, en una sola pantalla. El orden lo pone el sistema, no tú. Filtras por lo que te importa, ves de un vistazo quién vale y lo descargas a Excel cuando quieras.' },
  ]
  return (
    <section id="como-funciona" className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tres pasos, y lo montas en cinco minutos
          </h2>
        </Reveal>
        <div className="relative mt-12">
          <div className="absolute left-[16.66%] right-[16.66%] top-5 hidden h-px bg-slate-200 lg:block" aria-hidden />
          <div className="relative grid gap-10 lg:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="text-center lg:text-left">
                  <div className="mx-auto grid size-10 place-items-center rounded-full bg-indigo-600 text-white ring-8 ring-slate-50 lg:mx-0">
                    <s.icon className="size-5" aria-hidden />
                    <span className="sr-only">Paso {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-slate-600 lg:mx-0 lg:max-w-none">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Features() {
  const items = [
    { icon: ListChecks, title: 'Todas las respuestas en una sola pantalla', body: 'Quien te escribe entra en tu lista, ordenado y junto. Se acabó el chat petado y los teléfonos sueltos en la libreta.' },
    { icon: Filter, title: 'Filtra por carnet, zona y experiencia', body: 'Te quedas con los que te sirven en segundos, en vez de leerte 56 conversaciones. Descartas a los de lejos o a los que no tienen lo que pides, con un clic.' },
    { icon: PhoneCall, title: 'Sabes a quién ya has llamado', body: 'Marcas a cada persona según vas avanzando. Nunca llamas dos veces al mismo ni te olvidas de uno que valía.' },
    { icon: Sliders, title: 'El formulario lo haces tú a tu medida', body: 'Tú eliges las preguntas que importan para la plaza. La persona contesta rápido desde el móvil, así que más gente lo termina y te llega mejor.' },
    { icon: FileSpreadsheet, title: 'Descárgalo todo a Excel cuando quieras', body: 'Tus datos son tuyos. Te bajas la lista entera a Excel en cualquier momento, también si te das de baja, sin pedir permiso a nadie.' },
    { icon: InfinityIcon, title: 'Candidatos y usuarios sin límite', body: 'Reciban 20 respuestas o 200, las tienes todas. Y lo usa tu encargada o quien tú quieras, sin pagar por cada persona.' },
  ]
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Todo lo que necesitas para elegir bien, sin perder a nadie
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={(i % 3) * 0.06}>
              <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <it.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-slate-900">{it.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{it.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  const [annual, setAnnual] = useState(false)
  return (
    <section id="precio" className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <Reveal>
        <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Antes de ver el precio, mira lo que cuesta contratar como hoy
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          Una oferta destacada en InfoJobs son 295 a 369 € y dura unos días. Una empresa de selección se lleva del 15 al 20% del sueldo. Y una mala contratación puede costarte hasta tres sueldos. Apúntate Fácil es todo el mes, con candidatos y usuarios sin límite.
        </p>
      </Reveal>

      {/* Ancla del coste real: dos verdades (a mano vs pagando) */}
      <Reveal delay={0.05}>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">Lo que cuesta contratar hoy</p>
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
          <p className="mt-6 text-[13px] text-slate-500">Cifras de referencia del sector en España, junio de 2026.</p>
        </div>
      </Reveal>

      {/* Toggle mensual / anual */}
      <Reveal delay={0.08}>
        <div className="mt-10 flex justify-center">
          <div role="group" aria-label="Periodicidad de facturación" className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
            <button type="button" onClick={() => setAnnual(false)} aria-pressed={!annual} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${!annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              Mensual
            </button>
            <button type="button" onClick={() => setAnnual(true)} aria-pressed={annual} className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              Anual
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${annual ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>2 meses gratis</span>
            </button>
          </div>
        </div>
      </Reveal>

      {/* Planes */}
      <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-3">
        {TIERS.map((t, i) => (
          <Reveal key={t.id} delay={i * 0.06}>
            <div className={`relative flex h-full flex-col rounded-2xl p-7 ${
              t.available === false
                ? 'border border-slate-200 bg-slate-50'
                : t.recommended
                  ? 'border-2 border-indigo-600 bg-white shadow-card'
                  : 'border border-slate-200 bg-white shadow-card'
            }`}>
              {t.available === false ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-500">
                  Próximamente
                </span>
              ) : t.recommended ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[12px] font-semibold text-white">
                  Recomendado
                </span>
              ) : null}
              <h3 className="text-lg font-semibold text-slate-900">{t.name}</h3>
              <p className="mt-1 text-[14px] text-slate-500">{t.tagline}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums">{annual ? t.annual : t.monthly} €</span>
                <span className="text-slate-500">{annual ? 'al año' : 'al mes'}</span>
              </div>
              <p className="mt-1 text-[13px] text-slate-500">{annual ? 'Dos meses gratis, IVA aparte' : 'Sin permanencia, IVA aparte'}</p>
              <p className="mt-4 inline-flex w-fit rounded-lg bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-600">{t.processes}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {t.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-[15px] text-slate-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden /> {feat}
                  </li>
                ))}
              </ul>
              {t.available === false ? (
                <div className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-slate-100 text-base font-semibold text-slate-400">
                  Próximamente
                </div>
              ) : (
                <Link to="/login" className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-base font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-[0.99]">
                  {t.cta} <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </div>
          </Reveal>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-[14px] leading-relaxed text-slate-500">
        Todos los planes: candidatos y usuarios <strong className="font-semibold text-slate-700">sin límite</strong>, exportar a Excel y sin permanencia. Lo que ves es lo que pagas.
      </p>
      </div>
    </section>
  )
}

function Faq() {
  const qs: [string, string][] = [
    ['¿Tengo que cambiar cómo pongo mi anuncio?', 'No. Sigues publicando en Milanuncios igual que ahora. Lo único que cambia es que, a quien te conteste, en vez de liarte en el chat le mandas un enlace.'],
    ['¿Esto me trae gente nueva?', 'No, y queremos que lo sepas. La gente la sigue trayendo tu anuncio de Milanuncios. Lo que hace Apúntate Fácil es ordenar a los que te contestan para que no se te escape ninguno.'],
    ['¿No se irá la gente al ver el formulario?', 'Es un formulario corto, de un par de preguntas, pensado para el móvil. Se tarda menos en rellenarlo que en escribirte por el chat, así que normalmente termina más gente, no menos.'],
    ['¿Necesito saber de ordenadores?', 'No. Si sabes poner un anuncio en Milanuncios, sabes usar esto. Se deja listo en cinco minutos y lo puede usar cualquiera de tu equipo sin que tengas que explicárselo.'],
    ['¿Hay permanencia?', 'No hay permanencia. Pagas el mes y, si no te sirve, te das de baja cuando quieras con un clic. Sin llamadas, sin papeleo, sin retenerte.'],
    ['¿Mis datos son míos de verdad?', 'Sí. Toda la lista de personas que te escriben es tuya y te la descargas a Excel en cualquier momento. Si te vas, te lo llevas todo contigo.'],
    ['¿Hay costes ocultos o precios "desde"?', 'Ninguno. Son 150, 250 o 450 € al mes según el plan, con candidatos y usuarios sin límite, filtros y exportar a Excel. Lo que ves es lo que pagas. El IVA va aparte, como en cualquier factura.'],
    ['¿Tengo que registrarme o poner tarjeta para probar?', 'No. Puedes entrar en la demo sin registrarte, con datos de ejemplo ya dentro, para que toques el producto antes de dar ningún dato ni la tarjeta.'],
    ['¿Cómo me doy de alta?', 'Pones tu email y eliges una contraseña, o entras con un clic con tu cuenta de Google. Si te registras con email, te enviamos un correo para confirmar tu cuenta antes de entrar.'],
  ]
  return (
    <section id="faq" className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-24">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Las dudas que tendrías tú, respondidas sin rodeos</h2>
        </Reveal>
        <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {qs.map(([q, a], i) => (
            <details key={i} className="group px-4 py-4 sm:px-5">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-[17px] font-semibold text-slate-900 marker:content-none">
                {q}
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <Reveal>
        <div className="overflow-hidden rounded-3xl bg-slate-900 px-8 py-14 text-center sm:px-16">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Pruébalo con tus propios anuncios y míralo funcionar
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-300">
            No te pedimos que te fíes de una promesa. Entra, toca el panel con datos de ejemplo y compruébalo tú. Sin registro y sin tarjeta.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/demo" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-slate-900 transition-transform hover:scale-[1.02] active:scale-[0.99]">
              Probar la demo sin registrarme <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">
              Empezar
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
        </div>
        <p className="order-last text-center text-[13px] text-slate-500 sm:order-none">{TAGLINE}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-slate-500">
          <Link to="/privacidad" className="hover:text-slate-800">Privacidad</Link>
          <Link to="/terminos" className="hover:text-slate-800">Términos</Link>
          <Link to="/login" className="hover:text-slate-800">Entrar</Link>
        </div>
      </div>
      <p className="pb-8 text-center text-[12px] text-slate-500">© 2026 {BRAND} · Hecho en España.</p>
    </footer>
  )
}
