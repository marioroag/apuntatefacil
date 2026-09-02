import { useEffect, useRef, useState } from 'react'
import { Briefcase, ChevronRight, RefreshCw, Sparkles } from 'lucide-react'
import type { Candidate } from '../lib/types'
import { initials, candidateName } from '../lib/format'
import { useStore } from '../lib/store'
import { BTN_SECONDARY, BTN_SECONDARY_SM } from '../lib/buttons'
import { ANILLO_AJUSTE, MERIDIAN_NAME, candidateFit, fitTier } from '../lib/meridian'
import { Avatar } from './ui/Avatar'

/**
 * La caja del informe: TARJETA DESDE `sm`, plana en un teléfono.
 *
 * En escritorio es un objeto dentro de una columna con aire y su borde dice
 * dónde empieza y acaba el juicio de Meridian. En móvil la ficha se organiza en
 * franjas planas separadas por un filo de lado a lado (ver `Seccion` en
 * `CandidateModal`), y ahí una caja con borde entre dos franjas es la única de
 * las siete con contorno: se lee como un aviso, no como un apartado más. El
 * relleno se va con ella, o el informe quedaría sangrado 14px respecto a los
 * rótulos de sus vecinas.
 */
const TARJETA_INFORME = 'sm:rounded-xl sm:filo sm:p-3.5'

// Cara del candidato, con el ajuste de Meridian pintado como un anillo de progreso
// alrededor. DOCTRINA del anillo: grafito neutro y valor por LONGITUD DE ARCO, nunca
// por color (el acento se reserva a acción; un score no lleva paleta de estados).
//
// **Hoy el anillo está APAGADO** (`ANILLO_AJUSTE`, ago 2026) y esto delega en
// `ui/Avatar`, la primitiva única de las caras de la app. Es donde debería haber
// estado siempre la parte de "pintar una cara": aquí había una copia con las mismas
// proporciones escritas otra vez, y por eso el comentario de abajo tiene que
// recordar que hay que mantenerlas a mano. Con la bandera en `true` vuelve el anillo.
export function MeridianAvatar({ name, fit, size = 40 }: { name: string; fit?: number | null; size?: number }) {
  // Este DECIDE y no pinta, así que no tiene ni un hook: es la forma que pide el
  // guardián de `hooks.test.ts` para un corte como este. Un `return` temprano con
  // los hooks del anillo debajo rompía la regla de React (los cazó él, no yo), y
  // su mensaje dice justo esto: no subas el return, parte el componente.
  if (!ANILLO_AJUSTE) return <Avatar name={name} size={size} />
  return <AvatarConAnillo name={name} fit={fit} size={size} />
}

/** El de siempre: cara + anillo de ajuste. Sin cortes, todos sus hooks fijos. */
function AvatarConAnillo({ name, fit, size }: { name: string; fit?: number | null; size: number }) {
  const has = typeof fit === 'number'
  const stroke = size >= 40 ? 2.5 : 2
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, fit ?? 0))
  const dash = (pct / 100) * circ
  // El arco se BARRE hasta su medida la primera vez que hay medida, como un
  // instrumento que se para en su lectura: es el momento de pago del análisis y
  // el único de todo el bloque que se celebra. Solo en la transición "sin
  // ajuste -> con ajuste": una cara que ya venía medida (abrir una ficha vieja,
  // pintar la tabla, pasar con las flechas) entra quieta. Un análisis repetido
  // tampoco barre: mover el arco de 71 a 68 se leería como una corrección.
  const antes = useRef<number | null>(has ? pct : null)
  const [barre, setBarre] = useState(false)
  useEffect(() => {
    const previo = antes.current
    antes.current = has ? pct : null
    if (has && previo == null) setBarre(true)
  }, [has, pct])
  // El anillo vive en un CARRIL RESERVADO alrededor de la cara, se pinte o no: la
  // cara mide siempre lo mismo para un `size` dado. Antes el carril se le quitaba a
  // la cara solo al analizar, y en la misma lista convivían caras de 34 y de 26 px
  // (con iniciales de 8, por debajo del suelo legible): a la misma persona la
  // encogía que Meridian hubiera hablado de ella.
  const carril = stroke + (size >= 40 ? 2 : 1.5)
  const inner = size - 2 * carril
  // Misma proporción y mismo suelo que `ui/Avatar`, la primitiva de las caras del
  // equipo: dos iniciales al 40% del círculo y nunca por debajo de 9px.
  const fontSize = Math.max(9, Math.round(inner * 0.4))
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      title={has ? `Ajuste ${Math.round(pct)} sobre 100` : undefined}
    >
      {has && (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            // Dasharray fijo + offset (y no un dasharray que cambia): el offset
            // es lo que anima de forma fiable en todos los navegadores, y el
            // keyframe solo declara el `from`, así el final lo pone este valor.
            strokeDasharray={circ}
            strokeDashoffset={circ - dash}
            style={barre ? ({ '--circ': circ } as React.CSSProperties) : undefined}
            className={`stroke-slate-700 ${barre ? 'meridian-sweep' : ''}`}
          />
        </svg>
      )}
      <span
        className="grid place-items-center rounded-full bg-slate-100 font-bold leading-none text-slate-600"
        style={{ width: inner, height: inner, fontSize }}
      >
        {initials(name)}
      </span>
      {has && <span className="sr-only">Ajuste de {MERIDIAN_NAME}: {Math.round(pct)} sobre 100</span>}
    </span>
  )
}

// Etiqueta CUALITATIVA del ajuste (Encaja bien / Puede encajar / A valorar).
// Texto grafito, NUNCA una pastilla con punto de color (para no confundirse con los
// chips de estado). El énfasis por peso/oscuridad, jamás por tono de color.
export function FitLabel({ fit, className = '' }: { fit: number; className?: string }) {
  const t = fitTier(fit)
  const tone =
    t.key === 'bien' ? 'font-semibold text-slate-800'
    : t.key === 'puede' ? 'font-medium text-slate-600'
    : 'text-slate-500'
  return <span className={`${tone} ${className}`}>{t.label}</span>
}

// Etiqueta de sección del bloque (marca del asistente). El icono es decorativo:
// grafito neutro, nunca el acento.
//
// EL ENCAJE VA A LA DERECHA, EN LA MISMA LÍNEA (Mario, sep 2026). El informe
// EXPLICA por qué encaja, pero para saber si encaja había que leerse el párrafo
// entero, y eso es justo lo que la lista contesta de un vistazo en su columna
// Encaje. Aquí el veredicto vuelve a estar donde se busca, en la cabecera de su
// propio bloque, y el párrafo pasa a hacer lo que sabe hacer: sostenerlo.
//
// En PALABRAS y nunca la nota cruda, que sigue viviendo en el `title`: un número
// al lado de una persona la convierte en un puesto de una clasificación. Y un
// peldaño por debajo del rótulo (13 contra 14), que si no son dos títulos
// disputándose la misma línea.
function MeridianLabel({ fit }: { fit?: number | null }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
      <Sparkles className="size-4 text-slate-500" aria-hidden />
      {MERIDIAN_NAME}
      {fit != null && (
        <span className="ml-auto shrink-0" title={`Ajuste ${Math.round(fit)} sobre 100`}>
          <FitLabel fit={fit} className="text-[13px]" />
        </span>
      )}
    </span>
  )
}

// Fila de candidato con la lectura de Meridian, reutilizable en el Parte diario.
// Presentational: el que la usa decide qué pasa al abrir (normalmente abrir el panel).
export function MeridianCandidateRow({
  candidate,
  campaignTitle,
  onOpen,
}: {
  candidate: Candidate
  campaignTitle?: string
  onOpen: () => void
}) {
  const name = candidateName(candidate) || 'Sin nombre'
  const fit = candidateFit(candidate.ai)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
    >
      <MeridianAvatar name={name} fit={fit} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium text-slate-900">{name}</span>
          {fit != null && <FitLabel fit={fit} className="shrink-0 text-[12px]" />}
        </div>
        {candidate.ai?.summary && (
          <p className="mt-0.5 line-clamp-1 text-[13px] text-slate-500">{candidate.ai.summary}</p>
        )}
        {campaignTitle && (
          <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-1.5 pr-2 text-[12px] font-medium text-slate-600">
            <Briefcase className="size-3 shrink-0 text-slate-500" aria-hidden />
            <span className="truncate">{campaignTitle}</span>
          </span>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
    </button>
  )
}

// Bloque de triaje de Meridian dentro del detalle del candidato.
//
// EL INFORME ES UN PÁRRAFO, NO UNA LISTA (Mario, ago 2026, con feedback real de
// un cliente delante: "pone la información de las respuestas peor y aporta poco
// al espacio que consume"). El desglose criterio a criterio repetía en formato
// lista lo que el usuario ya tiene delante en Respuestas; ahora el bloque pinta
// `ai.informe`, la prosa que un profesional de selección le diría a su jefe al
// preguntarle por este candidato. La redacta el REDACTOR de la edge function
// DESPUÉS del juez, solo con material verificado, así que sigue sin poder
// afirmar nada sin evidencia; lo que cambia es la forma: un insight que se
// sostiene solo en vez de una tabla que había que interpretar.
//
// Con el párrafo se fueron el plegado (un insight de 3-5 frases no se come la
// columna, y esconderlo detrás de un clic contradecía su razón de ser), las
// listas "A favor" / "A confirmar" (los mismos juicios contados otra vez) y los
// enlaces cita a cita: el viaje al documento queda en UN enlace, "Ver las citas
// subrayadas en el CV", que salta al visor con el subrayado y el destello de
// siempre. Los criterios se siguen guardando (son el número y las citas), solo
// dejó de pintarse su tabla.
export function MeridianPanelBlock({
  candidate,
  verCitas,
}: {
  candidate: Candidate
  /** El viaje al documento: cuántas citas hay subrayadas en el visor del CV y
   *  cómo ir a la primera. Lo pasa la ficha solo cuando hay citas localizables
   *  (cvLeido 'texto'); sin él, el informe no promete ningún salto. */
  verCitas?: { n: number; abrir: () => void }
}) {
  const { analyzeCandidate } = useStore()
  const [busy, setBusy] = useState(false)
  // La ficha del candidato que ACABA de analizarse imprime su informe con la
  // entrada suave (.meridian-in). Guardamos el id, no un booleano: al pasar con
  // las flechas a otro candidato ya analizado, su bloque entra quieto, porque el
  // producto carga en la tarea y la coreografía es solo del momento de analizar.
  const [recienId, setRecienId] = useState<string | null>(null)
  const ai = candidate.ai
  const failed = !!ai?.error

  const run = async (force = false) => {
    if (busy) return
    setBusy(true)
    const ok = await analyzeCandidate(candidate.id, force ? { force: true } : undefined)
    setBusy(false)
    if (ok) setRecienId(candidate.id)
  }

  // El skeleton se decide ANTES que el informe: al VOLVER a analizar ya hay un
  // análisis pintable, y sin este orden la espera no se veía (el informe viejo
  // se quedaba quieto hasta aterrizar el nuevo, como si el botón no hiciera nada).
  if (busy) {
    return (
      <div className={TARJETA_INFORME}>
        <MeridianLabel />
        <p className="mt-1.5 text-[13px] leading-5 text-slate-500" role="status">
          Leyendo la candidatura y midiéndola contra lo que pide el puesto…
        </p>
        {/* La silueta es la del informe que viene: un párrafo, con la última
            línea corta como una línea final de verdad. */}
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="skeleton h-2.5 w-full rounded-full" />
          <div className="skeleton h-2.5 w-11/12 rounded-full" />
          <div className="skeleton h-2.5 w-full rounded-full" />
          <div className="skeleton h-2.5 w-2/5 rounded-full" />
        </div>
      </div>
    )
  }

  // Sin gating por plan: con el pago por proceso (ago 2026) Meridian está
  // incluido para todo el mundo, también en la prueba (el coste lo acota su
  // tope de candidaturas). El fail-closed de un plan desconocido lo aplica el
  // servidor, que responde sin analizar y aquí se traduce en el toast del store.

  // Analizado con éxito. El veredicto (etiqueta y anillo) vive en la CABECERA
  // del panel, así que aquí queda solo la lectura.
  //
  // "Volver a analizar" EXISTE desde ago 2026 (lo pidió Mario) y vive al FONDO
  // del bloque, tras el filo: los análisis envejecen cuando Meridian mejora
  // (el informe en prosa, la trayectoria, las citas) y tiene que haber forma de
  // refrescarlos. La cautela vieja (re-tirar cambia el número y eso come
  // confianza) no desaparece, decide el SITIO: al final, no a un clic del
  // veredicto.
  if (ai && !failed) {
    const informe = ai.informe
    const print = recienId === candidate.id
    return (
      <div className={TARJETA_INFORME}>
        <MeridianLabel fit={candidateFit(ai)} />
        <div className={print ? 'meridian-in' : ''}>
          {/* El informe (o, en análisis anteriores a él, la frase de veredicto
              de entonces). Tinta de lectura: aquí el texto ES la cosa. */}
          <p className="mt-1.5 text-sm leading-6 text-slate-800">{informe ?? ai.summary}</p>
          {!informe && (
            <p className="mt-1.5 text-[12px] leading-4 text-slate-500">
              Este análisis es anterior al informe: vuelve a analizar la candidatura para tenerlo.
            </p>
          )}
          {ai.cvUsed === false && (
            <p className="mt-1.5 text-[12px] leading-4 text-slate-500">Sin CV: la he mirado solo por sus respuestas.</p>
          )}
          {verCitas && (
            <p className="mt-1.5 text-[13px] leading-5">
              {/* El subrayado punteado dice "esto lleva a su cita", el mismo
                  lenguaje que tenían los hechos enlazados. El destello lo
                  remata el visor. */}
              <button
                type="button"
                onClick={verCitas.abrir}
                className="rounded-sm text-left text-slate-600 underline decoration-slate-300 decoration-dotted underline-offset-2 transition-colors duration-[var(--duration-control)] hover:text-slate-800 hover:decoration-slate-500"
              >
                {verCitas.n === 1 ? 'Ver la cita subrayada en el CV' : `Ver las ${verCitas.n} citas subrayadas en el CV`}
              </button>
            </p>
          )}
        </div>
        <div className="mt-3 border-t border-slate-100 pt-2.5">
          <button type="button" onClick={() => void run(true)} className={BTN_SECONDARY_SM}>
            <RefreshCw className="size-3.5 text-slate-500" aria-hidden /> Volver a analizar
          </button>
        </div>
      </div>
    )
  }

  // Sin analizar o con error: acción para (re)analizar.
  return (
    <div className={TARJETA_INFORME}>
      <MeridianLabel />
      <p className="mb-2.5 mt-1.5 text-[13px] leading-5 text-slate-500">
        {failed
          ? 'No he podido analizar esta candidatura. Inténtalo de nuevo.'
          : 'Aún no la he analizado. La reviso y te digo su ajuste al puesto.'}
      </p>
      <button type="button" onClick={() => void run()} className={BTN_SECONDARY}>
        <Sparkles className="size-3.5 text-slate-500" aria-hidden /> {failed ? 'Volver a analizar' : `Analizar con ${MERIDIAN_NAME}`}
      </button>
    </div>
  )
}
