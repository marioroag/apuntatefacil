import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Settings2, Tag as TagIcon, Trash2, X } from 'lucide-react'
import type { Tag } from '../lib/types'
import { useStore, normalizeTagName } from '../lib/store'
import { tagTone } from '../lib/format'
import { useToast } from './ui/Toast'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Checkbox } from './ui/Checkbox'
import { InfoTooltip } from './ui/Tooltip'
import { limitesVisibles } from '../lib/flotante'
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
const ALTO_LISTA = 244

// Microcopy (es-ES), en un solo sitio.
const COPY = {
  title: 'Etiquetas',
  add: 'Añadir etiqueta',
  create: (text: string) => `Crear «${text}»`,
  info: 'Las etiquetas son internas de tu empresa. Tú decides qué anotar y eres responsable de esa información.',
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
export function TagPicker({
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
  const { tags, applyTag, removeTag, createTag } = useStore()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [arriba, setArriba] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const applied = useMemo(
    () => tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t),
    [tagIds, tags],
  )

  const q = normalizeTagName(query).toLowerCase()
  const appliedIds = new Set(tagIds)
  const matches = useMemo(
    () => tags.filter((t) => !appliedIds.has(t.id) && (!q || t.name.toLowerCase().includes(q))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tags, tagIds, q],
  )
  // ¿Existe ya una etiqueta exactamente igual (ignorando mayúsculas)?
  const exactExists = q.length > 0 && tags.some((t) => t.name.toLowerCase() === q)
  const showCreate = canManage && q.length > 0 && q.length <= 40 && !exactExists

  type Opt = { kind: 'tag'; tag: Tag } | { kind: 'create' }
  const options: Opt[] = useMemo(
    () => [...matches.map((t) => ({ kind: 'tag' as const, tag: t })), ...(showCreate ? [{ kind: 'create' as const }] : [])],
    [matches, showCreate],
  )

  useEffect(() => setActive(0), [query, open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => wrapRef.current && !wrapRef.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  /**
   * Abre la lista decidiendo antes hacia dónde. El bloque de etiquetas vive
   * abajo del Resumen, dentro de un panel con scroll propio: abriendo siempre
   * hacia abajo, la lista se quedaba cortada por el borde del panel y no se
   * leía. Si no cabe debajo y sí encima, sube.
   */
  const abrir = () => {
    const caja = wrapRef.current?.getBoundingClientRect()
    if (caja) {
      const [techo, suelo] = limitesVisibles(wrapRef.current!)
      const debajo = suelo - caja.bottom
      setArriba(debajo < ALTO_LISTA && caja.top - techo > debajo)
    }
    setOpen(true)
  }

  const atLimit = applied.length >= TAG_LIMIT_PER_CANDIDATE

  const choose = async (opt: Opt) => {
    if (atLimit) {
      toast.show(`Una candidatura admite hasta ${TAG_LIMIT_PER_CANDIDATE} etiquetas.`)
      return
    }
    if (opt.kind === 'tag') {
      applyTag(candidateId, opt.tag.id)
    } else {
      const tag = await createTag(query)
      if (tag) applyTag(candidateId, tag.id)
    }
    setQuery('')
    setActive(0)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      abrir()
      setActive((a) => Math.min(a + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (options[active]) choose(options[active])
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        // Cierra la lista, no la ficha de detrás: el modal escucha en document
        // y sin esto un Escape para descartar el desplegable cerraría al
        // candidato entero.
        e.stopPropagation()
        setOpen(false)
      }
    } else if (e.key === 'Backspace' && query === '' && applied.length > 0) {
      // Borrar con la tecla la última etiqueta aplicada (patrón de combobox de chips).
      removeTag(candidateId, applied[applied.length - 1].id)
    }
  }

  const showDropdown = open && (options.length > 0 || canManage)

  const opciones = (
      <ul
        id={listId}
        role="listbox"
        className={`absolute inset-x-0 z-50 max-h-60 overflow-y-auto rounded-xl filo bg-white p-1 shadow-pop ${
          arriba ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}
      >
        {options.length === 0 && !showCreate && (
          <li className="px-2.5 py-2 text-[13px] text-slate-500">
            {tags.length === 0
              ? canManage
                ? 'Escribe para crear tu primera etiqueta.'
                : 'Tu empresa aún no tiene etiquetas.'
              : 'Ninguna etiqueta coincide.'}
          </li>
        )}
        {options.map((opt, i) => {
          const isActive = i === active
          if (opt.kind === 'create') {
            return (
              <li key="__create" role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(opt)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-indigo-700 ${
                    isActive ? 'bg-indigo-50' : 'hover:bg-indigo-50'
                  }`}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{COPY.create(normalizeTagName(query))}</span>
                </button>
              </li>
            )
          }
          return (
            <li key={opt.tag.id} role="option" aria-selected={isActive}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(opt)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 ${
                  isActive ? 'bg-slate-100' : 'hover:bg-slate-100'
                }`}
              >
                <TagIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden />
                <span className="truncate">{opt.tag.name}</span>
              </button>
            </li>
          )
        })}
        {canManage && (
          <li className="mt-1 border-t border-slate-100 pt-1">
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
          </li>
        )}
      </ul>
  )

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <TagIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            abrir()
          }}
          onFocus={abrir}
          onKeyDown={onKeyDown}
          placeholder={COPY.add}
          maxLength={40}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
        />
      </div>

      {showDropdown && opciones}

      {applied.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {applied.map((t) => (
            <TagChip key={t.id} id={t.id} name={t.name} vocabulario={tags} onRemove={() => removeTag(candidateId, t.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// Bloque "Etiquetas" de la ficha: título + info + combobox. canManage = owner/member.
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
  return (
    <div>
      {/* Misma versalita que "Contacto" e "Interés actual": son hermanas dentro
          del Resumen, y un título de 14px entre dos de 11px se lee como si
          abriera un apartado nuevo. */}
      <div className="mb-2 flex items-center gap-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{COPY.title}</h3>
        <InfoTooltip text={COPY.info} />
      </div>
      <TagPicker candidateId={candidateId} tagIds={tagIds} canManage={canManage} onOpenManage={onOpenManage} />
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
  triggerClass,
  placement = 'down',
  onDone,
}: {
  selectedIds: string[]
  canManage: boolean
  triggerClass?: string
  placement?: 'up' | 'down'
  onDone?: () => void
}) {
  const { tags, candidates, applyTagToMany, removeTagFromMany, createTag } = useStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
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
    if ((cuantos.get(tagId) ?? 0) === selectedIds.length) removeTagFromMany(selectedIds, tagId)
    else applyTagToMany(selectedIds, tagId)
    onDone?.()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={triggerClass ?? `${BTN_SECONDARY}`}
      >
        <TagIcon className="size-4" aria-hidden />
        {COPY.title}
      </button>
      {open && (
        <div className={`absolute left-0 z-50 w-60 overflow-hidden rounded-xl filo bg-white p-1.5 shadow-pop ${placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={canManage ? 'Buscar o crear...' : 'Buscar etiqueta...'}
            autoFocus
            maxLength={40}
            className="mb-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
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
        </div>
      )}
    </div>
  )
}
