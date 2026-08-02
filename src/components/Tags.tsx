import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Info, Pencil, Plus, Settings2, Tag as TagIcon, Trash2, X } from 'lucide-react'
import type { Tag } from '../lib/types'
import { useStore, normalizeTagName } from '../lib/store'
import { useToast } from './ui/Toast'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { BTN_PRIMARY_SM, BTN_SECONDARY } from '../lib/buttons'

// ---------------------------------------------------------------------------
// Etiquetas: clasificación libre del empresario. SIEMPRE en gris neutro (slate):
// nunca el índigo de marca ni los colores de estado. Eso evita el "arcoíris".
// El candidato nunca las ve. Doctrina: ver CLAUDE.md.
// ---------------------------------------------------------------------------

export const TAG_LIMIT_PER_CANDIDATE = 25 // límite blando por candidato

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

// Chip gris de etiqueta. Glifo opcional; "x" opcional para quitar.
export function TagChip({
  name,
  onRemove,
  glyph = false,
  size = 'sm',
}: {
  name: string
  onRemove?: () => void
  glyph?: boolean
  size?: 'xs' | 'sm'
}) {
  const pad = size === 'xs' ? 'py-0.5 pl-1.5 pr-1.5 text-[11px]' : 'py-1 pl-2 pr-2 text-[12px]'
  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-slate-100 font-medium text-slate-700 ring-1 ring-inset ring-slate-200 ${
        onRemove ? (size === 'xs' ? 'pr-0.5' : 'pr-1') : ''
      } ${pad}`}
    >
      {glyph && <TagIcon className="size-3 shrink-0 text-slate-500" aria-hidden />}
      {/* title: en la columna estrecha de la tabla el chip se corta, y sin esto no
          había forma de leer la etiqueta entera sin abrir la ficha. */}
      <span className="truncate" title={name}>{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar etiqueta ${name}`}
          className="grid size-4 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus-visible:bg-slate-200"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

// Celda de etiquetas para la tabla / Bandeja: bajo el nombre, máx 2 chips + "+N".
// `singleLine` impide que las etiquetas alteren la altura de una fila de escritorio.
export function TagCell({ tagIds, tags, singleLine = false }: { tagIds: string[]; tags: Tag[]; singleLine?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const resolved = useMemo(
    () => tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t),
    [tagIds, tags],
  )
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

  if (resolved.length === 0) return null
  const shown = resolved.slice(0, 2)
  const rest = resolved.slice(2)

  return (
    <div className={singleLine ? 'flex h-5 min-w-0 flex-nowrap items-center gap-1' : 'mt-1 flex flex-wrap items-center gap-1'}>
      {shown.map((t) => (
        <TagChip key={t.id} name={t.name} size="xs" />
      ))}
      {rest.length > 0 && (
        <div className={`relative ${singleLine ? 'shrink-0' : ''}`} ref={ref}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((o) => !o)
            }}
            aria-expanded={open}
            aria-label={`Ver ${rest.length} etiquetas más`}
            className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-200"
          >
            +{rest.length}
          </button>
          {open && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 z-50 mt-1 flex max-w-[240px] flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-pop"
            >
              {resolved.map((t) => (
                <TagChip key={t.id} name={t.name} size="xs" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Combobox "Añadir etiqueta" + chips aplicados. Para la ficha del candidato.
// owner/member pueden crear vocabulario nuevo; el encargado solo aplica existentes.
export function TagPicker({
  candidateId,
  tagIds,
  canManage,
  onOpenManage,
  inline = false,
}: {
  candidateId: string
  tagIds: string[]
  canManage: boolean
  onOpenManage: () => void
  /**
   * Variante para la cabecera del detalle: primero los chips, y el campo de
   * añadir sale de un "+ Etiqueta" discreto. En la ficha manda el campo (vas a
   * etiquetar); en la cabecera mandan las etiquetas que YA tiene, y un combobox
   * siempre abierto se comía el sitio de las acciones de contacto.
   */
  inline?: boolean
}) {
  const { tags, applyTag, removeTag, createTag } = useStore()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
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
      setOpen(true)
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
        className={`absolute left-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-pop ${
          // En línea el contenedor es una fila de chips de ancho variable: el
          // desplegable necesita ancho propio, no el del contenedor.
          inline ? 'w-64 max-w-[80vw]' : 'right-0'
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

  if (inline) {
    return (
      <div ref={wrapRef} className="relative flex flex-wrap items-center gap-1.5">
        {applied.map((t) => (
          <TagChip key={t.id} name={t.name} onRemove={() => removeTag(candidateId, t.id)} />
        ))}
        {open ? (
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={COPY.add}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                // Cierra el campo, no el modal de detrás.
                e.stopPropagation()
                setOpen(false)
                setQuery('')
                return
              }
              onKeyDown(e)
            }}
            placeholder={COPY.add}
            maxLength={40}
            className="h-7 w-36 rounded-full border border-slate-300 bg-white px-2.5 text-[13px] outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full px-2 py-0.5 text-[12px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-800"
          >
            + Etiqueta
          </button>
        )}
        {showDropdown && opciones}
      </div>
    )
  }

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
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
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
            <TagChip key={t.id} name={t.name} onRemove={() => removeTag(candidateId, t.id)} />
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
      <div className="mb-1.5 flex items-center gap-1.5">
        <p className="text-sm font-semibold text-slate-800">{COPY.title}</p>
        <InfoTooltip text={COPY.info} />
      </div>
      <TagPicker candidateId={candidateId} tagIds={tagIds} canManage={canManage} onOpenManage={onOpenManage} />
    </div>
  )
}

// Icono de info con tooltip accesible (hover + foco). No texto siempre visible.
function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={text}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="grid size-4 place-items-center rounded-full text-slate-500 hover:text-slate-600 focus-visible:text-slate-600"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {show && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-6 z-50 w-60 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[12px] leading-relaxed text-white shadow-pop"
        >
          {text}
        </span>
      )}
    </span>
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
                        <TagChip name={t.name} glyph />
                        <span className="ml-auto shrink-0 text-[12px] tabular-nums text-slate-500">
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

// Menú de acción masiva: aplica o quita una etiqueta a la selección. mode:
//  'add'    -> lista todo el vocabulario (+ crear, si canManage).
//  'remove' -> solo las etiquetas presentes en la selección.
export function BulkTagMenu({
  mode,
  selectedIds,
  canManage,
  triggerClass,
  placement = 'down',
  onDone,
}: {
  mode: 'add' | 'remove'
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

  // En 'remove' solo tienen sentido las etiquetas que alguna fila seleccionada tiene.
  const present = useMemo(() => {
    if (mode === 'add') return null
    const ids = new Set<string>()
    for (const c of candidates) if (selectedIds.includes(c.id)) c.tagIds.forEach((t) => ids.add(t))
    return ids
  }, [mode, candidates, selectedIds])

  const q = normalizeTagName(query).toLowerCase()
  const list = useMemo(
    () =>
      tags
        .filter((t) => (present ? present.has(t.id) : true))
        .filter((t) => !q || t.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tags, present, q],
  )
  const exactExists = q.length > 0 && tags.some((t) => t.name.toLowerCase() === q)
  const showCreate = mode === 'add' && canManage && q.length > 0 && q.length <= 40 && !exactExists

  const apply = (tagId: string) => {
    if (mode === 'add') applyTagToMany(selectedIds, tagId)
    else removeTagFromMany(selectedIds, tagId)
    setOpen(false)
    setQuery('')
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
        {mode === 'add' ? <Plus className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
        {mode === 'add' ? COPY.addToSel : COPY.removeFromSel}
      </button>
      {open && (
        <div className={`absolute left-0 z-50 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop ${placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'add' ? 'Buscar o crear...' : 'Buscar etiqueta...'}
            autoFocus
            maxLength={40}
            className="mb-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
          <ul className="max-h-52 overflow-y-auto">
            {list.length === 0 && !showCreate && (
              <li className="px-2.5 py-2 text-[13px] text-slate-500">
                {mode === 'remove' ? 'La selección no tiene etiquetas.' : 'Ninguna etiqueta coincide.'}
              </li>
            )}
            {list.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => apply(t.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  {mode === 'add' ? (
                    <TagIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden />
                  ) : (
                    <X className="size-3.5 shrink-0 text-slate-500" aria-hidden />
                  )}
                  <span className="truncate">{t.name}</span>
                </button>
              </li>
            ))}
            {showCreate && (
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    const tag = await createTag(query)
                    if (tag) apply(tag.id)
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
