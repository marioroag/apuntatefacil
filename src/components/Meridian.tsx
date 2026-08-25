import { useEffect, useRef, useState } from 'react'
import { Briefcase, Check, ChevronDown, ChevronRight, HelpCircle, Minus, Sparkles, X } from 'lucide-react'
import type { AiCriterion, Candidate } from '../lib/types'
import { initials, candidateName } from '../lib/format'
import { useStore } from '../lib/store'
import { BTN_SECONDARY } from '../lib/buttons'
import {
  CRITERIO_VALOR_LABEL, MERIDIAN_NAME, candidateFit, criterioNombre, fitTier,
} from '../lib/meridian'

// Avatar de iniciales del candidato ("PFP") con el ajuste de Meridian pintado como
// un anillo de progreso alrededor. DOCTRINA: el anillo es grafito neutro y comunica
// el valor por LONGITUD DE ARCO, nunca por color (el acento se reserva a acción; un
// score no lleva paleta de estados). Sin ajuste (candidato no analizado): sin anillo.
export function MeridianAvatar({ name, fit, size = 40 }: { name: string; fit?: number | null; size?: number }) {
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
// grafito neutro, nunca el acento. Va en `span`, no en `p`: en la ficha esta
// etiqueta vive DENTRO del botón que pliega el informe, y un párrafo dentro de
// un botón es marcado inválido (el botón solo admite contenido de frase).
function MeridianLabel() {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
      <Sparkles className="size-4 text-slate-500" aria-hidden />
      {MERIDIAN_NAME}
    </span>
  )
}

// Glifo del juicio de un criterio. Todo grafito: los juicios NO son estados y no
// comparten su paleta (ni verde de contratado ni rojo, que aquí no es un error
// del sistema). Se distinguen por FORMA, y la palabra de al lado siempre lo dice.
// Los dos extremos van medio paso más oscuros que lo intermedio: son lo que
// decide, y el ojo tiene que encontrarlos al bajar por la columna.
function CriterioGlifo({ valor }: { valor: AiCriterion['valor'] }) {
  const cls = `mt-[3px] size-3.5 shrink-0 ${valor === 'cumple' || valor === 'no_cumple' ? 'text-slate-600' : 'text-slate-400'}`
  if (valor === 'cumple') return <Check className={cls} aria-hidden />
  if (valor === 'parcial') return <Minus className={cls} aria-hidden />
  if (valor === 'no_cumple') return <X className={cls} aria-hidden />
  return <HelpCircle className={cls} aria-hidden />
}

// Los dos extremos llevan el peso (son lo que decide); lo intermedio y lo que no
// se sabe, tinta de apoyo. Énfasis por peso y oscuridad, nunca por color.
const VALOR_TONE: Record<AiCriterion['valor'], string> = {
  cumple: 'font-medium text-slate-800',
  parcial: 'text-slate-600',
  no_consta: 'text-slate-500',
  no_cumple: 'font-medium text-slate-800',
}

const NIVEL_RANGO: Record<string, number> = { clave: 0, importante: 1, deseable: 2 }

// Para citar un nombre de criterio a media frase: la mayúscula inicial se baja
// solo si no es una sigla ("Cobertura de turnos" -> "cobertura...", "PRL" queda).
function enFrase(nombre: string): string {
  if (nombre.length > 1 && nombre[1] !== nombre[1].toLowerCase()) return nombre
  return nombre.charAt(0).toLowerCase() + nombre.slice(1)
}

// El desglose del ajuste: un criterio del baremo por fila, los que más pesan
// primero, con el juicio en palabras a la derecha (lectura en columna). El
// nivel SOLO ordena: no se etiqueta ninguna fila (Mario vetó "imprescindible"
// por subjetivo; la importancia se dice con peso en el número y con el orden).
// La evidencia se ve EN la fila, en tinta de apoyo tras el nombre: es el hecho
// que sostiene el juicio y estaba escondida en un `title` (invisible en táctil,
// indescubrible en escritorio); enseñarla es lo que hace el informe de fiar.
// Las filas llevan el filo interior de la rejilla (slate-100): mismo vocabulario
// que la tabla, un informe medido y no una lista de bullets.
// Los análisis anteriores a la triada (ago 2026) traen las 5 claves genéricas
// sin nombre ni nivel: criterioNombre les pone el nombre y el orden se respeta.
function CriteriosList({ criterios, print }: { criterios: AiCriterion[]; print?: boolean }) {
  if (criterios.length === 0) return null
  const ordenados = [...criterios].sort(
    (a, b) => (NIVEL_RANGO[a.nivel ?? ''] ?? 1) - (NIVEL_RANGO[b.nivel ?? ''] ?? 1),
  )
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lo que pide el puesto</p>
      <ul className="mt-0.5 divide-y divide-slate-100">
        {ordenados.map((c, i) => {
          const nombre = criterioNombre(c)
          // Un hecho que solo repite el nombre del criterio no añade nada (el
          // evaluador a veces hace eco de la pregunta): no se pinta.
          const hecho =
            c.evidencia && c.evidencia.trim().toLowerCase() !== nombre.trim().toLowerCase()
              ? c.evidencia
              : undefined
          return (
            <li
              key={c.clave}
              className={`flex items-start gap-1.5 py-[7px] text-[13px] leading-5 ${print ? 'meridian-in' : ''}`}
              style={print ? { animationDelay: `${80 + i * 45}ms` } : undefined}
            >
              <CriterioGlifo valor={c.valor} />
              <p className="min-w-0 flex-1 text-slate-700">
                {nombre}
                {hecho && (
                  <span className="text-slate-500">
                    {/* El middot va pegado al hecho (nbsp): si la fila envuelve,
                        el separador abre la cita en vez de colgar a final de línea. */}
                    {' '}
                    <span aria-hidden>{'· '}</span>
                    <span className="sr-only">, se apoya en: </span>
                    {hecho}
                  </span>
                )}
              </p>
              <span className={`shrink-0 ${VALOR_TONE[c.valor]}`}>{CRITERIO_VALOR_LABEL[c.valor]}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ItemList({ label, items, marker }: { label: string; items: string[]; marker: 'check' | 'dot' }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <ul className="space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[13px] leading-5 text-slate-700">
            {marker === 'check' ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
            ) : (
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
            )}
            <span className="break-words">{t}</span>
          </li>
        ))}
      </ul>
    </div>
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

// Bloque de triaje de Meridian dentro del detalle del candidato (SlideOver).
export function MeridianPanelBlock({ candidate }: { candidate: Candidate }) {
  const { analyzeCandidate } = useStore()
  const [busy, setBusy] = useState(false)
  // La ficha del candidato que ACABA de analizarse imprime su informe fila a
  // fila (ver .meridian-in). Guardamos el id, no un booleano: al pasar con las
  // flechas a otro candidato ya analizado, su bloque entra quieto, porque el
  // producto carga en la tarea y la coreografía es solo del momento de analizar.
  const [recienId, setRecienId] = useState<string | null>(null)
  // El informe entra PLEGADO: de una ficha ya analizada se lee primero la frase,
  // que es el veredicto, y el desglose se pide. Guardamos el id del candidato
  // abierto (no un booleano) para que pasar al siguiente con las flechas vuelva
  // a plegar: cada persona se abre a propósito. Lo que acabas de analizar sí
  // entra abierto, porque acabas de pedirlo.
  const [abiertoId, setAbiertoId] = useState<string | null>(null)
  const ai = candidate.ai
  const failed = !!ai?.error

  const run = async () => {
    if (busy) return
    setBusy(true)
    const ok = await analyzeCandidate(candidate.id)
    setBusy(false)
    if (ok) {
      setRecienId(candidate.id)
      setAbiertoId(candidate.id)
    }
  }

  // Sin gating por plan: con el pago por proceso (ago 2026) Meridian está
  // incluido para todo el mundo, también en la prueba (el coste lo acota su
  // tope de candidaturas). El fail-closed de un plan desconocido lo aplica el
  // servidor, que responde sin analizar y aquí se traduce en el toast del store.

  // Analizado con éxito. El veredicto (etiqueta y anillo) vive en la CABECERA del
  // panel, así que aquí queda solo la lectura: sin repetir la etiqueta ni la barra.
  //
  // Y sin "Volver a analizar" a propósito: re-tirar un análisis correcto daba un
  // número distinto cada vez y eso destruía la confianza. Reintentar solo tiene
  // sentido cuando falló, que es la rama de abajo.
  if (ai && !failed) {
    const criterios = ai.criterios ?? []
    // Con la triada, cada juicio lleva su hecho citado y el desglose lo enseña
    // en la fila: "A favor" y "A confirmar" serían los MISMOS juicios contados
    // otra vez con otras palabras (se veía la misma cita dos veces en la misma
    // tarjeta). Solo se pintan en análisis viejos, que no traen evidencia.
    const conHechos = criterios.some((c) => !!c.evidencia)
    // "Falta por saber" = los criterios sin dato que sí pesan (los deseables no
    // reclaman una llamada). Es la conversión del no_consta en siguiente paso.
    const porSaber = criterios.filter((c) => c.valor === 'no_consta' && c.nivel !== 'deseable')
    const print = recienId === candidate.id
    const delayPie = 80 + criterios.length * 45
    const hayPie = porSaber.length > 0 || ai.cvUsed === false
    const hayListas = !conHechos && (ai.highlights.length > 0 || ai.concerns.length > 0)
    const hayDetalle = criterios.length > 0 || hayListas || hayPie
    const abierto = abiertoId === candidate.id
    const detalleId = `meridian-detalle-${candidate.id}`
    // La frase es el veredicto y se lee siempre; el desglose es la prueba y se
    // pide. Lo que se despliega cuelga del MISMO control (aria-controls), así
    // que quien no ve la pantalla oye "expandido / contraído" en vez de tener
    // que descubrir que ha aparecido algo más abajo.
    const cabecera = (
      <>
        <div className="flex items-center gap-2">
          <MeridianLabel />
          {hayDetalle && (
            <ChevronDown
              className={`ml-auto size-4 shrink-0 text-slate-400 transition-transform duration-[var(--duration-control)] group-hover:text-slate-600 ${abierto ? 'rotate-180' : ''}`}
              aria-hidden
            />
          )}
        </div>
        {ai.summary && <span className="mt-1.5 block text-sm leading-6 text-slate-800">{ai.summary}</span>}
      </>
    )
    return (
      <div className="rounded-xl filo p-3.5">
        {hayDetalle ? (
          <button
            type="button"
            onClick={() => setAbiertoId(abierto ? null : candidate.id)}
            aria-expanded={abierto}
            aria-controls={detalleId}
            className={`group block w-full rounded-lg text-left ${print ? 'meridian-in' : ''}`}
          >
            {cabecera}
            <span className="sr-only">{abierto ? 'Ocultar el desglose' : 'Ver el desglose del ajuste'}</span>
          </button>
        ) : (
          <div className={print ? 'meridian-in' : ''}>{cabecera}</div>
        )}
        {hayDetalle && (
          // El detalle NO se monta y desmonta: se pliega. Tiene que estar en el
          // DOM para que la altura tenga de dónde y adónde ir (ver .meridian-fold),
          // así que plegado va `inert`: fuera del tabulador y fuera del lector de
          // pantalla, que es lo que un desplegable cerrado significa.
          //
          // Al desplegar a mano el detalle entra de una pieza; el escalonado fila
          // a fila se reserva al momento de analizar, que es el único que se
          // celebra (si se repitiera en cada apertura dejaría de ser un momento
          // y se volvería una espera).
          <div id={detalleId} inert={!abierto} className={`meridian-fold ${abierto ? 'meridian-fold-open' : ''}`}>
            <div>
              {criterios.length > 0 && (
                <div className={`mt-3 border-t border-slate-100 pt-2.5 ${print ? 'meridian-in' : ''}`} style={print ? { animationDelay: '40ms' } : undefined}>
                  <CriteriosList criterios={criterios} print={print} />
                </div>
              )}
              {hayListas && (
                <div className="mt-3 space-y-3">
                  <ItemList label="A favor" items={ai.highlights} marker="check" />
                  <ItemList label="A confirmar" items={ai.concerns} marker="dot" />
                </div>
              )}
              {/* Sin línea de procedencia (modelo · fecha): cuándo se analizó ya está
                  en Historial. Aquí solo vive lo que sigue siendo AVISO o siguiente
                  paso: qué preguntar para decidir mejor, y que no había CV (eso
                  cambia cuánto te puedes fiar de la lectura). */}
              {hayPie && (
                <div
                  className={`mt-3 space-y-1 border-t border-slate-100 pt-2.5 ${print ? 'meridian-in' : ''}`}
                  style={print ? { animationDelay: `${delayPie}ms` } : undefined}
                >
                  {porSaber.length > 0 && (
                    <p className="text-[13px] leading-5 text-slate-600">
                      Para decidir mejor, pregúntale por:{' '}
                      {porSaber.map((c, i) => (
                        <span key={c.clave}>
                          {i > 0 && ', '}
                          <span className="font-medium text-slate-700">{enFrase(criterioNombre(c))}</span>
                        </span>
                      ))}
                      .
                    </p>
                  )}
                  {ai.cvUsed === false && <p className="text-[12px] leading-4 text-slate-500">Sin CV: lo he mirado solo por sus respuestas.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Análisis en curso: un skeleton con la FORMA del informe que viene (una
  // línea de lectura y dos filas de desglose), no un spinner en medio del
  // contenido. En prod la triada tarda unos segundos; aquí se ve qué se está
  // fabricando y dónde va a aparecer.
  if (busy) {
    return (
      <div className="rounded-xl filo p-3.5">
        <MeridianLabel />
        <p className="mt-1.5 text-[13px] leading-5 text-slate-500" role="status">
          Leyendo la candidatura y midiéndola contra lo que pide el puesto…
        </p>
        {/* La silueta es la del informe que viene, fila a fila (glifo, criterio y
            su hecho, juicio a la derecha): el resultado aterriza en su propio
            hueco en vez de empujar la ficha. Los anchos bajan de fila en fila
            porque así se leen las de verdad, no por decorar. */}
        <div className="mt-3 border-t border-slate-100 pt-2.5" aria-hidden>
          <div className="skeleton h-2 w-28 rounded-full" />
          <div className="mt-2 divide-y divide-slate-100">
            {[['w-3/5', 'w-14'], ['w-4/6', 'w-16'], ['w-1/2', 'w-12']].map(([texto, juicio], i) => (
              <div key={i} className="flex items-center gap-1.5 py-[9px]">
                <div className="skeleton size-3 shrink-0 rounded-full" />
                <div className={`skeleton h-2.5 rounded-full ${texto}`} />
                <div className={`skeleton ml-auto h-2.5 rounded-full ${juicio}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Sin analizar o con error: acción para (re)analizar.
  return (
    <div className="rounded-xl filo p-3.5">
      <MeridianLabel />
      <p className="mb-2.5 mt-1.5 text-[13px] leading-5 text-slate-500">
        {failed
          ? 'No he podido analizar esta candidatura. Inténtalo de nuevo.'
          : 'Aún no la he analizado. La reviso y te digo su ajuste al puesto.'}
      </p>
      <button type="button" onClick={run} className={BTN_SECONDARY}>
        <Sparkles className="size-3.5 text-slate-500" aria-hidden /> {failed ? 'Volver a analizar' : `Analizar con ${MERIDIAN_NAME}`}
      </button>
    </div>
  )
}
