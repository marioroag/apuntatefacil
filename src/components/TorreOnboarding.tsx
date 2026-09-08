import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ExternalLink, Minus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { useOnboarding } from '../lib/onboarding'
import { useAppBase } from '../lib/useAppBase'
import { useShell } from '../lib/shell'
import { copyText } from '../lib/clipboard'
import { publicFormUrl, publicFormUrlDisplay } from '../lib/brand'
import { PASOS, estadoDe, pasosDeducidos, type EstadoPaso, type Paso } from '../lib/primerosPasos'
import { BTN_PRIMARY, BTN_SECONDARY, ICONO_CONTROL } from '../lib/buttons'
import { Pliegue } from './ui/Pliegue'
import { useToast } from './ui/Toast'

/**
 * LA TORRE DE PRIMEROS PASOS (Mario, sep 2026). Sustituye a la guía flotante:
 * una tarjeta por paso, apiladas en Vista general, que te LLEVAN a hacerlo y se
 * marcan al hacerlo. Solo el paso actual está desplegado (título, texto y
 * botón); los hechos se pliegan a una línea con su check y los que vienen a
 * una línea apagada con su número. Es una torre que se sube.
 *
 * Qué pasos hay y en cuál estás lo decide `lib/primerosPasos.ts`; aquí solo se
 * pinta y se ejecuta la acción de cada uno. Los estados van en TINTA: ni en el
 * acento (que es acción, y aquí lo que se enciende es el botón) ni en verde
 * (que es "contratado"). Un check en tinta ya dice "hecho".
 */
export function TorreOnboarding() {
  const ob = useOnboarding()
  const { setOnboardingDone } = useAuth()
  const toast = useToast()

  const saltar = async () => {
    await setOnboardingDone(true)
    toast.show('Guía cerrada. La tienes en tu cuenta, en Primeros pasos.', {
      action: { label: 'Deshacer', onClick: () => void setOnboardingDone(false) },
    })
  }

  return (
    // EL ANCHO DE LA GUÍA (640, `--container-guia`), no el de trabajo ni el de
    // lectura: a 1240 cada tarjeta era una barra ancha con tres líneas dentro y
    // a 820 seguía siéndolo (Mario, sep 2026: "son demasiado anchas"). Una
    // torre es un objeto que se abarca de un vistazo, con el botón a un palmo
    // del título. El vacío de la derecha se deja donde cae, como dice la
    // doctrina; es lo que hace que la torre se lea como un objeto y no como una
    // tabla. Y va CENTRADA (Mario, sep 2026): pegada a la izquierda bajo un
    // saludo a ancho completo dejaba todo el aire a un lado; en el centro la
    // torre es el objeto de la pantalla y el vacío la rodea por igual.
    <section aria-labelledby="torre-titulo" className="mx-auto max-w-guia">
      <div className="flex items-center justify-between gap-4">
        <h2 id="torre-titulo" className="text-base font-semibold text-slate-900">Primeros pasos</h2>
        {/* El avance se ve antes de leerse: UNA barra continua que se rellena
            del verde de "hecho" junto a la cifra (se probó troceada en seis
            segmentos y Mario la tumbó: se leía como un contador de pasos, no
            como un avance). El mismo vocabulario que el anillo del menú de
            cuenta, en línea en vez de en círculo. Se rellena con `scaleX` desde
            la izquierda, que es lo único que esta casa anima, y a
            `--duration-max`: es una barra que recorre distancia. La cifra va en
            `aria-hidden` y el conjunto se dice entero en `sr-only`, o el lector
            leería el número dos veces. */}
        <span className="flex items-center gap-3">
          <span className="relative block h-1 w-28 overflow-clip rounded-full bg-slate-200" aria-hidden>
            <span
              className="absolute inset-0 origin-left rounded-full bg-green-500 transition-transform duration-[var(--duration-max)] ease-[var(--ease-standard)] motion-reduce:transition-none"
              style={{ transform: `scaleX(${ob.torre.total ? ob.torre.hechos / ob.torre.total : 0})` }}
            />
          </span>
          <span className="num text-[12px] font-semibold text-slate-500" aria-hidden>
            {ob.torre.hechos} de {ob.torre.total}
          </span>
          <span className="sr-only">{ob.torre.hechos} de {ob.torre.total} pasos resueltos</span>
        </span>
      </div>
      <ol className="torre-in mt-4 flex flex-col gap-3">
        {PASOS.map((p, i) => (
          <TarjetaPaso key={p.id} paso={p} n={i + 1} estado={estadoDe(ob.torre, p.id)} />
        ))}
      </ol>
      {ob.torre.completa ? (
        <TarjetaFinal />
      ) : (
        <button
          onClick={() => void saltar()}
          className="mt-5 text-[13px] font-medium text-slate-500 underline hover:text-slate-700"
        >
          Saltar la guía
        </button>
      )}
    </section>
  )
}

// El cuerpo del paso va sangrado hasta el título: relleno de 24 + insignia de
// 32 + hueco de 14 = 70px, así el texto y el botón caen en la misma vertical
// que lo que tienen encima y no debajo del número. En un móvil esa sangría se
// come un tercio del ancho y deja el texto en una columna de 250px, así que ahí
// el cuerpo vuelve al relleno de la tarjeta: se lee de corrido debajo del
// título, que es como se lee todo lo demás en esa pantalla.
const SANGRIA = 'pl-[70px] max-sm:pl-6'

function TarjetaPaso({ paso, n, estado }: { paso: Paso; n: number; estado: EstadoPaso }) {
  const ob = useOnboarding()
  const { company } = useAuth()
  const { brands } = useStore()
  const shell = useShell()
  const navigate = useNavigate()
  const base = useAppBase()
  const toast = useToast()
  const actual = estado === 'actual'
  const c = ob.campaign

  // Caso raro: creó un puesto (la marca ya está) y luego lo borró. Los pasos
  // que hablan de "tu puesto" no tienen adónde llevar hasta que haya otro.
  const sinPuesto = !c && paso.id !== 'puesto'

  const brandLabel = (c?.brandId ? brands.find((b) => b.id === c.brandId)?.name : null) ?? company?.name
  const url = c ? publicFormUrl(c.slug, brandLabel) : ''

  const hacer = async () => {
    if (sinPuesto || paso.id === 'puesto') return shell?.abrirAsistente()
    if (!c) return
    switch (paso.id) {
      case 'preguntas':
        return navigate(`${base}/puestos/${c.id}/formulario`)
      case 'probar':
        return navigate(`${base}/puestos/${c.id}`)
      case 'enlace': {
        const ok = await copyText(url)
        if (ok) {
          toast.success('Enlace copiado')
          ob.marcar('enlace', 'hecho')
        } else toast.show('Copia el enlace manualmente: ' + publicFormUrlDisplay(c.slug, brandLabel))
        return
      }
      case 'equipo':
        return navigate(`${base}/equipo?t=miembros`)
      case 'logo':
        return navigate(`${base}/puestos/${c.id}/formulario?identidad`)
    }
  }

  // La jerarquía la dan el peso y el color, no el tamaño: los seis títulos van
  // al mismo cuerpo, y el que está en curso sube a semibold y a tinta; los que
  // vienen se quedan en el gris de apoyo (4,8:1, sigue siendo texto legible).
  const titulo =
    estado === 'actual'
      ? 'font-semibold text-slate-900'
      : estado === 'pendiente'
        ? 'font-medium text-slate-500'
        : 'font-medium text-slate-600'

  return (
    // Filas de 80px en reposo (24 de relleno + 32 de insignia): una tarjeta
    // que se pulsa con el ojo antes que con el dedo necesita aire, y a 60 la
    // torre se leía como un menú. El paso en curso lleva además el filo un
    // peldaño más oscuro: es la única tarjeta abierta y la única que se
    // distingue por algo más que su insignia.
    <li
      aria-current={actual ? 'step' : undefined}
      className={`overflow-clip rounded-xl bg-white shadow-card ${actual ? 'filo-slate-300' : 'filo'}`}
    >
      {/* Abierta, la cabecera cede parte de su aire de abajo al cuerpo, que es
          quien lo necesita; el pliegue recorta, así que el cuerpo no puede
          subir con un margen negativo o pierde su primera línea. */}
      <div className={`flex items-center gap-3.5 px-6 pt-6 ${actual ? 'pb-3' : 'pb-6'}`}>
        <Insignia n={n} estado={estado} />
        <p className={`min-w-0 text-[15px] leading-snug ${titulo}`}>{paso.titulo}</p>
      </div>
      <Pliegue abierto={actual} ritmo="aparecer">
        <div className={`${SANGRIA} pb-6 pr-6`}>
          <p className="max-w-[52ch] text-sm leading-relaxed text-slate-600">
            {sinPuesto ? 'Has borrado tu puesto. Crea otro para seguir.' : paso.texto}
          </p>
          {paso.id === 'enlace' && c && (
            // La misma caja que el hueco vacío del puesto: el enlace discreto y
            // truncado, porque manda la acción.
            <p className="mt-4 truncate rounded-xl filo bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-500">
              {publicFormUrlDisplay(c.slug, brandLabel)}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => void hacer()} className={BTN_PRIMARY}>
              {sinPuesto ? 'Crear un puesto' : paso.accion}
            </button>
            {paso.id === 'enlace' && c && (
              <a href={url} target="_blank" rel="noopener" className={BTN_SECONDARY}>
                <ExternalLink className={ICONO_CONTROL} aria-hidden /> Ver mi enlace
              </a>
            )}
            {paso.opcional && (
              <button onClick={() => ob.marcar(paso.id, 'omitido')} className={BTN_SECONDARY}>
                Omitir
              </button>
            )}
          </div>
        </div>
      </Pliegue>
    </li>
  )
}

/**
 * La insignia del paso: un disco de 32px. Cuatro caras y cada una con su
 * color, porque aquí el disco ES el estado:
 *  - en curso: el acento, con el número. Es la SELECCIÓN de la torre (el paso
 *    en el que estás) y su botón, del mismo color, va justo debajo.
 *  - hecho: el verde suave de estado con un check en verde. Un disco negro con
 *    un check blanco se veía pesado (Mario, sep 2026), y seis seguidos eran
 *    una columna de puntos negros mandando sobre la pantalla; el verde dice
 *    "hecho" sin que nadie lo aprenda y no pesa nada.
 *  - pendiente: contorno con el número en gris. Todavía no es nada.
 *  - omitido: contorno con una raya. Se pasó de largo, y no es lo mismo.
 * Lo que dice cada forma va también en `sr-only`: el color solo no es un
 * portador.
 */
function Insignia({ n, estado }: { n: number; estado: EstadoPaso }) {
  const cara =
    estado === 'actual'
      ? 'bg-indigo-600 text-white'
      : estado === 'hecho'
        ? 'bg-estado-verde text-green-700'
        : 'text-slate-500 ring-1 ring-inset ring-slate-300'
  return (
    <span
      className={`num grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold transition-colors duration-[var(--duration-control)] ${cara}`}
    >
      {estado === 'hecho' ? (
        <>
          <Check className="size-4 [stroke-width:calc(var(--stroke-icon)*1.15)]" aria-hidden />
          <span className="sr-only">Hecho:</span>
        </>
      ) : estado === 'omitido' ? (
        <>
          <Minus className="size-4" aria-hidden />
          <span className="sr-only">Omitido:</span>
        </>
      ) : (
        <>
          <span aria-hidden>{n}</span>
          <span className="sr-only">Paso {n}{estado === 'actual' ? ', en curso' : ''}:</span>
        </>
      )}
    </span>
  )
}

/**
 * El cierre: la torre está completa. Es el hito del primer uso, un único momento
 * ganado y sobrio: la insignia asienta y el check se dibuja de un trazo, en
 * tinta (el verde es de "contratado"). "Terminar" cierra la guía y Vista general
 * vuelve a la normalidad en el mismo render.
 */
function TarjetaFinal() {
  const ob = useOnboarding()
  const { company, setOnboardingDone } = useAuth()
  const { deleteCandidate } = useStore()
  const prueba = ob.testCandidate
  return (
    <div className="mt-5 flex items-start gap-3.5 rounded-xl filo-slate-300 bg-white p-6 shadow-card max-sm:p-5">
      <span className="onboarding-badge grid size-9 shrink-0 place-items-center rounded-full bg-estado-verde text-green-700">
        {/* El trazo va RELATIVO al del sistema: es un check de celebración y va
            más gordo a propósito, pero si algún día se mueve `--stroke-icon`
            este se mueve con él en vez de quedarse descolgado. */}
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeLinecap="round" strokeLinejoin="round"
          className="onboarding-check size-5 [stroke-width:calc(var(--stroke-icon)*1.4)]" aria-hidden
        >
          <path d="M20 6 9 17l-5-5" pathLength={1} />
        </svg>
      </span>
      <div className="min-w-0 pt-1.5">
        <p className="text-[15px] font-semibold leading-snug text-slate-900">Ya está. Tu cuenta está lista para recibir candidaturas</p>
        <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-slate-600">
          Cada persona que responda a tus preguntas entrará en tu lista, ordenada y con sus respuestas.
          Cuando publiques tu anuncio, comparte el enlace con quien te conteste.
        </p>
        {prueba && company?.plan === 'trial' && (
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            Tu candidatura de prueba no es de una persona real: bórrala cuando ya no la necesites.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => void setOnboardingDone(true)} className={BTN_PRIMARY}>
            Terminar
          </button>
          {prueba && (
            <button
              onClick={() => { deleteCandidate(prueba.id); void setOnboardingDone(true) }}
              className={BTN_SECONDARY}
            >
              Borrar la prueba
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * LA MEMORIA DE LA TORRE. No pinta nada: mira lo que los datos deducen y lo
 * ESCRIBE como marca en cuanto se cumple, en un solo lote. Es lo que convierte
 * "hay una candidatura" en "el paso está hecho" para siempre, aunque la
 * candidatura se borre después. Lo monta el shell, que es lo único que nunca se
 * desmonta, así que latchea entres por donde entres.
 */
export function MemoriaDePasos() {
  const ob = useOnboarding()
  const { company, marcarPasos } = useAuth()
  const marcas = company?.onboarding_pasos
  const nuevos = ob.active ? pasosDeducidos(ob.deducido).filter((id) => marcas?.[id] !== 'hecho') : []
  const clave = nuevos.join('|')
  useEffect(() => {
    if (!clave) return
    void marcarPasos(Object.fromEntries(clave.split('|').map((id) => [id, 'hecho' as const])))
    // Solo `clave`: `marcarPasos` se recrea en cada render y `nuevos` también;
    // lo que decide si hay algo que escribir es el contenido. Y repetir una
    // escritura ya hecha no cuesta nada: fusiona sobre el último mapa y calla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  return null
}
