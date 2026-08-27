import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Settings2, Tag as TagIcon, Trash2, X } from 'lucide-react'
import type { Tag } from '../lib/types'
import { useStore, normalizeTagName } from '../lib/store'
import { tagTone } from '../lib/format'
import { colocarFlotante } from '../lib/flotante'
import { useEsTactil } from '../lib/media'
import { useToast } from './ui/Toast'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Checkbox } from './ui/Checkbox'
import { BTN_PRIMARY_SM, BTN_SECONDARY } from '../lib/buttons'

// ---------------------------------------------------------------------------
// Etiquetas: clasificación libre del empresario. El candidato nunca las ve.
//
// **Tienen COLOR desde ago 2026, y eso invierte la regla anterior.** Antes era
// "siempre gris neutro, nunca los colores de estado, así se evita el arcoíris".
// Mario lo cambió con su diseño delante y el motivo es bueno: en gris, una columna
// de etiquetas obliga a LEER cada una para saber cómo está clasificada una
// persona; con color se reconocen de un vistazo y el nombre pasa a confirmar en
// vez de a informar. El arcoíris que aquella regla temía no aparece porque el tono
// no lo elige nadie: sale del id (`tagTone`), así que no hay dos empresas pintando
// lo mismo de distinto ni un usuario decorando su tablero.
//
// El color NO informa por sí solo: el nombre va siempre escrito al lado, así que
// quien no distingue tonos no pierde nada. Doctrina: ver CLAUDE.md.
// ---------------------------------------------------------------------------

export const TAG_LIMIT_PER_CANDIDATE = 25 // límite blando por candidato

// Alto que reserva el desplegable para decidir si abre hacia arriba: su tope
// (max-h-60 = 240px) más el hueco de 4px. Si cambia la clase, cambia esto.

// Microcopy (es-ES), en un solo sitio.
const COPY = {
  title: 'Etiquetas',
  add: 'Añadir etiqueta',
  create: (text: string) => `Crear «${text}»`,
  manage: 'Gestionar etiquetas',
  rename: 'Renombrar',
  remove: 'Eliminar',
  removeFromSel: 'Quitar etiqueta',
  addToSel: 'Añadir etiqueta',
}

/**
 * Chip de etiqueta (diseño de Figma, ago 2026): relleno teñido, texto del mismo
 * tono más oscuro, **rectángulo de 4px** y sin borde.
 *
 * El radio es la parte que hay que respetar aunque la doctrina general diga
 * "pills/chips 999px": es lo que separa una etiqueta de una pastilla de ESTADO,
 * que es redonda y lleva punto. Con los dos redondos y los dos teñidos, un ámbar
 * de "entrevista" y un ámbar de "Recontactar" se leerían igual en la misma fila.
 * Aquí la forma es la que carga con el significado, no el tono.
 *
 * Sin `ring`: el diseño es relleno limpio, y un hairline del mismo tono sobre un
 * relleno tan claro solo ensucia el filo. El tono lo pone `tagTone(id)`; sin id
 * (nunca debería pasar) cae al primero de la paleta en vez de romperse.
 */
export function TagChip({
  id,
  name,
  vocabulario,
  onRemove,
  glyph = false,
  size = 'sm',
  entera = false,
}: {
  /** Semilla del color. Es el id, no el nombre: renombrar no repinta. */
  id?: string
  name: string
  /**
   * Todas las etiquetas de la empresa. Va por prop y no por `useStore()` a
   * propósito: hay cientos de chips en la tabla del puesto y suscribir cada uno al
   * store lo repintaría todo con cada cambio, justo en la pantalla cuya doctrina
   * más cuida los repintados. Quien pinta chips ya tiene la lista a mano.
   */
  vocabulario?: readonly { id: string }[]
  onRemove?: () => void
  glyph?: boolean
  size?: 'xs' | 'sm'
  /**
   * No recortes el nombre ni dejes que el chip encoja. Es lo que pide una tira que
   * se desplaza (la celda de la tabla): ahí el sitio lo da el scroll, no el recorte.
   * En un contenedor que envuelve, el recorte sigue siendo lo correcto.
   */
  entera?: boolean
}) {
  const pad = size === 'xs' ? 'py-0.5 pl-1.5 pr-1.5 text-[11px]' : 'py-1 pl-2 pr-2 text-[12px]'
  const tono = tagTone(id ?? name, vocabulario)
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1 rounded-sm font-medium ${tono.bg} ${tono.text} ${
        entera ? 'shrink-0' : 'max-w-full'
      } ${onRemove ? (size === 'xs' ? 'pr-0.5' : 'pr-1') : ''} ${pad}`}
    >
      {glyph && <TagIcon className="size-3 shrink-0 opacity-70" aria-hidden />}
      {/* title: donde el chip sí se recorta (contenedores que envuelven), sin esto no
          había forma de leer la etiqueta entera sin abrir la ficha. */}
      <span className={entera ? 'whitespace-nowrap' : 'truncate'} title={name}>{name}</span>
      {onRemove && (
        // El aspa hereda la tinta del chip (`currentColor`) en vez de ir en gris:
        // un gris neutro dentro de un relleno de color se lee como suciedad.
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar etiqueta ${name}`}
          className="grid size-4 shrink-0 place-items-center rounded-full opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

/**
 * Celda de etiquetas de la tabla: TODAS, ENTERAS y en una sola línea que se
 * desplaza en horizontal (Mario, ago 2026).
 *
 * Antes enseñaba dos y escondía el resto tras un "+N" que abría un desplegable, y
 * además recortaba el nombre de las que sí enseñaba. Eso convertía la columna en un
 * acertijo: dos etiquetas a medias y un número no dicen cómo está clasificada una
 * persona, y para saberlo había que pulsar fila por fila. Una etiqueta o se lee
 * entera o no sirve, porque "Documentación OK" y "Documentación pendiente" empiezan
 * igual.
 *
 * Por qué scroll y no varias líneas: la fila de una rejilla tiene alto fijo (es lo
 * que deja bajar la vista por una columna); si las etiquetas la estiran, cada fila
 * mide una cosa distinta y se pierde la rejilla. El chip cortado por el filo de la
 * columna es la señal de que hay más, igual que en cualquier tira de chips.
 *
 * Sin barra de desplazamiento visible: en una tira de 20px de alto ocuparía casi
 * tanto como los chips, y en las 142 filas de un puesto sería una trama de rayas.
 * No hace falta `tabindex`: los navegadores hacen foco en un contenedor con scroll
 * que no tiene hijos enfocables, y el lector de pantalla lee todos los chips estén
 * o no a la vista (están en el DOM, no ocultos).
 */
export function TagCell({ tagIds, tags }: { tagIds: string[]; tags: Tag[] }) {
  const resolved = useMemo(
    () => tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t),
    [tagIds, tags],
  )
  if (resolved.length === 0) return null

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {resolved.map((t) => (
        <TagChip key={t.id} id={t.id} name={t.name} vocabulario={tags} size="xs" entera />
      ))}
    </div>
  )
}

// Combobox "Añadir etiqueta" + chips aplicados. Para la ficha del candidato.
// owner/member pueden crear vocabulario nuevo; el encargado solo aplica existentes.
//
// Una sola forma, la de la ficha: manda el campo, porque si estás aquí vas a
// etiquetar. Hubo una variante `inline` para la cabecera del detalle (chips
// primero y un "+ Etiqueta" discreto) y se retiró en ago 2026 al bajar las
// etiquetas al Resumen a todos los anchos.
/**
 * EL BLOQUE DE ETIQUETAS DE LA FICHA: LA MISMA LISTA QUE LA BARRA DE SELECCIÓN
 * (Mario, ago 2026: "este selector es mucho mejor que el viejo, vamos a
 * reemplazar al viejo con este en el resto de sitios").
 *
 * Había DOS editores de etiquetas en la app y no eran equivalentes: el de la
 * ficha era un combobox que solo sabía AÑADIR (para quitar había que salir a los
 * chips y buscar su equis) y solo enseñaba lo que aún no tenías, así que el
 * vocabulario completo no se veía nunca desde ahí. La lista con casillas hace
 * las dos cosas en el mismo sitio, enseña todo lo que hay y busca y crea con el
 * mismo campo. Con un solo candidato es la "selección de uno" que ya usaba la
 * celda de una fila: la casilla se marca o se desmarca, sin estados a medias.
 *
 * Lo que se conserva del viejo y no se puede perder: el tope blando por
 * candidato (ahora vive en `BulkTagMenu`) y la puerta a administrar el
 * vocabulario, que desde la ficha era la única que había.
 */
export function TagSection({
  candidateId,
  tagIds,
  canManage,
  onOpenManage,
}: {
  candidateId: string
  tagIds: string[]
  canManage: boolean
  onOpenManage: () => void
}) {
  const { tags, removeTag } = useStore()
  const aplicadas = useMemo(
    () => tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t),
    [tagIds, tags],
  )
  // Estable entre renders: es la prop de un menú que se remonta con cada cambio
  // de candidato, y un array nuevo por render lo recolocaría sin motivo.
  const seleccion = useMemo(() => [candidateId], [candidateId])

  return (
    <div>
      {/* La misma versalita que los demás apartados del raíl, y SIN el icono de
          ayuda que llevaba al lado (Mario, ago 2026). Decía que las etiquetas
          son internas de la empresa y que quien las escribe es responsable de
          lo que anote, que es verdad y no hace falta contarlo aquí: nadie lo
          duda al escribir una, y en una columna donde los otros dos rótulos no
          llevan nada, el único glifo de la columna se lee como si esta caja
          tuviera una advertencia. Si algún día hay que decirlo, su sitio es
          donde se ADMINISTRA el vocabulario, no en cada ficha. */}
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{COPY.title}</h3>
      {/* EL DISPARADOR ES EL CAMPO, y no solo lo parece (Mario, ago 2026). En
          esta columna tiene que verse como hermano del de añadir una nota, así
          que siempre se pintó como un campo; pero era un `<button>`, y al
          pulsarlo salía el panel con SU propio buscador encima: dos cajas de
          texto, y la que acababas de tocar no escribía. Con `campo` hay una
          sola, la que pulsas, y el panel se cuelga de ella con su mismo ancho. */}
      {/* FLOTANTE, obligatorio: este bloque vive en una columna con scroll (el
          raíl de la ficha, o la de Información en móvil), y un panel `absolute`
          ahí dentro lo recorta el propio scroll. Colocado contra la ventana se
          ve entero, y `colocarFlotante` decide solo si tiene que abrirse hacia
          arriba, que es lo que el selector viejo resolvía a mano con
          `limitesVisibles` porque este bloque cae de los últimos de la columna. */}
      <BulkTagMenu
        selectedIds={seleccion}
        canManage={canManage}
        onOpenManage={onOpenManage}
        flotante
        campo
        // Las mismas medidas de siempre (36 de alto, radio 8, texto de 13: en la
        // ficha los campos son controles pequeños). Lo que cambia respecto al
        // disparador-botón es la TINTA: lo que escribes va en tinta y el gris se
        // queda para el marcador de posición, que antes teñía la etiqueta entera
        // porque nunca llegaba a escribirse nada dentro.
        triggerClass="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-500 hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 pointer-coarse:text-base"
      >
        {COPY.add}
      </BulkTagMenu>
      {/* LOS CHIPS CONSERVAN SU EQUIS, y no es la segunda puerta que la doctrina
          prohíbe: la lista es para BUSCAR y para ver el vocabulario entero, y la
          equis es tocar directamente lo que tienes delante. Quitarla obligaría a
          abrir una lista para desmarcar algo que ya estás mirando. En la barra de
          selección no existe porque allí no hay un chip por persona. */}
      {aplicadas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {aplicadas.map((t) => (
            <TagChip
              key={t.id}
              id={t.id}
              name={t.name}
              vocabulario={tags}
              onRemove={() => removeTag(candidateId, t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Modal "Gestionar etiquetas" (owner/member): renombrar y eliminar el vocabulario.
export function ManageTagsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tags, tagUsage, renameTag, deleteTag, restoreTag, candidates } = useStore()
  const toast = useToast()
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState<Tag | null>(null)

  useEffect(() => {
    if (!open) return
    // Captura el Escape ANTES que capas de debajo (p. ej. el SlideOver de la ficha):
    // así cerrar el modal no cierra también la ficha. Cierra de dentro hacia fuera.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (confirm) setConfirm(null)
      else if (editId) setEditId(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey, true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prev
    }
  }, [open, onClose, editId, confirm])

  if (!open) return null

  const startEdit = (t: Tag) => {
    setEditId(t.id)
    setDraft(t.name)
  }
  const saveEdit = async () => {
    if (!editId) return
    const ok = await renameTag(editId, draft)
    if (ok) setEditId(null)
  }
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))

  const doDelete = (t: Tag) => {
    const affectedIds = candidates.filter((c) => c.tagIds.includes(t.id)).map((c) => c.id)
    setConfirm(null)
    deleteTag(t.id)
    toast.success('Etiqueta eliminada', {
      action: { label: 'Deshacer', onClick: () => restoreTag(t, affectedIds) },
    })
  }

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="managetags-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-pop">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="managetags-title" className="text-lg font-semibold text-slate-900">{COPY.manage}</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">El vocabulario es común a toda tu empresa.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {sorted.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-slate-500">
              Aún no tienes etiquetas. Créalas desde la ficha de un candidato.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {sorted.map((t) => {
                const usage = tagUsage(t.id)
                const editing = editId === t.id
                return (
                  <li key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    {editing ? (
                      <>
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit()
                            if (e.key === 'Escape') {
                              e.stopPropagation()
                              setEditId(null)
                            }
                          }}
                          autoFocus
                          maxLength={40}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
                        />
                        <button onClick={saveEdit} className={`${BTN_PRIMARY_SM} shrink-0`}>
                          Guardar
                        </button>
                        <button onClick={() => setEditId(null)} className="shrink-0 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <TagChip id={t.id} name={t.name} vocabulario={tags} glyph />
                        <span className="ml-auto shrink-0 text-[12px] num text-slate-500">
                          {usage} {usage === 1 ? 'candidato' : 'candidatos'}
                        </span>
                        <button
                          onClick={() => startEdit(t)}
                          aria-label={`${COPY.rename} ${t.name}`}
                          title={COPY.rename}
                          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </button>
                        <button
                          onClick={() => setConfirm(t)}
                          aria-label={`${COPY.remove} ${t.name}`}
                          title={COPY.remove}
                          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && doDelete(confirm)}
        title={`¿Eliminar «${confirm?.name}»?`}
        confirmLabel="Eliminar"
        confirmVariant="danger"
      >
        {confirm && (() => {
          const n = tagUsage(confirm.id)
          return n > 0 ? (
            <>Se quitará de <strong className="font-semibold text-slate-800">{n} {n === 1 ? 'candidato' : 'candidatos'}</strong>. Podrás deshacerlo justo después.</>
          ) : (
            <>No la usa ningún candidato. Podrás deshacerlo justo después.</>
          )
        })()}
      </ConfirmDialog>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   ETIQUETAR UNA SELECCIÓN: UN SOLO BOTÓN (Mario, ago 2026)
   ---------------------------------------------------------------------------
   Eran DOS, "Añadir etiqueta" y "Quitar etiqueta", cada uno con su desplegable.
   Y no era solo un botón de más en la barra: eran dos listas distintas de lo
   mismo (una con el vocabulario entero, otra solo con lo que la selección ya
   tenía), así que para saber cómo está etiquetada la gente que has marcado había
   que abrir el segundo, y para corregirte, cerrar uno y abrir el otro.

   Ahora es UN botón y una sola lista: el vocabulario entero con una casilla por
   etiqueta que dice cómo está la selección respecto a ella. Marcada, la tienen
   todos; en indeterminado, la tienen algunos; vacía, ninguno. Pulsarla lleva a
   todos al mismo sitio.

   DOS CONSECUENCIAS QUE NO SON DETALLES:

   1. **Deja de ser un menú de VERBOS y pasa a ser un editor de ESTADO**, así que
      al pulsar NO se cierra. Es el mismo desempate que separa el `···` del puesto
      (verbos, se cierra) de su menú de estado (eliges y te quedas). Antes había
      que reabrir el menú por cada etiqueta.
   2. **El estado se lee ANTES de tocar nada.** Es lo que la lista de "quitar" no
      podía dar: enseñaba lo que había, pero solo si ibas a quitarlo.

   Se declara con `Checkbox`, que es lo que la doctrina pide para elegir de una
   lista (el interruptor es para lo que está funcionando), y va dentro de un
   `<label>`: un `<input>` no puede vivir dentro de un `<button>`.
--------------------------------------------------------------------------- */
export function BulkTagMenu({
  selectedIds,
  canManage,
  onOpenManage,
  triggerClass,
  placement = 'down',
  flotante = false,
  campo = false,
  children,
  onDone,
}: {
  selectedIds: string[]
  canManage: boolean
  /** Abre el modal de administrar el vocabulario. Sin él, la fila no se pinta:
   *  en la barra de selección no hay dónde volver, y una puerta que no lleva a
   *  ningún sitio es peor que ninguna. */
  onOpenManage?: () => void
  triggerClass?: string
  placement?: 'up' | 'down'
  /**
   * Coloca el panel contra la VENTANA, en un portal, en vez de colgarlo del
   * disparador. Es obligatorio cuando vive dentro de la rejilla: allí lo
   * recortarían el desplazamiento horizontal de la tabla y el `overflow-clip` de
   * la tarjeta. En la barra flotante no hace falta, porque esa barra ya es fija.
   */
  flotante?: boolean
  /**
   * EL DISPARADOR ES EL CAMPO DE BUSCAR, no un botón que abre otro campo
   * (Mario, ago 2026: "debería usar el campo de texto que el usuario acaba de
   * clickear, no hacer aparecer otro").
   *
   * En la ficha, el disparador ya se PINTABA como un campo (para ser hermano del
   * de añadir una nota), pero era un `<button>`: al pulsarlo salía el panel con
   * SU propio buscador encima, así que había dos cajas de texto, una tapando a
   * la otra, y la que acababas de tocar no servía para escribir. Con esta
   * variante hay una sola: la que pulsas es la que filtra.
   *
   * Se lleva por delante el problema del teclado en táctil sin necesidad de
   * `useEsTactil`: el campo se enfoca porque el dedo lo ha tocado, no porque un
   * `autoFocus` se lo robe al abrirse un panel.
   *
   * Y el panel toma el ANCHO del campo en vez de su `w-60` fijo, porque aquí el
   * campo mide lo que mida la columna y un panel más estrecho se lee como una
   * pieza que no es de él.
   */
  campo?: boolean
  /** Contenido del disparador. Sin él, el icono y la palabra "Etiquetas". */
  children?: ReactNode
  onDone?: () => void
}) {
  const { tags, candidates, applyTagToMany, removeTagFromMany, createTag } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const esTactil = useEsTactil()
  const ref = useRef<HTMLDivElement>(null)
  // El ancla es el DISPARADOR (el botón, o el campo en la variante `campo`), no
  // el envoltorio: en modo flotante el envoltorio va en `display: contents` (para
  // que el botón sea el hijo directo de la barra segmentada y estire a lo alto),
  // y un elemento sin caja devuelve un rect a cero, o sea que el panel se
  // colocaría en la esquina de la pantalla.
  const botonRef = useRef<HTMLButtonElement>(null)
  const campoRef = useRef<HTMLInputElement>(null)
  const anclaRef = campo ? campoRef : botonRef
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // Ancho del campo, para que el panel mida lo mismo. Se mide en vez de heredarse
  // por CSS porque el panel vive en un PORTAL colgado del `body`: allí no hay
  // ningún antepasado del que sacar el ancho de la columna.
  const [anchoCampo, setAnchoCampo] = useState<number>()

  // Se coloca contra la ventana y se recoloca con los dos desplazamientos que lo
  // pueden dejar huérfano: el de la página y el de la propia tabla.
  useLayoutEffect(() => {
    if (!open || !flotante) return
    const colocar = () => {
      const ancla = anclaRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!ancla || !panel) return
      // El ancho se fija ANTES de decidir la posición: `colocarFlotante` aprieta
      // contra el filo usando el ancho del panel, así que midiéndolo después el
      // panel se colocaría con una medida que ya no es la suya.
      if (campo) setAnchoCampo(ancla.width)
      const { top, left } = colocarFlotante(
        ancla,
        { width: campo ? ancla.width : panel.width, height: panel.height },
        { width: window.innerWidth, height: window.innerHeight },
        { alinear: 'izquierda' },
      )
      setPos({ top, left })
    }
    colocar()
    window.addEventListener('resize', colocar)
    const main = document.getElementById('contenido')
    main?.addEventListener('scroll', colocar, { passive: true })
    const tabla = anclaRef.current?.closest('.overflow-x-auto')
    tabla?.addEventListener('scroll', colocar, { passive: true })
    return () => {
      window.removeEventListener('resize', colocar)
      main?.removeEventListener('scroll', colocar)
      tabla?.removeEventListener('scroll', colocar)
    }
  }, [open, flotante, campo, anclaRef])

  // Al cerrar se olvida lo buscado. Con el disparador hecho campo no es opcional:
  // el texto se quedaría escrito a la vista, donde debería poner "Añadir
  // etiqueta". Y de paso arregla que al reabrir el panel de un botón la lista
  // saliera ya filtrada por lo que escribiste la vez anterior.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const dentro = (t: Node | null) =>
      (ref.current?.contains(t as Node) ?? false) || (panelRef.current?.contains(t as Node) ?? false)
    const onDoc = (e: MouseEvent) => !dentro(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Corta la propagación: si no, cerraría además la ficha o el diálogo que
      // haya detrás, en vez de solo esta lista.
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    // EN CAPTURA, y no es un detalle: el `stopPropagation` de arriba llevaba
    // tiempo sin cumplir lo que promete su comentario. `ui/Modal` (la ficha)
    // escucha el mismo evento en el MISMO nodo (`document`) y en la misma fase,
    // y se registra ANTES, al montarse, mientras este se registra al abrirse la
    // lista. Dos listeners en el mismo nodo y la misma fase corren en ORDEN DE
    // REGISTRO, así que la ficha se cerraba entera antes de que esto pudiera
    // cortar nada: abrías la lista de etiquetas, pulsabas Escape y perdías el
    // candidato. En fase de captura, `document` es el primer nodo del recorrido,
    // así que esto corre antes que cualquier listener de burbuja y el corte llega
    // a tiempo. Es lo que ya hacían `ManageTagsModal` y el menú `···` de la ficha,
    // que son justamente los dos que sí funcionaban.
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  // Cuántos de los marcados tiene cada etiqueta. De aquí salen los tres estados
  // de la casilla, y se cuenta una sola vez para todo el vocabulario en vez de
  // recorrer la selección por fila.
  const cuantos = useMemo(() => {
    const marcados = new Set(selectedIds)
    const m = new Map<string, number>()
    for (const c of candidates) {
      if (!marcados.has(c.id)) continue
      for (const t of c.tagIds) m.set(t, (m.get(t) ?? 0) + 1)
    }
    return m
  }, [candidates, selectedIds])

  const q = normalizeTagName(query).toLowerCase()
  const list = useMemo(
    () =>
      tags
        .filter((t) => !q || t.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tags, q],
  )
  const exactExists = q.length > 0 && tags.some((t) => t.name.toLowerCase() === q)
  const showCreate = canManage && q.length > 0 && q.length <= 40 && !exactExists

  // La tienen TODOS -> se la quitamos a todos. Si no (ninguno o algunos), se la
  // ponemos a todos: desde "algunos", lo que se espera de una casilla a medias es
  // que al pulsarla se llene, no que se vacíe.
  const alternar = (tagId: string) => {
    if ((cuantos.get(tagId) ?? 0) === selectedIds.length) {
      removeTagFromMany(selectedIds, tagId)
      onDone?.()
      return
    }
    // El tope es BLANDO y se avisa solo cuando no se puede hacer nada: si de diez
    // marcados hay uno lleno, a los otros nueve se les pone igual, porque frenar
    // a los diez por culpa de uno sería castigar a la selección entera. El aviso
    // sale cuando NINGUNO puede recibirla, que es el único caso en el que pulsar
    // no hace nada y sin explicación parecería roto.
    const puede = candidates.some(
      (c) => selectedIds.includes(c.id) && !c.tagIds.includes(tagId) && c.tagIds.length < TAG_LIMIT_PER_CANDIDATE,
    )
    if (!puede) {
      toast.show(`Una candidatura admite hasta ${TAG_LIMIT_PER_CANDIDATE} etiquetas.`)
      return
    }
    applyTagToMany(selectedIds, tagId)
    onDone?.()
  }

  const lista = (
    <>
          {/* El buscador SOLO cuando el disparador es un botón. En la variante
              `campo` el disparador YA es este mismo campo, así que pintarlo aquí
              serían dos cajas de texto, una encima de la otra, y la que acabas de
              tocar no filtraría nada. */}
          {!campo && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={canManage ? 'Buscar o crear...' : 'Buscar etiqueta...'}
            // En táctil NO se enfoca solo: levantaría el teclado del sistema y
            // taparía la propia lista de etiquetas, que es lo que has venido a
            // mirar. Aquí importa más que en el menú de filtros, porque esta lista
            // se abre desde la celda de una fila, con el pulgar. El campo de
            // RENOMBRAR sí se enfoca, y no es una excepción caprichosa: allí has
            // pulsado "renombrar", o sea que vas a escribir seguro.
            autoFocus={!esTactil}
            maxLength={40}
            className="mb-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
          )}
          <ul className="max-h-52 overflow-y-auto">
            {list.length === 0 && !showCreate && (
              <li className="px-2.5 py-2 text-[13px] text-slate-500">
                {tags.length === 0 ? 'Todavía no tienes etiquetas.' : 'Ninguna etiqueta coincide.'}
              </li>
            )}
            {list.map((t) => {
              const n = cuantos.get(t.id) ?? 0
              const todos = n === selectedIds.length
              return (
                <li key={t.id}>
                  {/* Fila entera pulsable, y el nombre va como CHIP: es como se ve
                      esta etiqueta en la tabla y en la ficha, así que aquí se
                      reconoce por lo mismo, el color, en vez de leerse. */}
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-100">
                    <Checkbox
                      checked={todos}
                      indeterminate={!todos && n > 0}
                      onChange={() => alternar(t.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <TagChip id={t.id} name={t.name} vocabulario={tags} />
                    </span>
                  </label>
                </li>
              )
            })}
            {showCreate && (
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    const tag = await createTag(query)
                    if (!tag) return
                    applyTagToMany(selectedIds, tag.id)
                    setQuery('')
                    onDone?.()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{COPY.create(normalizeTagName(query))}</span>
                </button>
              </li>
            )}
          </ul>
          {canManage && onOpenManage && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onOpenManage()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                <Settings2 className="size-3.5 shrink-0" aria-hidden />
                {COPY.manage}
              </button>
            </div>
          )}
    </>
  )

  return (
    <div className={flotante && !campo ? 'contents' : 'relative'} ref={ref}>
      {campo ? (
        // El MISMO campo que pulsas es el que filtra. Se abre al enfocarlo (con
        // el dedo, con el ratón o con el tabulador) y también al escribir, que es
        // lo que hace falta cuando vuelves a él con el panel ya cerrado.
        <input
          ref={campoRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={typeof children === 'string' ? children : COPY.add}
          maxLength={40}
          aria-expanded={open}
          aria-label={COPY.add}
          className={triggerClass}
        />
      ) : (
      <button
        ref={botonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={triggerClass ?? `${BTN_SECONDARY}`}
      >
        {children ?? (
          <>
            <TagIcon className="size-4" aria-hidden />
            {COPY.title}
          </>
        )}
      </button>
      )}
      {open && (flotante
        ? createPortal(
          <div
            ref={panelRef}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? 'visible' : 'hidden',
              // En la variante `campo`, el panel mide lo que mida el campo. Va en
              // `style` y no en una clase porque el ancho es un DATO medido del
              // ancla, no una talla del sistema.
              ...(campo && anchoCampo ? { width: anchoCampo } : null),
            }}
            className={`fixed z-50 overflow-hidden rounded-xl filo bg-white p-1.5 shadow-pop ${campo ? '' : 'w-60'}`}
          >
            {lista}
          </div>,
          document.body,
        )
        : (
        <div ref={panelRef} className={`absolute left-0 z-50 w-60 overflow-hidden rounded-xl filo bg-white p-1.5 shadow-pop ${placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {lista}
        </div>
      ))}
    </div>
  )
}
