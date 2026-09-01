import { useEffect, useId, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useHayDosColumnas, useMenosMovimiento } from '../lib/media'
import {
  ArrowRight, Check, ChevronRight, Database, FileSpreadsheet, Filter,
  Infinity as InfinityIcon, Link2, ListChecks, Megaphone, Menu, MessagesSquare,
  Phone, PhoneCall, RotateCcw, Sliders, Trash2, Users, X,
  type LucideIcon,
} from 'lucide-react'
import { initials, memberAvatarTone } from '../lib/format'
import { STATUS_META, type CandidateStatus } from '../lib/types'
import { BrowserMock } from '../components/BrowserMock'
import { AppShot, MovilShot, TablonShot } from '../components/AppShot'
import { Logo } from '../components/Logo'
import { BRAND, TAGLINE } from '../lib/brand'
import { SupportDialog } from '../components/SupportDialog'
import { PRECIO_PROCESO, PRUEBA_DIAS, TRIAL_REASSURANCE } from '../lib/pricing'
import { PrecioProceso } from '../components/PrecioProceso'
import { BTN_INVERTED_LG, BTN_PRIMARY, BTN_PRIMARY_LG, BTN_SECONDARY_LG } from '../lib/buttons'


const COST_COMPARISON_ROWS = [
  {
    cost: {
      title: 'Tiempo que no vuelve',
      body: 'Repites preguntas, persigues respuestas y vuelves a abrir conversaciones para completar los datos.',
    },
    benefit: {
      title: 'Información desde el inicio',
      body: 'Cada candidatura reúne las respuestas que has pedido para ese puesto.',
    },
  },
  {
    cost: {
      title: 'Seguimiento a medias',
      body: 'Las llamadas, las notas y los mensajes no siempre cuentan la misma historia.',
    },
    benefit: {
      title: 'Todo el proceso, visible',
      body: 'La lista, los filtros y los estados dejan claro a quién revisar y qué toca hacer.',
    },
  },
  {
    cost: {
      title: 'Candidatos que se enfrían',
      body: 'El perfil que encajaba puede aceptar otro puesto antes de que llegues a valorarlo.',
    },
    benefit: {
      title: 'Decisiones con tiempo',
      body: 'Encuentras antes a quien encaja y contactas con los datos delante.',
    },
  },
] as const

const COMPACT_COST_COMPARISON_ROWS = [
  {
    cost: 'Repites preguntas',
    benefit: 'Recibes los datos que pediste',
  },
  {
    cost: 'No sabes qué sigue',
    benefit: 'Ves la lista y los estados claros',
  },
  {
    cost: 'El candidato se enfría',
    benefit: 'Decides y contactas antes',
  },
] as const

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
      {/* LAS MEDIDAS DE ESTA BARRA SON LAS DE ATTIO (Mario, ago 2026), leídas de su
          DOM y no de una captura: 1440 de tope con 24 de relleno lateral, 16 de
          relleno arriba y abajo alrededor de una fila de 36 (67px de barra; la
          nuestra queda en 68 porque su 16/15 es una asimetría de un píxel que aquí
          no tiene motivo), enlaces a 15px con 6 de hueco, 32 del logo al primer
          enlace y 10 entre los dos botones de la derecha.

          El tope de 1440 es MÁS ANCHO que el contenido de la página (1280), y es a
          propósito: en Attio la barra respira hasta el filo del navegador mientras
          lo de dentro sigue acotado. */}
      <nav className="mx-auto flex max-w-[90rem] items-center justify-between px-4 py-4 sm:px-6" aria-label="Principal">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center" aria-label={BRAND}>
            <BrandLockup />
          </Link>
          <div className="hidden items-center gap-1.5 md:flex">
            {links.map(([label, href]) => (
              // `leading-5` no es decorativo: con un tamaño arbitrario, Tailwind no
              // trae interlineado y la pastilla se iría de 36 a 38, que es lo único
              // que hay que sostener para que la fila cuadre.
              <a key={href} href={href} className="rounded-lg px-3 py-2 text-[15px] leading-5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div className="hidden items-center gap-2.5 md:flex">
          <Link to="/demo" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Ver la demo
          </Link>
          <Link to="/login" className={`${BTN_PRIMARY} group`}>
            Empezar <ArrowRight className="size-4 transition-transform duration-[var(--duration-control)] ease-out group-hover:translate-x-1" aria-hidden />
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

// El hero de la landing tiene DOS estados y el scroll solo dice en cuál estás: no
// es un scrub. Medido en attio.com, que es la referencia: con 4px sigue en reposo,
// con 8px ya está en el estado final, y a 16/32/64 el valor es idéntico.
//
// Histéresis (enciende a 8, apaga a 3) porque el temblor de un trackpad justo en
// la frontera encendería y apagaría una transición de más de medio segundo. Y el
// valor inicial se lee en el propio `useState` en vez de en un efecto: si alguien
// recarga con la página ya desplazada, el estado tiene que nacer correcto, y un
// `setState` dentro del efecto es además lo que el linter de la casa prohíbe.
const HERO_ENCIENDE = 8
const HERO_APAGA = 3

function useHeroMovido() {
  const [movido, setMovido] = useState(() => window.scrollY > HERO_ENCIENDE)
  useEffect(() => {
    const alScroll = () => setMovido((v) => (v ? window.scrollY > HERO_APAGA : window.scrollY > HERO_ENCIENDE))
    // Pasivo: esto no cancela el scroll, solo lo mira. Y devolver el MISMO valor
    // hace que React no re-renderice, así que en la práctica esto cambia dos veces.
    window.addEventListener('scroll', alScroll, { passive: true })
    return () => window.removeEventListener('scroll', alScroll)
  }, [])
  return movido
}

/**
 * EL MOCK SUBE MÁS QUE LA PÁGINA: PARALLAX (Mario, ago 2026).
 *
 * La sensación que se busca es que el mock se DESLICE hacia arriba por encima del
 * hero, comiéndose el sitio del titular mientras este se funde. Eso no lo da una
 * transición: una transición se dispara una vez y termina, así que después de sus
 * 720ms el mock vuelve a moverse exactamente igual que el resto de la página. Lo
 * que hace falta es que su desplazamiento dependa del RECORRIDO, no del tiempo.
 *
 * OJO, esto NO es volver al scroll clavado que Mario retiró: ahí el scroll se
 * secuestraba y la página no avanzaba mientras la animación corría. Aquí el scroll
 * es el de siempre y lo único que pasa es que una pieza se mueve un poco más
 * deprisa que el papel. Se puede seguir bajando en cualquier momento.
 *
 * Va en un ELEMENTO PROPIO y sin transición, envolviendo al que sí la tiene. Si
 * compartieran propiedad, cada píxel de scroll relanzaría una transición de 720ms
 * y el mock iría persiguiendo al dedo con medio segundo de retraso. Separados, uno
 * hace el gesto de entrada y el otro sigue al scroll al instante.
 *
 * Se escribe una variable en el nodo (no un `setState`), porque un render por
 * fotograma repintaría el hero entero; y con `requestAnimationFrame` para no
 * escribir más de una vez por fotograma aunque el navegador dispare más eventos.
 */
// El tope no es estético: cada píxel que el mock sube por su cuenta es un píxel
// MÁS de hueco entre él y la sección de abajo, y ese hueco se ve entero al seguir
// bajando. Con 140 se iban ~290px de blanco, que se lee como un agujero. Lo que
// deja subirlo es DEVOLVERLE a la sección el relleno que el propio gesto ya crea:
// en escritorio la sección no lleva ninguno y encima se come 40px con un margen
// negativo (40 -> 64), porque el hueco lo pone entero el parallax y sobraba: medido en el
// punto donde el imán deja la página, el aire hasta la sección de abajo pasa de 168
// a 96. Son 64 y no 40 desde que el teléfono cuelga menos: al subir la pieza más
// baja, el hueco de debajo crece solo y hay que volver a descontarlo. De esos 168, 111 los ponía el propio parallax y 25 el encogido de la ventana
// al 0,92, que deja aire por debajo aunque nadie lo haya pedido. El caso de `prefers-reduced-motion`, donde ese relleno sí hace falta
// (allí no hay parallax y el teléfono cuelga por debajo del panel), está declarado
// en `index.css`.
//
// Y EL FACTOR ES LO QUE SE NOTA (Mario, ago 2026: "un poco más notable"). El tope
// dice cuánto se mueve en total; el factor, a qué velocidad se despega del papel,
// que es lo que de verdad se lee como parallax. A 0,35 el techo llegaba a los 274
// de scroll, o sea que el gesto se repartía en tres pantallas de móvil y casi no
// se veía; a 0,5 llega a los 256 con más recorrido, así que el mock adelanta a la
// página justo mientras la estás mirando.
const PARALLAX_FACTOR = 0.5
const PARALLAX_TOPE = 128

// CUÁNTO SE SUAVIZA (Mario: "y el scroll suave"). El parallax iba CLAVADO al
// scroll, así que con la rueda del ratón avanzaba a escalones del tamaño de cada
// muesca: el mock daba saltos en vez de deslizarse. Ahora persigue a su objetivo
// acercándose una fracción en cada fotograma, que es lo que hace que el papel y el
// mock parezcan tener pesos distintos.
//
// NO ES SECUESTRAR EL SCROLL, que es lo que Mario retiró en su día: la página va
// exactamente a donde la mandes y a la velocidad de siempre. Lo único que se retrasa
// es una capa decorativa, y sola.
//
// 0,16 por fotograma a 60Hz: el 90% del recorrido en ~14 fotogramas (unos 230ms),
// que es el orden del resto de la casa. Más bajo y el mock se queda flotando
// detrás; más alto y no se distingue de ir clavado.
const PARALLAX_SUAVIZADO = 0.16

function useHeroParallax(activo: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !activo) return
    const meta = () => Math.min(window.scrollY * PARALLAX_FACTOR, PARALLAX_TOPE)
    let subida = meta()
    let pedido = 0
    let ultimo = 0
    const pintar = (t: number) => {
      pedido = 0
      const destino = meta()
      // El paso se corrige por el TIEMPO que ha durado el fotograma, no por el
      // fotograma a secas: en una pantalla de 120Hz hay el doble de fotogramas, así
      // que con un paso fijo el suavizado duraría la mitad y en un monitor rápido
      // esto se vería casi clavado. Con la corrección, el recorrido dura lo mismo en
      // cualquier pantalla. El tope de 64ms es para que volver a una pestaña
      // aparcada no dé un salto: ahí se avanza un fotograma normal y ya.
      const dt = ultimo ? Math.min(64, t - ultimo) : 16.6667
      ultimo = t
      subida += (destino - subida) * (1 - Math.pow(1 - PARALLAX_SUAVIZADO, dt / 16.6667))
      // Medio píxel es el suelo por debajo del cual ya no se ve nada moverse: se
      // clava el valor y se apaga el bucle en vez de perseguir decimales para siempre.
      if (Math.abs(destino - subida) < 0.5) subida = destino
      el.style.setProperty('--hero-parallax', `${subida.toFixed(2)}px`)
      if (subida !== destino) pedido = requestAnimationFrame(pintar)
    }
    const alScroll = () => {
      if (!pedido) pedido = requestAnimationFrame(pintar)
    }
    el.style.setProperty('--hero-parallax', `${subida}px`)
    window.addEventListener('scroll', alScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', alScroll)
      if (pedido) cancelAnimationFrame(pedido)
      el.style.removeProperty('--hero-parallax')
    }
  }, [activo])
  return ref
}

/**
 * EL IMÁN DEL HERO (Mario, ago 2026: "que el scroll suave se haga más fuerte cuando
 * te acercas a la posición que queremos y más débil cuanto más lejos estás").
 *
 * Hay un sitio donde la composición se ve como se diseñó, centrada en la pantalla,
 * y alrededor de él hay un POZO: un campo que tira hacia el centro y que se nota
 * más cuanto más cerca estás. No es un remate al soltar, es una fuerza que está
 * puesta todo el rato mientras andas por ahí. Por eso la página pesa al pasar por
 * el sitio bueno y se queda ahí sola, y por eso pasar de largo sigue siendo posible:
 * la mano siempre mueve más que el imán.
 *
 * DOS COSAS QUE SE PROBARON ANTES Y NO ERAN ESTO:
 *   · `scroll-snap-type: y proximity`, la herramienta nativa. Es un imán de acero,
 *     no un imán: su radio lo decide el navegador y resultó enorme, así que con el
 *     punto a 224px del principio la página se quedaba ATRAPADA ahí y con la rueda
 *     no había forma de volver arriba. Y no se puede graduar.
 *   · Un tirón AL PARAR. Funcionaba, pero era otra cosa: no se sentía nada mientras
 *     te movías y de pronto la página se recolocaba sola. Lo que se pide es que se
 *     note al acercarse, no al terminar.
 *
 * LA FORMA DE LA FUERZA ES UNA CAMPANA, no un radio con filo. `exp(-(d/alcance)²)`
 * decae rápido y sin escalón, así que no hay ninguna distancia en la que el imán
 * "se encienda": simplemente deja de contar. Medido con estos números, el paso por
 * fotograma es de ~4,7px a 39 de distancia (que es donde más tira), 4 a 55, 0,7 a
 * 100 y prácticamente cero pasados los 112, o sea que EN EL PRINCIPIO DE LA PÁGINA
 * NO TIRA NADA. Eso último no es un detalle: es lo que hundió al `scroll-snap`.
 *
 * EL ALCANCE BAJÓ DE 80 A 55 (Mario, ago 2026). Con 80, el pozo llegaba a 150 y una
 * muesca de rueda son ~100: te devolvía siempre y hacían falta dos para salir, que
 * es la parte de "no te molesta si quieres pasar" que no se cumplía. A 55 el pozo se
 * queda por debajo de lo que anda una muesca, así que tira fuerte donde importa y
 * una sola muesca decidida ya te suelta.
 *
 * Y NO PELEA CON EL NAVEGADOR. Mientras la rueda está moviendo la página de verdad
 * (más de `IMAN_MANO` píxeles por fotograma), el imán no escribe: si escribiera,
 * cortaría la animación suave del propio navegador y el gesto se volvería a saltos.
 * Toma el relevo cuando esa animación se apaga, que es justo cuando se puede notar
 * que algo tira.
 */
// El alcance es la sigma de la campana; la fuerza, la fracción de la distancia que
// se recorre por fotograma en el punto de más tirón. El mínimo es el suelo por
// debajo del cual no se escribe: sin él, a 200px de distancia el imán arrastraría la
// página unos pocos píxeles por segundo para siempre, que es un scroll que se mueve
// solo mientras lees.
const IMAN_ALCANCE = 55
const IMAN_FUERZA = 0.2
const IMAN_MINIMO = 0.35
const IMAN_MANO = 6

function useImanHero(
  ref: { current: HTMLDivElement | null },
  activo: boolean,
  movido: boolean,
) {
  // Hasta cuándo la composición está todavía colocándose. Al cruzar el umbral, la
  // ventana tarda `--duration-hero` en encoger y subir, y durante ese rato su caja
  // no es la que va a ser: medido, el imán calculaba el sitio bueno 27px más abajo
  // del real. Tirar hacia un sitio equivocado y corregir después se lee como que la
  // página no para quieta, así que ahí no se tira.
  const asentado = useRef(0)
  useEffect(() => {
    const ms =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-hero')) ||
      720
    asentado.current = performance.now() + ms
  }, [movido])

  useEffect(() => {
    if (!activo) return
    let pedido = 0
    let anterior = window.scrollY
    let ultimo = 0
    let quietos = 0

    /**
     * Dónde está el sitio bueno, en scroll de página. Se mide en vez de escribirse:
     * depende del alto de la ventana del navegador y de la composición, que cambia
     * con el ancho.
     *
     * El parallax que ya está aplicado se DEVUELVE a la cuenta (de ahí el `+
     * aplicado`), así que lo que se calcula es el centro de la composición como si
     * no hubiera parallax; eso es un número fijo, y por eso el destino no se mueve
     * mientras el imán tira. Con la medida cruda, el punto huiría a la vez que se
     * persigue.
     */
    const destino = () => {
      const capa = ref.current
      const ventana = capa?.querySelector<HTMLElement>('.hero-ventana')
      if (!capa || !ventana) return null
      // La caja de la composición son la ventana Y lo que le cuelga por fuera: los
      // dos mocks son hijos suyos colocados fuera de su caja, así que no entran en
      // su rectángulo.
      let arriba = Infinity
      let abajo = -Infinity
      for (const nodo of [ventana, ...ventana.children]) {
        const r = (nodo as HTMLElement).getBoundingClientRect()
        if (!r.height) continue
        arriba = Math.min(arriba, r.top)
        abajo = Math.max(abajo, r.bottom)
      }
      if (!Number.isFinite(arriba)) return null
      const aplicado = parseFloat(capa.style.getPropertyValue('--hero-parallax')) || 0
      const centro = (arriba + abajo) / 2 + window.scrollY + aplicado
      const mitad = window.innerHeight / 2
      // Se busca la Y que cumple centro - parallax(Y) - Y = mitad. Son dos tramos,
      // porque el parallax deja de crecer en su tope: primero se prueba el llano
      // (donde la Y solo hay que restarla) y, si no cae ahí, el de la rampa.
      const llano = centro - PARALLAX_TOPE - mitad
      const y =
        llano * PARALLAX_FACTOR >= PARALLAX_TOPE
          ? llano
          : (centro - mitad) / (1 + PARALLAX_FACTOR)
      const tope = document.documentElement.scrollHeight - window.innerHeight
      return Math.max(0, Math.min(tope, y))
    }

    const paso = (t: number) => {
      pedido = 0
      const y = window.scrollY
      const suyo = Math.abs(y - anterior)
      anterior = y
      const dt = ultimo ? Math.min(64, t - ultimo) : 16.6667
      ultimo = t

      const colocandose = performance.now() < asentado.current
      const meta = colocandose ? null : destino()
      let tira = false
      if (meta != null && suyo <= IMAN_MANO) {
        const d = meta - y
        // La campana: mucha fuerza al lado del punto, nada a lo lejos. Corregida
        // por la duración del fotograma, como el parallax, para que el tirón dure
        // lo mismo en una pantalla de 60Hz que en una de 120.
        const fuerza = IMAN_FUERZA * Math.exp(-((d / IMAN_ALCANCE) ** 2))
        const avance = d * (1 - Math.pow(1 - fuerza, dt / 16.6667))
        if (Math.abs(avance) >= IMAN_MINIMO) {
          // `instant` a propósito: `html` lleva `scroll-behavior: smooth` para las
          // anclas, y sin esto cada fotograma lanzaría su propia animación suave y
          // se pisarían unas a otras. Lo suave lo pone la campana.
          window.scrollTo({ top: y + avance, behavior: 'instant' })
          anterior = window.scrollY
          tira = true
        }
      }

      // El bucle se apaga solo cuando ni la página se mueve ni el imán tira, y
      // vuelve al primer scroll: un `requestAnimationFrame` eterno en una landing es
      // trabajo que se paga en batería sin que pase nada.
      //
      // PERO NO MIENTRAS LA COMPOSICIÓN SE ESTÁ COLOCANDO, y esto se vio en pantalla:
      // con la rueda, el gesto termina antes que los 720ms de la ventana, así que el
      // bucle se daba por parado (unos 400ms de quietud) justo antes de que el imán
      // tuviera permiso para tirar. Con el ratón no se notaba porque un `scrollTo`
      // programático llega con la ventana ya colocada; con la rueda, el imán no
      // enganchaba NUNCA.
      quietos = tira || suyo > 0.5 || colocandose ? 0 : quietos + 1
      if (quietos < 24) pedido = requestAnimationFrame(paso)
    }

    const alScroll = () => {
      quietos = 0
      if (!pedido) {
        ultimo = 0
        pedido = requestAnimationFrame(paso)
      }
    }

    window.addEventListener('scroll', alScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', alScroll)
      if (pedido) cancelAnimationFrame(pedido)
    }
  }, [ref, activo])
}

function Hero() {
  const movido = useHeroMovido()
  const hayDosColumnas = useHayDosColumnas()
  const menosMovimiento = useMenosMovimiento()
  const parallax = useHeroParallax(hayDosColumnas && !menosMovimiento)
  useImanHero(parallax, hayDosColumnas && !menosMovimiento, movido)
  return (
    // `data-hero` es el interruptor de los dos estados; `hero-texto` y `hero-ventana`
    // son INERTES sin él y fuera de escritorio (el mecanismo y sus condiciones están
    // en index.css). Sin eso esto es el hero de siempre: una maquetación, no dos.
    // EL RECORTE VA EN UN ENVOLTORIO A TODO EL ANCHO, no en la sección.
    //
    // Hace falta un guardarraíl porque los dos mocks ASOMAN por fuera de la
    // ventana: en reposo todavía no están colocados y, sin nada que los recorte,
    // empujan la página y sacan una barra horizontal.
    //
    // Pero ponerlo en la SECCIÓN estaba mal, y se vio en pantalla: la sección va
    // acotada a `max-w-7xl`, así que recortaba en el filo de la COLUMNA y no en el
    // de la ventana del navegador. Con el realce puesto no se notaba (el 0,92 los
    // mete hacia dentro), pero con `prefers-reduced-motion` los mocks se ven
    // quietos en su sitio final y ahí SÍ: a 1440 el teléfono se quedaba con 39px
    // cortados. A todo el ancho, el recorte cae donde de verdad está el límite.
    //
    // `clip` y no `hidden` porque `hidden` haría de esto un contenedor de scroll.
    // Recorta en la caja de RELLENO, así que lo que cuelga hacia abajo dentro del
    // `pb-24` de la sección no se toca.
    <div className="overflow-x-clip">
    <section
      data-hero={movido ? 'movido' : undefined}
      className="hero-seccion mx-auto max-w-7xl px-4 pb-16 pt-20 text-center sm:px-6 lg:-mb-16 lg:pb-0 lg:pt-28"
    >
        <div className="hero-texto">
          <h1 className="mx-auto text-balance text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.035em] text-slate-900 sm:text-5xl lg:text-[4rem] lg:leading-[0.95] lg:tracking-[-0.02em]">
            Tu centro de contratación
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-xl leading-snug text-slate-600 sm:text-xl lg:mt-9 lg:text-lg">
            Más claro, más rápido y más fácil que nunca.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:mt-6">
            <Link to="/login" className={BTN_PRIMARY_LG}>
              Empieza gratis
            </Link>
            <Link to="/demo" className={BTN_SECONDARY_LG}>
              Ver la demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">{TRIAL_REASSURANCE}</p>
        </div>
      {/* La ventana va ENTERA y quien la corta es el pliegue, no un alto inventado:
          arriba se ve el arranque de la app y al desplazar aparece el resto.

          El teléfono va DENTRO de `hero-ventana`, no al lado: el realce del scroll
          sube y encoge un OBJETO, y dos piezas que se mueven por separado se leerían
          como dos cosas sueltas justo cuando la composición dice que son una.

          Se MONTA, no se esconde con `hidden lg:block`: es una imagen de 380 KB que
          nadie ve en un móvil, y ahí el hero además ya se sale de pantalla. Es el
          mismo umbral que usa la propia página del anuncio para montar su raíl. */}
      <div ref={parallax} className="hero-parallax">
      {/* 66rem = 1056px. Bajó de 70,875 (1134) porque a ese ancho la ventana llenaba
          la fila entera y los dos mocks solo tenían margen para asomar; un peldaño
          más pequeña, la composición se lee como tres piezas sobre una mesa y no
          como un panel con dos pegatinas. La captura mide 3024 y aquí se pinta a
          1056, así que sigue sobrándole resolución en cualquier pantalla. */}
      <div className="hero-ventana relative mx-auto mt-12 lg:mt-[5.1875rem] lg:max-w-[66rem]">
        <AppShot enReposo={!movido} />
        {hayDosColumnas && (
          // Cuánto ASOMA por fuera del filo derecho: un cuarto de su ancho en los
          // dos anchos (48 de 200, 56 de 232), no una medida suelta por talla. El
          // techo no es estético: en el estado movido todo va al 0,92, así que el
          // teléfono acaba más adentro de lo que dice su `right`, y aun así a
          // 1024px se queda a 19px del filo de la ventana del navegador. Por
          // encima de eso empieza a leerse como que se cae de la pantalla.
          // Dónde se colocan y cuánto se alejan lo declara `index.css`: no es un
          // par de offsets sueltos sino una cuenta contra el filo del navegador,
          // con su mínimo y su techo, y ahí está explicada.
          <>
            <TablonShot enReposo={!movido} />
            <MovilShot enReposo={!movido} />
          </>
        )}
      </div>
      </div>
    </section>
    </div>
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
            <div className="flex h-full flex-col overflow-hidden rounded-2xl filo bg-white shadow-card">
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
            <div className="flex h-full flex-col overflow-hidden rounded-2xl filo-green-200 bg-white shadow-card">
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

                <div className="mt-1.5 rounded-xl filo-green-200 bg-white p-3.5">
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
                      <span key={p} className="rounded-lg bg-slate-50 px-2.5 py-1 text-caption font-medium text-slate-600 ring-1 ring-inset ring-slate-200 num">{p}</span>
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
    <div className="mt-6 overflow-hidden rounded-xl filo bg-slate-50">
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
    <div className="flex h-full flex-col rounded-2xl filo bg-white card-pad shadow-card lg:card-pad-loose">
      <Icon className="size-5 shrink-0 text-slate-700" aria-hidden />
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
      <Icon className="mt-0.5 size-5 shrink-0 text-slate-700" aria-hidden />
      <div className="min-w-0">
        <h3 className="text-copy-md font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-copy leading-relaxed text-slate-600">{body}</p>
      </div>
    </div>
  )
}

function FeatureSecondaryCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex h-full flex-col rounded-2xl filo bg-white p-6 shadow-card">
      <Icon className="size-5 shrink-0 text-slate-700" aria-hidden />
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
          <div className="mt-5 divide-y divide-slate-200 rounded-2xl filo bg-white shadow-card">
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
  const sergio = memberAvatarTone('sergio@apuntatefacil.com')
  const laura = memberAvatarTone('laura@apuntatefacil.com')
  const you = memberAvatarTone('demo@apuntatefacil.com')

  return (
    <div aria-hidden className="relative">
      <div className="flex flex-col overflow-hidden rounded-2xl filo bg-white shadow-card">
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
            <ul className="overflow-hidden rounded-xl filo bg-white">
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
                  {initials('laura@apuntatefacil.com')}
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
                  <span className="mt-2 flex min-h-9 w-full max-w-md items-center gap-2.5 rounded-xl filo bg-white py-1.5 pl-2 pr-3">
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
                  {initials('sergio@apuntatefacil.com')}
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
          {/* Mock: es un <span>, no un botón, así que lleva la pintura del secundario
              pero sin hover ni press (un mock que reacciona y no hace nada miente).
              Lo que sí comparte es el `ring-inset` y la sombra del vocabulario. */}
          <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-medium text-slate-800 ring-1 ring-inset ring-slate-200">
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
          <p className="text-sm font-semibold text-slate-500">Equipo, incluido en todos los procesos</p>
          <h2 className="mt-3 max-w-xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Coordina necesidades internas con tu base de candidatos
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-slate-600">
            Publica en el tablón lo que necesitas cubrir. Tu equipo propone candidatos de la base, con estado y teléfono, listos para llamar.
          </p>
          <ul className="mt-7 space-y-4">
            {points.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <p.icon className="mt-0.5 size-5 shrink-0 text-slate-700" aria-hidden />
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

function CompactCostComparison() {
  return (
    <div className="overflow-hidden rounded-2xl filo bg-slate-50">
      <div className="grid grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="border-b border-r border-slate-200 px-4 py-4">
          <h3 className="text-label font-semibold leading-snug text-slate-700">Lo que ocurre hoy</h3>
        </div>
        <div className="border-b border-white/15 bg-slate-900 px-4 py-4">
          <h3 className="text-label font-semibold leading-snug text-white">Con Apúntate Fácil</h3>
        </div>
      </div>
      <ul aria-label="Comparación entre el proceso actual y Apúntate Fácil">
        {COMPACT_COST_COMPARISON_ROWS.map((row, index) => {
          const isLast = index === COMPACT_COST_COMPARISON_ROWS.length - 1
          const lightDivider = isLast ? '' : 'border-b border-slate-200'
          const darkDivider = isLast ? '' : 'border-b border-white/15'
          return (
            <li key={row.cost} className="grid grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
              <p className={`${lightDivider} flex min-h-28 items-center border-r border-slate-200 px-4 py-5 text-copy font-semibold leading-snug text-slate-900`}>
                {row.cost}
              </p>
              <p className={`${darkDivider} flex min-h-28 items-center bg-slate-900 px-4 py-5 text-copy font-semibold leading-snug text-white`}>
                {row.benefit}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CostComparisonLedger() {
  return (
    <>
      <div className="lg:hidden">
        <CompactCostComparison />
      </div>
      <div className="hidden overflow-hidden rounded-2xl filo bg-slate-50 lg:block">
        <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-slate-200 px-6 py-7 sm:px-8 sm:py-9 lg:border-r lg:px-9">
            <h3 className="max-w-sm text-title font-semibold tracking-tight text-slate-900">Cuando todo se queda repartido</h3>
            <p className="mt-3 max-w-md text-copy-md leading-relaxed text-slate-600">
              Cada paso exige volver a buscar lo que ya te habían contado.
            </p>
          </div>
          <div className="border-b border-white/15 bg-slate-900 px-6 py-7 text-white sm:px-8 sm:py-9 lg:px-9">
            <h3 className="max-w-sm text-title font-semibold tracking-tight text-white">Cuando cada candidatura entra ordenada</h3>
            <p className="mt-3 max-w-md text-copy-md leading-relaxed text-slate-300">
              El trabajo pasa de perseguir información a decidir con ella.
            </p>
          </div>
        </div>
        <ul aria-label="Comparación entre gestionar respuestas dispersas y candidaturas ordenadas">
          {COST_COMPARISON_ROWS.map((row, index) => {
            const isLast = index === COST_COMPARISON_ROWS.length - 1
            const lightDivider = isLast ? '' : 'border-b border-slate-200'
            const darkDivider = isLast ? '' : 'border-b border-white/15'
            return (
              <li key={row.cost.title} className="grid lg:grid-cols-[0.92fr_1.08fr]">
                <div className={`${lightDivider} px-6 py-5 sm:grid sm:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] sm:gap-6 sm:px-8 sm:py-6 lg:border-r lg:border-slate-200 lg:px-9`}>
                  <h4 className="text-copy-md font-semibold leading-snug text-slate-900">{row.cost.title}</h4>
                  <p className="mt-2 text-copy leading-relaxed text-slate-600 sm:mt-0">{row.cost.body}</p>
                </div>
                <div className={`${darkDivider} bg-slate-900 px-6 py-5 text-white sm:grid sm:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] sm:gap-6 sm:px-8 sm:py-6 lg:px-9`}>
                  <h4 className="text-copy-md font-semibold leading-snug text-white">{row.benefit.title}</h4>
                  <p className="mt-2 text-copy leading-relaxed text-slate-300 sm:mt-0">{row.benefit.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

function CostAnchor() {
  return (
    <section className="bg-white" aria-labelledby="coste-contratar-heading">
      <div className="mx-auto max-w-6xl section-x section-y">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-slate-500">Antes de mirar el precio</p>
          <h2 id="coste-contratar-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Contratar desordenado también tiene un coste
          </h2>
          <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
            No siempre aparece en una factura. Se acumula cuando la información queda repartida justo cuando tienes que decidir rápido.
          </p>
        </div>
        <div className="mt-12">
          <CostComparisonLedger />
        </div>
        <p className="mt-7 max-w-3xl text-copy leading-relaxed text-slate-500">
          Apúntate Fácil no cambia dónde publicas ni atrae candidatos nuevos. Evita que las respuestas que ya recibes se pierdan por falta de información y seguimiento.
        </p>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="precio" className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl section-x section-y">
        <div className="text-center">
          <h2 className="mx-auto max-w-3xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Un precio, sin planes que comparar
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
            Pagas por lo que tienes en marcha: cada proceso de selección abierto. Todo el producto incluido, siempre.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-lg rounded-2xl filo bg-white card-pad shadow-card">
          <PrecioProceso />
          {/* "Sin permanencia" va pegado al precio (doctrina del modelo): es la
              mitad de la promesa. El IVA ya se dice en el propio precio. */}
          <p className="mt-2 text-copy text-slate-600">
            Sin permanencia: cierras un proceso con un clic, deja de cobrarse y sus candidatos siguen siendo tuyos.
          </p>
          <ul className="mt-6 space-y-2.5 border-t border-slate-200 pt-5">
            {[
              'Candidaturas sin límite y usuarios sin límite',
              'Formulario a tu medida, con tu nombre, tu logo y tus colores',
              'Meridian: resume cada candidatura y calcula su ajuste al puesto',
              'Equipo: chat en cada candidato y tablón de peticiones',
              'Filtros, favoritos, etiquetas y exportar a Excel cuando quieras',
              'Soporte humano, te responde una persona',
            ].map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-copy-md text-slate-700">
                <Check className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden /> {feat}
              </li>
            ))}
          </ul>
          <Link to="/login" className={`${BTN_PRIMARY_LG} group mt-7 w-full`}>
            Empezar gratis <ArrowRight className="size-4 transition-transform duration-[var(--duration-control)] ease-out group-hover:translate-x-1" aria-hidden />
          </Link>
          <p className="mt-3 text-center text-sm text-slate-500">{TRIAL_REASSURANCE}</p>
        </div>

        <div className="mx-auto mt-10 max-w-2xl text-center">
          <p className="text-copy leading-relaxed text-slate-500">
            Por menos de lo que cuesta publicar un solo anuncio en InfoJobs (69 € + IVA, agosto 2026),
            tienes todas tus candidaturas ordenadas y filtradas todo el mes.
          </p>
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
          className={`grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-transform duration-[var(--duration-enter)] ease-[var(--ease-out)] motion-reduce:transition-none ${open ? 'rotate-45' : ''}`}
        >
          +
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={!open || undefined}
        className={`grid transition-[grid-template-rows] duration-[var(--duration-enter)] ease-[var(--ease-out)] motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
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
    ['¿Hay permanencia?', 'No. Cierras un proceso con un clic y deja de cobrarse en ese momento. Sin llamadas de retención ni trámites adicionales.'],
    ['¿Los candidatos son míos si cierro un proceso?', 'Sí. El proceso cerrado se conserva entero: puedes consultarlo y exportarlo a Excel en cualquier momento, aunque ya no pagues por él.'],
    ['¿Hay costes ocultos o precios “desde”?', `No. Son ${PRECIO_PROCESO} € al mes + IVA por cada proceso de selección que tengas abierto, con candidaturas sin límite y todo el producto incluido. Lo que ves aquí es lo que pagas.`],
    ['¿Puedo probarlo sin registrarme ni tarjeta?', `Sí. La demo funciona con datos de ejemplo, sin cuenta ni tarjeta. Y al crear tu cuenta, tu primer proceso es gratis durante ${PRUEBA_DIAS} días, con todas las candidaturas que lleguen y también sin tarjeta: se pide al final de la prueba.`],
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
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:mt-6">
          <Link to="/demo" className={`${BTN_INVERTED_LG} group`}>
            Ver la demo <ArrowRight className="size-4 transition-transform duration-[var(--duration-control)] ease-out group-hover:translate-x-1" aria-hidden />
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
