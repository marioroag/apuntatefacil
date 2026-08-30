import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { createPortal } from 'react-dom'
import type { CollisionDetection, KeyboardCoordinateGetter } from '@dnd-kit/core'
import type { LucideIcon } from 'lucide-react'
import { MessageSquareText, MoreHorizontal, Paperclip, Star, StickyNote, Tag as TagIcon, UserMinus, UserPlus } from 'lucide-react'
import { MeridianAvatar, FitLabel } from './Meridian'
import { Checkbox } from './ui/Checkbox'
import { TagCell } from './Tags'
import { MaskedPhone } from './MaskedPhone'
import { candidateFit } from '../lib/meridian'
import { useDesvanecido } from '../lib/desvanecido'
import { colocarFlotante } from '../lib/flotante'
import { answerStr, candidateName, fechaCorta, formatPhone, fullDateTime } from '../lib/format'
import { STATUS_META, STATUS_ORDER } from '../lib/types'
import type { Campaign, Candidate, CandidateStatus, Tag } from '../lib/types'

/**
 * EL TABLERO DEL PUESTO: la misma lista, partida en columnas por ESTADO
 * (Mario, ago 2026, con una referencia de CRM delante).
 *
 * No es otra pantalla, es otra PRESENTACIÓN de la tabla: las mismas personas,
 * los mismos filtros y la misma ficha al pulsar. Lo que cambia es la pregunta
 * que contesta de un vistazo: la tabla compara CAMPOS bajando por una columna;
 * el tablero enseña EL PROCESO, cuánta gente hay en cada fase y a quién mover.
 *
 * Decisiones que no son de pintura:
 *
 *  - LAS COLUMNAS SON LOS CINCO ESTADOS, descartado incluido, y por eso en modo
 *    tablero no se pintan ni el conmutador Activos/Rechazados ni el filtro de
 *    Estado: el tablero ES la vista de estados, y un recorte por estado encima
 *    de columnas por estado es la misma pregunta contestada dos veces (el mismo
 *    argumento que ya coordina al conmutador con el filtro en la tabla).
 *
 *  - LA COLUMNA ES UNA SUPERFICIE QUE RECOGE SUS TARJETAS (Mario, con la
 *    referencia delante: "que queden recogidas en sus columnas en vez de
 *    columnas flotando"). Es `--color-kanban-columna`, hoy el MISMO blanco que
 *    sus tarjetas, con su `filo` y su cabecera DENTRO. Estuvo un peldaño por
 *    debajo (#fdfdfd) para despegarlas del carril; al quitarle la sombra a la
 *    tarjeta ese peldaño dejó de hacer nada (1,01:1) y sobraba como tercer tono.
 *    Quedan dos niveles limpios, el gris de la página y el blanco de la columna,
 *    y lo que dibuja cada tarjeta es su canto. Las cinco se estiran a la misma
 *    altura (lo hace la rejilla), así que el tablero se lee como cinco carriles
 *    y no como cinco pilas sueltas.
 *
 *  - Y POR ESO LA TARJETA NO LLEVA SOMBRA (Mario, ago 2026): está APOYADA en su
 *    columna, no flotando sobre ella, así que el filo ya hace la profundidad y
 *    la sombra solo la repetía, multiplicada por las veinte tarjetas de un
 *    carril. La conserva lo único que de verdad flota: el clon del arrastre.
 *
 *  - QUÉ SE VE EN LA TARJETA Y EN QUÉ ORDEN LO DECIDE EL MISMO ENGRANAJE QUE LA
 *    TABLA (Mario: "como con la tabla, debe poderse configurar"). Los campos
 *    disponibles son las columnas de la tabla menos las dos que aquí no son un
 *    campo: el candidato (es la tarjeta) y el estado (es la columna). Mismo
 *    registro, mismas casillas, mismo arrastre, y su propio cajón de guardado
 *    (`tablero`): apagar el teléfono en la tabla no lo apaga aquí.
 *
 *  - CADA DATO ES UNA LÍNEA CON EL ICONO DE SU TIPO, Y SE PINTA SIEMPRE (Mario:
 *    "siempre deben medir lo mismo las tarjetas"). El icono es el MISMO que
 *    lleva su cabecera en la tabla: identifica el dato antes de leerlo, como
 *    los hechos del anuncio público. Y la línea vacía no se esconde, dice "–":
 *    una tarjeta que cambia de filas según lo que traiga cada persona obliga a
 *    releerla entera (es la regla del apartado Documentos de la ficha), y con
 *    el hueco puesto todas las tarjetas de una misma configuración miden LO
 *    MISMO, que es lo que deja barrer una columna con la vista.
 *
 *  - ARRASTRAR UNA TARJETA A OTRA COLUMNA ES CAMBIARLA DE ESTADO, y es el único
 *    arrastre en DOS EJES de la app: mover en horizontal es el significado
 *    (cruzar de fase), así que este DndContext NO clava el eje. Está declarado
 *    como excepción en el guardián (`arrastre.test.ts`, `CONTEXTOS_2D`) con su
 *    motivo escrito. Dentro de una columna soltar no reordena: el orden lo pone
 *    el criterio de la lista (fecha, encaje...), no la mano.
 *
 *  - LA TARJETA VA EN `DragOverlay`, no transformada en el sitio: el tablero es
 *    una caja con scroll horizontal, y es la regla de la casa ("una lista
 *    metida en una caja con scroll propio o clava el eje, o usa overlay").
 *
 *  - CON TECLADO SE CRUZA DE COLUMNA EN UN SALTO (`coordenadasColumna`): el
 *    sensor de teclado de fábrica mueve 25px por pulsación, o sea diez flechas
 *    para cruzar una columna. Aquí Espacio levanta, las flechas laterales van a
 *    la columna vecina y Espacio suelta. Abrir la ficha sigue siendo el botón
 *    del nombre, como en la tabla.
 *
 *  - LAS COLUMNAS NO TIENEN SCROLL PROPIO (una superficie, un scroll): crecen y
 *    desplaza el `main`. El tablero solo se desplaza a lo ancho cuando las
 *    cinco no caben.
 */

/** Un campo de la tarjeta: la columna de la tabla, con su icono y su etiqueta.
 *  Llega del registro de la pantalla (`columnasDisponibles`), nunca se declara
 *  aquí: dos listas de la misma verdad se separan al primer retoque. */
export type CampoTarjeta = { key: string; label: string; icon?: LucideIcon }

/**
 * 336 y no lo que salga de encajar las cinco (Mario, ago 2026: "que se vea solo
 * un poco más de 3 en desktop, así atosiga menos"). Medido en la columna de
 * trabajo (`max-w-trabajo`, 1240 -> 1120 de carril): a 360 salían 3,01 columnas,
 * o sea tres justas y ni un dedo de la cuarta, que es lo que hace pensar que el
 * tablero se acaba ahí; a 336 salen **3,22**, las tres enteras y un asomo de la
 * siguiente. El resto se alcanza desplazando, y el desvanecido del lado por el
 * que continúa lo dice.
 */
const COLUMNA_MIN = 336

/** El check de "click de tarjeta": como `clickDeFila`, pero la raíz de la
 *  tarjeta ES un control (dnd-kit le pone `role="button"` para el teclado), así
 *  que aquí se ignoran solo los controles INTERIORES. */
function clickDeTarjeta(e: React.MouseEvent<HTMLElement>): boolean {
  const t = e.target as Element | null
  const control = t?.closest?.('a, button, input, label, [role="button"]')
  return !control || control === e.currentTarget
}

/** Con teclado, una flecha lateral salta a la columna VECINA (al centro de su
 *  caja), no 25px. Vertical no mueve: soltar en cualquier punto de la columna
 *  significa lo mismo. */
const coordenadasColumna: KeyboardCoordinateGetter = (event, { context }) => {
  const { droppableRects, collisionRect } = context
  if (!collisionRect) return
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return
  const columnas = [...droppableRects.values()].sort((a, b) => a.left - b.left)
  const x = collisionRect.left + collisionRect.width / 2
  const actual = columnas.findIndex((r) => x >= r.left && x <= r.right)
  const destino = columnas[actual + (event.code === 'ArrowRight' ? 1 : -1)]
  if (!destino) return
  return {
    x: destino.left + destino.width / 2 - collisionRect.width / 2,
    y: collisionRect.top,
  }
}

/** El cursor manda mientras lo hay; con teclado (sin cursor) decide el solape. */
const colision: CollisionDetection = (args) => {
  const bajoCursor = pointerWithin(args)
  return bajoCursor.length > 0 ? bajoCursor : rectIntersection(args)
}

/** Lo que necesita una tarjeta para pintarse, empaquetado: viaja igual a la
 *  columna, a la tarjeta y al clon del overlay. */
type Pinta = {
  campos: CampoTarjeta[]
  campaign: Campaign
  tags: Tag[]
  maskPhone: boolean
  setStatus: (id: string, status: CandidateStatus) => void
  setFavorito: (id: string, favorito: boolean) => void
  onOpenEnNota: (id: string) => void
  onOpenEnEtiqueta: (id: string) => void
}

export function KanbanPuesto({
  rows,
  campos,
  campaign,
  tags,
  comentarios,
  maskPhone,
  setFavorito,
  seleccion,
  onSeleccion,
  onOpen,
  onOpenEnNota,
  onOpenEnEtiqueta,
  setStatus,
}: {
  /** La lista ya filtrada y ordenada, con los CINCO estados dentro. */
  rows: Candidate[]
  /** Qué pinta la tarjeta y en qué orden: lo decide el engranaje. */
  campos: CampoTarjeta[]
  campaign: Campaign
  tags: Tag[]
  /** Notas del equipo por candidato (el `commentCounts` del store). */
  comentarios: Record<string, number>
  maskPhone: boolean
  setFavorito: (id: string, favorito: boolean) => void
  /** La selección de la pantalla: la MISMA que gobierna la barra flotante. */
  seleccion: Set<string>
  onSeleccion: (id: string) => void
  onOpen: (id: string) => void
  /** Abren la ficha con el cursor ya en el campo que se ha pedido. */
  onOpenEnNota: (id: string) => void
  onOpenEnEtiqueta: (id: string) => void
  setStatus: (id: string, status: CandidateStatus) => void
}) {
  const [arrastrada, setArrastrada] = useState<Candidate | null>(null)
  // El click de soltar llega DESPUÉS del dragEnd, y sin esto abriría la ficha
  // del candidato que acabas de mover.
  const ignorarClick = useRef(false)

  const sensors = useSensors(
    // Con distancia de activación, el click limpio sigue siendo un click (abre
    // la ficha) y solo el gesto de llevar se convierte en arrastre.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasColumna }),
  )

  const porEstado = new Map<CandidateStatus, Candidate[]>(STATUS_ORDER.map((s) => [s, []]))
  for (const c of rows) porEstado.get(c.status)?.push(c)

  // EL DESVANECIDO DEL LADO POR EL QUE CONTINÚA (Mario, ago 2026), con el mismo
  // mecanismo que la tira de pastillas de la ficha: una zona que se desplaza
  // dentro de otra que también se desplaza no tiene forma de anunciarse (la
  // barra o se esconde o mide un píxel), así que lo que hay más allá del filo
  // sencillamente no existe para quien mira. La `senal` es cuántas tarjetas hay:
  // un `ResizeObserver` sobre el carril no se entera de que sus hijos son otros.
  const carrilRef = useRef<HTMLDivElement>(null)
  const mascara = useDesvanecido(carrilRef, 'x', { senal: rows.length })

  const pinta: Pinta = { campos, campaign, tags, maskPhone, setStatus, setFavorito, onOpenEnNota, onOpenEnEtiqueta }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={colision}
      onDragStart={(e) => {
        setArrastrada(rows.find((c) => c.id === e.active.id) ?? null)
      }}
      onDragEnd={(e) => {
        setArrastrada(null)
        ignorarClick.current = true
        setTimeout(() => { ignorarClick.current = false }, 0)
        const destino = e.over?.id as CandidateStatus | undefined
        if (destino && arrastrada && destino !== arrastrada.status) setStatus(String(e.active.id), destino)
      }}
      onDragCancel={() => setArrastrada(null)}
    >
      {/* Solo a lo ancho, y solo cuando no caben: mismas riendas que la tira de
          chips (sin arrastrar la página al llegar al tope). */}
      <div
        ref={carrilRef}
        className="mt-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]"
        style={mascara ? { maskImage: mascara, WebkitMaskImage: mascara } : undefined}
      >
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${STATUS_ORDER.length}, minmax(${COLUMNA_MIN}px, 1fr))` }}
        >
          {STATUS_ORDER.map((estado) => (
            <Columna
              key={estado}
              estado={estado}
              candidatos={porEstado.get(estado) ?? []}
              pinta={pinta}
              comentarios={comentarios}
              seleccion={seleccion}
              onSeleccion={onSeleccion}
              onOpen={(id) => { if (!ignorarClick.current) onOpen(id) }}
            />
          ))}
        </div>
      </div>
      {/* El clon que viaja con el cursor. En overlay (portal a nivel de ventana)
          para que ni el scroll horizontal del tablero ni el del main lo recorten. */}
      <DragOverlay dropAnimation={null}>
        {arrastrada && (
          <div className="cursor-grabbing">
            <Tarjeta candidato={arrastrada} pinta={pinta} notas={comentarios[arrastrada.id] ?? 0} fantasma />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function Columna({
  estado,
  candidatos,
  pinta,
  comentarios,
  seleccion,
  onSeleccion,
  onOpen,
}: {
  estado: CandidateStatus
  candidatos: Candidate[]
  pinta: Pinta
  comentarios: Record<string, number>
  seleccion: Set<string>
  onSeleccion: (id: string) => void
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  const m = STATUS_META[estado]
  return (
    // LA SUPERFICIE DE LA COLUMNA: `#fdfdfd` (Mario, ago 2026), un punto por
    // encima del fondo de trabajo y un punto por debajo del blanco de sus
    // tarjetas. Los tres tonos casi se tocan a propósito: con esa diferencia el
    // relleno solo no cierra la columna, así que lleva `filo` (Mario, ago 2026),
    // que es la regla de siempre de la casa: **el hairline hace la profundidad y
    // el fondo solo la acompaña**. Un filo dentro de otro filo no es anidar
    // tarjetas: la columna es un carril, no una caja de contenido.
    // EL TINTE DE SOLTAR PINTA LA COLUMNA ENTERA, no solo la zona de tarjetas
    // (Mario, ago 2026). Con el tinte en la zona interior, el azul arrancaba por
    // debajo del rótulo y dentro del relleno: un rectángulo flotando DENTRO de la
    // columna, que decía "suelta en este hueco" en vez de "esta columna te
    // acepta". El droppable sube con él: la cabecera también es columna, y un
    // objetivo mayor solo puede acertarse más.
    <section
      ref={setNodeRef}
      aria-label={`${m.label}: ${candidatos.length} ${candidatos.length === 1 ? 'candidato' : 'candidatos'}`}
      className={`flex min-w-0 flex-col gap-2 rounded-xl filo p-2 transition-colors duration-[var(--duration-control)] ${
        isOver ? 'bg-indigo-50' : 'bg-[var(--color-kanban-columna)]'
      }`}
    >
      {/* La cabecera es la de siempre: punto + palabra (nunca solo color) y la
          cifra pelada, sin chapa, como los contadores del lateral. */}
      {/* El aire de debajo de la cabecera es el MISMO que el de encima (los 8 del
          relleno de la columna, con el `gap-2` de la sección): estaba en 0 y la
          primera tarjeta se leía pegada al rótulo, colgando de él en vez de
          abriendo la lista (Mario, ago 2026). Medido: 9 arriba contra 0 abajo. */}
      <header className="flex h-8 shrink-0 items-center gap-2 px-2">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${m.dot}`} />
        <h3 className="text-[13px] font-semibold text-slate-700">{m.label}</h3>
        <span aria-hidden className="num text-[13px] font-medium text-slate-500">{candidatos.length}</span>
      </header>
      {/* `flex-1` para que la lista llegue al pie de la columna: el droppable es
          la sección entera, y sin esto una columna vacía se quedaría sin cuerpo.
          El tinte de acento es el de selección: soltar es elegir. */}
      <div className="flex min-h-24 flex-1 flex-col gap-2">
        {candidatos.map((c) => (
          <TarjetaArrastrable
            key={c.id}
            candidato={c}
            pinta={pinta}
            notas={comentarios[c.id] ?? 0}
            seleccionado={seleccion.has(c.id)}
            onSeleccion={onSeleccion}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  )
}

function TarjetaArrastrable({
  candidato,
  pinta,
  notas,
  seleccionado,
  onSeleccion,
  onOpen,
}: {
  candidato: Candidate
  pinta: Pinta
  notas: number
  seleccionado: boolean
  onSeleccion: (id: string) => void
  onOpen: (id: string) => void
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: candidato.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // Mientras viaja el clon, la de origen se queda atenuada marcando el hueco
      // del que salió; moverla de verdad la mueve el estado al soltar.
      className={`group/carta cursor-grab touch-manipulation outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-600 ${isDragging ? 'opacity-40' : ''}`}
      onClick={(e) => clickDeTarjeta(e) && onOpen(candidato.id)}
      aria-roledescription="Tarjeta de candidato. Espacio la levanta; las flechas la llevan a otra columna"
    >
      <Tarjeta candidato={candidato} pinta={pinta} notas={notas} seleccionado={seleccionado} onSeleccion={onSeleccion} onOpen={onOpen} />
    </div>
  )
}

function Tarjeta({
  candidato: c,
  pinta,
  notas,
  seleccionado = false,
  onSeleccion,
  onOpen,
  fantasma = false,
}: {
  candidato: Candidate
  pinta: Pinta
  notas: number
  seleccionado?: boolean
  onSeleccion?: (id: string) => void
  onOpen?: (id: string) => void
  /** El clon del overlay: misma pintura, sin controles de verdad. */
  fantasma?: boolean
}) {
  const name = candidateName(c) || 'Sin nombre'
  const fit = candidateFit(c.ai)
  return (
    // SIN SOMBRA EN REPOSO (Mario, ago 2026). La tarjeta está APOYADA dentro de
    // su columna, que ya la contiene con su propio filo y su fondo un punto por
    // debajo del blanco: ahí la profundidad la hace el hairline y la sombra solo
    // repetía lo que el filo ya dice, con la columna entera llena de tarjetas
    // multiplicándola por veinte. Es la regla de la casa aplicada al pie de la
    // letra: la sombra la gana lo que FLOTA por encima de otra cosa, y aquí lo
    // único que flota es el clon del arrastre, que conserva su `shadow-pop`.
    <article className={`relative rounded-xl filo p-3.5 ${fantasma ? 'bg-white shadow-pop' : seleccionado ? 'bg-[var(--color-tabla-selec)]' : 'bg-white'}`}>
      {!fantasma && <AccionesTarjeta candidato={c} pinta={pinta} />}
      {/* La identidad: quién es y sus señales (favorito, notas), como la columna
          Candidato de la tabla. No es configurable por lo mismo que allí: sin
          ella la tarjeta es un montón de datos sin dueño. */}
      <div className="flex items-center gap-2.5">
        {/* LA CARA ES TAMBIÉN EL ASA DE SELECCIÓN (Mario, ago 2026): al pasar por
            encima de la tarjeta se convierte en la casilla, como la columna de la
            tabla, y marcada se queda casilla, o la selección sería invisible. La
            casilla corta la propagación del puntero y del teclado: marcar no es
            ni arrastrar ni levantar la tarjeta. En el clon del overlay no existe. */}
        {onSeleccion && !fantasma ? (
          <span className="relative size-7 shrink-0">
            <span className={seleccionado ? 'hidden' : 'group-hover/carta:hidden'}>
              <MeridianAvatar name={name} fit={fit} size={28} />
            </span>
            <label
              className={`absolute inset-0 place-items-center ${seleccionado ? 'grid' : 'hidden group-hover/carta:grid'}`}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={seleccionado}
                onChange={() => onSeleccion(c.id)}
                aria-label={`Seleccionar a ${name}`}
              />
            </label>
          </span>
        ) : (
          <MeridianAvatar name={name} fit={fit} size={28} />
        )}
        {fantasma ? (
          <span className="min-w-0 flex-1 truncate text-left text-[14px] font-medium text-slate-900">{name}</span>
        ) : (
          <button
            type="button"
            onClick={() => onOpen?.(c.id)}
            title={name}
            className="min-w-0 flex-1 truncate rounded-sm text-left text-[14px] font-medium text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            {name}
          </button>
        )}
        {notas > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-[12px] text-slate-500">
            <MessageSquareText className="size-3.5" aria-hidden />
            <span className="num" aria-label={`${notas} ${notas === 1 ? 'nota' : 'notas'}`}>{notas}</span>
          </span>
        )}
        {c.favorito && (
          <>
            <Star aria-hidden className="size-3.5 shrink-0 fill-amber-400 stroke-amber-500" />
            <span className="sr-only">Favorito</span>
          </>
        )}
      </div>
      {pinta.campos.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {pinta.campos.map((campo) => (
            <LineaCampo key={campo.key} campo={campo} candidato={c} pinta={pinta} />
          ))}
        </div>
      )}
    </article>
  )
}

/** El "no hay": la misma raya que la celda vacía de la tabla. La línea no se
 *  esconde, porque es lo que hace que todas las tarjetas midan lo mismo. */
const VACIO = <span className="text-slate-500">–</span>

/**
 * UNA LÍNEA DE LA TARJETA: el icono de su TIPO (el mismo de su cabecera en la
 * tabla) y el dato, sin rótulo, como los hechos del anuncio público y la
 * referencia de Mario. El icono identifica; la pregunta entera y el texto que
 * no cabe van en el `title` y en el `sr-only`.
 */
function LineaCampo({ campo, candidato: c, pinta }: { campo: CampoTarjeta; candidato: Candidate; pinta: Pinta }) {
  const Icono = campo.icon
  const contenido = (() => {
    if (campo.key === 'encaje') {
      const fit = candidateFit(c.ai)
      return fit == null ? VACIO : <FitLabel fit={fit} />
    }
    if (campo.key === 'etiquetas') {
      return c.tagIds.length === 0 ? VACIO : <TagCell tagIds={c.tagIds} tags={pinta.tags} />
    }
    if (campo.key === 'telefono') {
      const tel = answerStr(c, 'telefono')
      if (!tel) return VACIO
      return pinta.maskPhone
        ? <MaskedPhone value={formatPhone(tel)} />
        : <span className="num truncate">{formatPhone(tel)}</span>
    }
    if (campo.key === 'etapa') {
      // Desde cuándo está en su estado actual. El texto es solo la DURACIÓN,
      // como la referencia ("12d"): el icono y el `title` dicen de qué es.
      const desde = c.statusChangedAt
      const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86400000)
      const texto = dias <= 0 ? 'Hoy' : dias === 1 ? '1 día' : `${dias} días`
      return (
        <span className="num truncate" title={`En esta etapa desde el ${fechaCorta(desde)}`}>
          {texto}
        </span>
      )
    }
    if (campo.key === 'recibida') {
      return (
        <time dateTime={c.submittedAt} title={fullDateTime(c.submittedAt)} className="num truncate">
          {fechaCorta(c.submittedAt)}
        </time>
      )
    }
    // Una respuesta del formulario. El adjunto se dice como en la tabla (chip
    // "CV"); el resto, el texto pelado.
    const field = pinta.campaign.fields.find((f) => `campo:${f.id}` === campo.key)
    if (!field) return VACIO
    if (field.type === 'file') {
      return c.cvPath ? (
        <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-600">
          <Paperclip className="size-3 shrink-0 text-slate-500" aria-hidden /> CV
        </span>
      ) : VACIO
    }
    const texto = answerStr(c, field.id)
    if (!texto) return VACIO
    // El correo es un enlace, como su columna: es el único dato que se puede
    // USAR desde aquí, y si se ve es porque se ha pedido.
    if (field.type === 'email') {
      return (
        <a
          href={`mailto:${texto}`}
          title={`${field.label}: ${texto}`}
          className="block truncate rounded-sm text-indigo-600 hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          {texto}
        </a>
      )
    }
    const cifra = field.type === 'number' || field.type === 'date'
    return <span className={`block truncate ${cifra ? 'num' : ''}`} title={`${field.label}: ${texto}`}>{texto}</span>
  })()

  return (
    <div className="flex h-6 min-w-0 items-center gap-2 text-[13px] text-slate-700" title={campo.label}>
      {Icono && <Icono className="size-3.5 shrink-0 text-slate-500" aria-hidden />}
      <span className="sr-only">{campo.label}: </span>
      <div className="flex h-6 min-w-0 flex-1 items-center overflow-hidden">{contenido}</div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   LO QUE SE PUEDE HACER CON UNA TARJETA, al pasar por encima (Mario, ago 2026).
   ---------------------------------------------------------------------------
   Arriba a la derecha y solo en hover (o con el foco dentro, o con el menú
   abierto): en reposo la tarjeta es un DATO que se lee, y una fila de controles
   permanente en cada una convertiría la columna en una barra de herramientas
   repetida sesenta veces.

   DESCARTAR ES UN ESTADO, NO UNA ACCIÓN DESTRUCTIVA, y por eso va en tinta
   apagada y NUNCA en rojo: descartar es rutina y es reversible (el rojo de esta
   casa avisa de un error o de algo que no se deshace). En la columna Descartado
   el mismo botón hace lo contrario y devuelve a "nuevo", que es el único estado
   que no afirma nada sobre el trato que ya ha habido: es exactamente lo que hace
   la ficha, con las mismas palabras.

   EL `···` ES UN MENÚ DE DOS VERBOS Y LAS DOS FILAS SE COMPORTAN IGUAL: cierran
   el menú y abren la ficha con el cursor ya puesto donde se escribe (la etiqueta
   y la nota viven una debajo de otra en el raíl). Es lo que pide el vocabulario
   de la casa: un ítem de menú es un verbo y al pulsarlo el menú se cierra.

   ASÍ ESTUVO MAL PRIMERO, y la corrección es de Mario (ago 2026). "Añadir
   etiqueta" era el disparador del editor único (`BulkTagMenu`) metido DENTRO del
   menú, con una excepción declarada: no cerraba el menú "porque no ejecuta un
   verbo, abre un panel". En pantalla eso era el menú flotando ENCIMA del panel
   que acababa de abrir, tapándolo. Y cerrarlo no valía: el panel es hijo del
   menú, así que se habría desmontado con él. La salida no es un truco de
   visibilidad, es que las dos filas hagan lo mismo; para llegar al campo está
   `focoInicial` de `ui/Modal`, que ya existía para la nota.
--------------------------------------------------------------------------- */

/** Una fila del menú del `···`. Mismo vocabulario que el menú del puesto. */
const FILA_MENU =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-slate-700 outline-none transition-colors duration-[var(--duration-control)] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40'

function AccionesTarjeta({ candidato: c, pinta }: { candidato: Candidate; pinta: Pinta }) {
  const [menu, setMenu] = useState(false)
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const descartado = c.status === 'descartado'

  // Se monta invisible, se mide y solo entonces se coloca: el alto no se sabe
  // hasta que está en el DOM. Mismo patrón que el globo de `ui/Tooltip`.
  useLayoutEffect(() => {
    if (!menu) return setPos(null)
    const b = botonRef.current
    const p = panelRef.current
    if (!b || !p) return
    const r = p.getBoundingClientRect()
    setPos(colocarFlotante(b.getBoundingClientRect(), { width: r.width, height: r.height }, { width: window.innerWidth, height: window.innerHeight }, { alinear: 'derecha' }))
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node
      if (!botonRef.current?.contains(t) && !panelRef.current?.contains(t)) setMenu(false)
    }
    // En captura: `ui/Modal` escucha el mismo Escape en el mismo nodo y se
    // registra antes, así que en fase de burbuja cerraría la ficha en vez de
    // este menú. Es la misma lección que ya costó el selector de etiquetas.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setMenu(false)
      botonRef.current?.focus()
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape, true)
    }
  }, [menu])

  return (
    // `pointer-events-none` en la caja y el puntero de vuelta en los botones: la
    // banda cubre la esquina de la tarjeta y sin esto se tragaría el arrastre y
    // el click de abrir en esa zona incluso estando invisible.
    <div
      className={`pointer-events-none absolute right-2 top-2 flex items-center gap-0.5 rounded-lg bg-white/90 p-0.5 opacity-0 transition-opacity duration-[var(--duration-control)] focus-within:opacity-100 group-hover/carta:opacity-100 motion-reduce:transition-none ${menu ? 'opacity-100' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => pinta.setStatus(c.id, descartado ? 'nuevo' : 'descartado')}
        title={descartado ? 'Devolver a la lista' : 'Descartar'}
        aria-label={descartado ? `Devolver a ${candidateName(c) || 'este candidato'} a la lista` : `Descartar a ${candidateName(c) || 'este candidato'}`}
        className="pointer-events-auto grid size-7 place-items-center rounded-md text-slate-600 outline-none transition-colors duration-[var(--duration-control)] hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        {descartado ? <UserPlus className="size-4" aria-hidden /> : <UserMinus className="size-4" aria-hidden />}
      </button>
      <button
        ref={botonRef}
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menu}
        aria-label={`Más acciones para ${candidateName(c) || 'este candidato'}`}
        title="Más acciones"
        className="pointer-events-auto grid size-7 place-items-center rounded-md text-slate-600 outline-none transition-colors duration-[var(--duration-control)] hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {menu &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? undefined : 'hidden' }}
            className="z-[70] w-52 rounded-xl filo bg-white p-1 shadow-pop"
          >
            {/* FAVORITO ES UN INTERRUPTOR, así que la fila dice lo que va a
                pasar, no cómo está: "Añadir a" o "Quitar de". Va la primera
                porque es la más rápida de las tres (no abre nada) y la única que
                se puede deshacer con el mismo gesto. Y aquí es donde se QUITA:
                la estrella de la tarjeta solo se pinta cuando ya lo es, así que
                sin esta fila no habría forma de deshacerlo desde el tablero. */}
            <button
              type="button"
              role="menuitem"
              className={FILA_MENU}
              onClick={() => { setMenu(false); pinta.setFavorito(c.id, !c.favorito) }}
            >
              <Star aria-hidden className={`size-4 shrink-0 ${c.favorito ? 'fill-amber-400 stroke-amber-500' : 'text-slate-500'}`} />
              {c.favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            </button>
            <button type="button" role="menuitem" className={FILA_MENU} onClick={() => { setMenu(false); pinta.onOpenEnEtiqueta(c.id) }}>
              <TagIcon className="size-4 shrink-0 text-slate-500" aria-hidden /> Añadir etiqueta
            </button>
            <button type="button" role="menuitem" className={FILA_MENU} onClick={() => { setMenu(false); pinta.onOpenEnNota(c.id) }}>
              <StickyNote className="size-4 shrink-0 text-slate-500" aria-hidden /> Añadir nota
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
