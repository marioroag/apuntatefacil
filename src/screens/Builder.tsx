import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  CloudOff,
  GripVertical,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { brandAssetUrl } from '../lib/brandAsset'
import { useToast } from '../components/ui/Toast'
import { Checkbox } from '../components/ui/Checkbox'
import { ApplicationForm } from '../components/ApplicationForm'
import type { FieldValue } from '../components/FieldRenderer'
import { FIELD_TYPE_META } from '../lib/types'
import type { Brand, Campaign, FieldType, FormField } from '../lib/types'
import { SWATCHES, accentPassesWhite } from '../lib/colors'
import { FORM_WELCOME_DEFAULT, FORM_THANKS_DEFAULT } from '../lib/defaults'
import { useAuth } from '../lib/auth'
import { useAppBase } from '../lib/useAppBase'
import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/buttons'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { BrandAssets } from '../components/BrandAssets'
import { UpgradeDialog } from '../components/UpgradeDialog'
import { PLAN_BRAND_LIMIT } from '../lib/pricing'

const TYPE_ORDER: FieldType[] = ['text', 'textarea', 'phone', 'email', 'select', 'multiselect', 'boolean', 'number', 'date', 'file']

let fc = 0
function newField(type: FieldType): FormField {
  const base: FormField = {
    id: `f_${Date.now().toString(36)}_${fc++}`,
    type,
    label: defaultLabel(type),
    required: type === 'email',
  }
  if (type === 'select' || type === 'multiselect') base.options = ['Opción 1', 'Opción 2']
  return base
}
function defaultLabel(type: FieldType): string {
  return {
    text: 'Pregunta de texto',
    textarea: 'Cuéntanos más',
    phone: 'Teléfono',
    email: 'Email',
    select: '¿Qué opción te encaja?',
    multiselect: 'Marca lo que aplique',
    boolean: '¿Sí o no?',
    number: 'Indica un número',
    date: 'Elige una fecha',
    file: 'Adjunta tu CV',
  }[type]
}

// Detección de colisión basada en el CURSOR. closestCenter compara el centro de la tarjeta
// arrastrada con los campos, y durante el autoscroll ese centro queda desfasado del ratón, así
// que el destino caía una fila por encima del cursor. pointerWithin usa la posición real del
// cursor: el destino es el campo que está justo debajo del ratón. Si el cursor cae en el hueco
// entre dos campos (o en arrastre por teclado, sin cursor), recurrimos a closestCenter.
const cursorCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
}

export function Builder() {
  const { campaignId } = useParams()
  const { getCampaign, updateFields } = useStore()
  const toast = useToast()
  const base = useAppBase()
  const campaign = getCampaign(campaignId!)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null) // fila que se arrastra ahora (para el DragOverlay)
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [previewOpen, setPreviewOpen] = useState(false) // vista previa a pantalla completa (móvil)
  const [saveError, setSaveError] = useState(false) // el último autoguardado falló: el sello lo refleja y deja reintentar
  const [emailWarning, setEmailWarning] = useState<{ kind: 'optional' | 'remove'; fieldId: string } | null>(null)

  // Sensores por dispositivo: ratón arrastra al mover 5px (ágil); táctil exige mantener
  // pulsada el asa un instante antes de arrastrar (el delay distingue arrastre de scroll y
  // hace el reordenado fiable en móvil); teclado como alternativa accesible.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!campaign)
    return (
      <div className="grid h-full place-items-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <Briefcase className="size-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Puesto no encontrado</h1>
          <p className="mt-1.5 text-sm text-slate-500">Puede que se haya cerrado o que el enlace ya no sea válido.</p>
          <Link to={base} className={`${BTN_PRIMARY} mt-6`}>
            Ir a mis puestos
          </Link>
        </div>
      </div>
    )

  const fields = campaign.fields
  // Cada cambio se autoguarda; el resultado alimenta el sello (verde = guardado,
  // rojo = falló y se puede reintentar). NO revertimos en fallo: perderíamos lo
  // que el merchant acaba de escribir; mejor mantenerlo y avisar de que no se guardó.
  const setFields = (f: FormField[]) => {
    void updateFields(campaign.id, f).then((ok) => setSaveError(!ok))
  }
  const retrySave = () => {
    void updateFields(campaign.id, campaign.fields).then((ok) => setSaveError(!ok))
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (over && active.id !== over.id) {
      const oldI = fields.findIndex((f) => f.id === active.id)
      const newI = fields.findIndex((f) => f.id === over.id)
      setFields(arrayMove(fields, oldI, newI))
    }
  }

  const move = (id: string, dir: -1 | 1) => {
    const i = fields.findIndex((f) => f.id === id)
    const j = i + dir
    if (j < 0 || j >= fields.length) return
    setFields(arrayMove(fields, i, j))
  }

  // Campo que se arrastra ahora mismo, para pintarlo en el DragOverlay idéntico a su fila.
  const activeIndex = activeId ? fields.findIndex((f) => f.id === activeId) : -1
  const activeField = activeIndex >= 0 ? fields[activeIndex] : null
  const updateField = (id: string, patch: Partial<FormField>) =>
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const requestFieldUpdate = (field: FormField, patch: Partial<FormField>) => {
    if (field.type === 'email' && field.required && patch.required === false) {
      setEmailWarning({ kind: 'optional', fieldId: field.id })
      return
    }
    updateField(field.id, patch)
  }
  const removeField = (id: string) => {
    const idx = fields.findIndex((f) => f.id === id)
    if (idx === -1) return
    const removed = fields[idx]
    setFields(fields.filter((f) => f.id !== id))
    toast.success('Campo eliminado', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          const current = getCampaign(campaign.id)?.fields ?? []
          const next = [...current]
          next.splice(idx, 0, removed)
          void updateFields(campaign.id, next).then((ok) => setSaveError(!ok))
        },
      },
    })
  }
  const addField = (type: FieldType) => {
    const nf = newField(type)
    setFields([...fields, nf])
    setExpandedId(nf.id)
  }
  const requestRemoveField = (field: FormField) => {
    if (field.type === 'email') {
      setEmailWarning({ kind: 'remove', fieldId: field.id })
      return
    }
    removeField(field.id)
  }
  const confirmEmailChange = () => {
    if (!emailWarning) return
    if (emailWarning.kind === 'optional') updateField(emailWarning.fieldId, { required: false })
    else removeField(emailWarning.fieldId)
    setEmailWarning(null)
  }

  // Separar / unir el campo base de nombre. Al activar, renombra 'nombre' a
  // "Nombre" y añade un 'apellidos' justo detrás; al desactivar, quita
  // 'apellidos' y restaura "Nombre y apellidos".
  const hasApellidos = fields.some((f) => f.id === 'apellidos')
  const toggleNameSplit = (on: boolean) => {
    const idx = fields.findIndex((f) => f.id === 'nombre')
    if (idx === -1) return
    if (on) {
      if (hasApellidos) return
      const next = fields.map((f) =>
        f.id === 'nombre' ? { ...f, label: 'Nombre', placeholder: 'Tu nombre' } : f,
      )
      next.splice(idx + 1, 0, {
        id: 'apellidos',
        type: 'text',
        label: 'Apellidos',
        required: true,
        system: true,
        placeholder: 'Tus apellidos',
      })
      setFields(next)
    } else {
      setFields(
        fields
          .filter((f) => f.id !== 'apellidos')
          .map((f) => (f.id === 'nombre' ? { ...f, label: 'Nombre y apellidos', placeholder: 'Tu nombre completo' } : f)),
      )
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`${base}/puestos/${campaign.id}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Volver al puesto">
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">Formulario de {campaign.title}</h1>
            <p className="text-[13px] text-slate-500">Lo que ve quien abre tu enlace</p>
          </div>
        </div>
        {saveError ? (
          <button
            onClick={retrySave}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-semibold text-red-700 ring-1 ring-inset ring-red-200 transition hover:bg-red-100"
            title="Tus cambios no se guardaron. Toca para reintentar."
          >
            <CloudOff className="size-3.5" aria-hidden /> Sin guardar, reintentar
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700 ring-1 ring-inset ring-green-200" title="Tus cambios se guardan solos">
            <Check className="size-3.5" aria-hidden /> Autoguardado
          </span>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Panel de edición */}
        <div className="overflow-y-auto border-r border-slate-200 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-xl space-y-7">
            {/* Vista previa en vivo a pantalla completa donde la columna no cabe (móvil/tablet) */}
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className={`${BTN_SECONDARY} w-full lg:hidden`}
            >
              <Smartphone className="size-4 text-slate-500" aria-hidden /> Ver la vista previa del formulario
            </button>

            {/* Identidad (de la marca: se comparte entre sus puestos) */}
            <Identidad key={`marca-${campaign.id}`} campaign={campaign} />

            {/* Apariencia (datos del puesto: título, mensajes y aspecto) */}
            <Branding key={campaign.id} campaign={campaign} />

            {/* Campos */}
            <section>
              <SectionTitle>Campos del formulario</SectionTitle>
              {/* Al empezar a arrastrar cerramos el editor abierto: si no, el <li> sortable
                  incluye el cuerpo expandido y se arrastra un nodo muy alto y de altura
                  variable, lo que rompe el reordenado de dnd-kit (closestCenter) y se ve mal.
                  measuring.Always reasegura las medidas tras el colapso. */}
              <DndContext
                sensors={sensors}
                collisionDetection={cursorCollision}
                onDragStart={(e) => { setExpandedId(null); setActiveId(String(e.active.id)) }}
                onDragEnd={onDragEnd}
                onDragCancel={() => setActiveId(null)}
                measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                // layoutShiftCompensation:false evita que el DragOverlay derive (se escape hacia
                // arriba) durante el autoscroll. Por defecto dnd-kit compensa los cambios de layout
                // mientras autoscrollea, y esa compensación acumula un desfase en Safari (en Chrome
                // no se nota): la fila arrastrada se separa del cursor y el soltado cae descuadrado.
                autoScroll={{ layoutShiftCompensation: false }}
              >
                <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {fields.map((f, i) => (
                      <SortableFieldRow
                        key={f.id}
                        field={f}
                        index={i}
                        total={fields.length}
                        expanded={expandedId === f.id}
                        onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
                        onUpdate={(patch) => requestFieldUpdate(f, patch)}
                        onRemove={() => requestRemoveField(f)}
                        onMove={(dir) => move(f.id, dir)}
                        nameSplit={hasApellidos}
                        onToggleNameSplit={f.id === 'nombre' ? toggleNameSplit : undefined}
                      />
                    ))}
                  </ul>
                </SortableContext>
                {/* La fila arrastrada se pinta en un overlay (portal a nivel de viewport),
                    inmune al scroll del contenedor: no se separa del cursor al autoscrollear
                    y closestCenter (que usa el rect del elemento activo) calcula bien el destino. */}
                <DragOverlay>
                  {activeField ? (
                    <div className="overflow-hidden rounded-xl border border-indigo-300 bg-white shadow-pop">
                      <FieldRowHeader field={activeField} index={activeIndex} total={fields.length} expanded={false} overlay />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </section>

            {/* Paleta de tipos */}
            <section>
              <SectionTitle>Añadir campo</SectionTitle>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TYPE_ORDER.map((t) => {
                  const m = FIELD_TYPE_META[t]
                  return (
                    <button
                      key={t}
                      onClick={() => addField(t)}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
                    >
                      <Plus className="size-3.5 shrink-0 text-slate-500" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium">{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        </div>

        {/* Preview en vivo */}
        <div className="hidden overflow-y-auto bg-slate-100 lg:block">
          <div className="sticky top-0 z-10 flex items-center justify-center gap-1 border-b border-slate-200 bg-slate-100/80 py-2 backdrop-blur">
            <DeviceToggle device={device} setDevice={setDevice} />
          </div>
          <div className="flex justify-center px-6 py-8">
            <PreviewFrame device={device}>
              <Preview key={campaign.id} campaign={campaign} />
            </PreviewFrame>
          </div>
        </div>
      </div>

      {/* Vista previa en vivo a pantalla completa (móvil): sube desde abajo, refleja
          los cambios al instante y se cierra sin salir del constructor. */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-slate-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa del formulario"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">Vista previa</p>
                <p className="text-[12px] text-slate-500">Así lo verá el candidato</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="Cerrar vista previa"
                className="-mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6">
              <div className="mx-auto w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <Preview key={campaign.id} campaign={campaign} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={emailWarning !== null}
        onClose={() => setEmailWarning(null)}
        onConfirm={confirmEmailChange}
        title={emailWarning?.kind === 'remove' ? 'Este puesto dejará de pedir email' : 'El email dejará de ser obligatorio'}
        confirmLabel={emailWarning?.kind === 'remove' ? 'Eliminar email' : 'Hacer opcional'}
        cancelLabel={emailWarning?.kind === 'remove' ? 'Mantener campo' : 'Mantener obligatorio'}
        confirmVariant={emailWarning?.kind === 'remove' ? 'danger' : 'primary'}
      >
        {emailWarning?.kind === 'remove'
          ? 'No podrás comprobar el interés por email de los candidatos que entren a partir de ahora.'
          : 'Podrás seguir recibiendo candidaturas, pero no podrás comprobar el interés por email de quienes no lo rellenen.'}
      </ConfirmDialog>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">{children}</h2>
}

// Cabecera (colapsada) de una fila de campo: asa de arrastre, etiqueta/tipo y botones
// subir/bajar. La pintan la fila sortable real y el DragOverlay, así lo que arrastras es
// idéntico a la fila (WYSIWYG, una sola fuente). En el overlay va estático (`overlay`):
// sin handlers y sin foco, es solo el reflejo visual que sigue al cursor.
function FieldRowHeader({
  field,
  index,
  total,
  expanded,
  onToggle,
  onMove,
  handleProps,
  rowProps,
  overlay = false,
}: {
  field: FormField
  index: number
  total: number
  expanded: boolean
  onToggle?: () => void
  onMove?: (dir: -1 | 1) => void
  handleProps?: Record<string, unknown>
  rowProps?: Record<string, unknown>
  overlay?: boolean
}) {
  const meta = FIELD_TYPE_META[field.type]
  const noFocus = overlay ? { tabIndex: -1 } : undefined
  return (
    // rowProps lleva el activador TÁCTIL (onTouchStart) en TODA la fila: en móvil, mantener
    // pulsado cualquier campo lo agarra para reordenar. select-none evita el menú de selección
    // de iOS al mantener pulsado. No ponemos touch-action:none: el swipe sigue scrolleando y el
    // delay del TouchSensor distingue arrastre de scroll (dnd-kit corta el scroll al activar).
    <div {...(rowProps as React.HTMLAttributes<HTMLDivElement>)} className="flex select-none items-center gap-1.5 px-2 py-2">
      {/* Asa: arrastre con ratón y foco de teclado. El táctil del asa ya lo cubre la fila
          (rowProps), así que aquí no hace falta touch-none. */}
      <button
        {...(handleProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...noFocus}
        className={`rounded-lg p-1.5 hover:bg-slate-100 ${
          overlay ? 'cursor-grabbing text-slate-500' : 'cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing'
        }`}
        aria-label={`Reordenar ${field.label}, posición ${index + 1} de ${total}`}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <button onClick={onToggle} {...noFocus} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-50">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{field.label}</span>
        <span className="hidden shrink-0 text-[12px] text-slate-500 sm:inline">{meta.label}</span>
        {/* "Obligatorio" inline solo en sm+: en móvil ocupa demasiado y ya aparece
            en el editor desplegado. */}
        {field.required && <span className="hidden shrink-0 rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500 sm:inline">Obligatorio</span>}
        <ChevronDown className={`size-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      <div className="flex shrink-0 items-center">
        <button onClick={() => onMove?.(-1)} disabled={index === 0} {...noFocus} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Subir campo">
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button onClick={() => onMove?.(1)} disabled={index === total - 1} {...noFocus} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Bajar campo">
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

// --- Fila de campo (sortable) ----------------------------------------------
function SortableFieldRow({
  field,
  index,
  total,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  onMove,
  nameSplit,
  onToggleNameSplit,
}: {
  field: FormField
  index: number
  total: number
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<FormField>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  // Solo para el campo base 'nombre': estado y acción de "separar nombre y apellidos".
  nameSplit?: boolean
  onToggleNameSplit?: (on: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  // Separamos el activador táctil del resto: el asa lleva ratón (onMouseDown) + teclado
  // (onKeyDown); la fila entera lleva solo el táctil (onTouchStart), para poder agarrar
  // cualquier campo manteniendo pulsado en móvil sin hacerla arrastrable con ratón.
  const { onTouchStart, ...pointerKeyListeners } = listeners ?? {}

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-xl border bg-white ${isDragging ? 'border-indigo-300 opacity-50' : 'border-slate-200'}`}
    >
      <FieldRowHeader
        field={field}
        index={index}
        total={total}
        expanded={expanded}
        onToggle={onToggle}
        onMove={onMove}
        handleProps={{ ...attributes, ...pointerKeyListeners }}
        rowProps={{ onTouchStart }}
      />

      {expanded && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-3 py-3">
          <LabeledInput label="Etiqueta" value={field.label} onChange={(v) => onUpdate({ label: v })} />
          <LabeledInput
            label="Texto de ayuda (opcional)"
            value={field.helpText ?? ''}
            onChange={(v) => onUpdate({ helpText: v || undefined })}
            placeholder="Una pista para el candidato"
          />

          {(field.type === 'select' || field.type === 'multiselect') && (
            <OptionsEditor options={field.options ?? []} onChange={(options) => onUpdate({ options })} />
          )}

          <div className="flex items-center justify-between pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={field.required}
                onChange={(e) => onUpdate({ required: e.target.checked })}
              />
              Obligatorio
            </label>
            {field.system ? (
              <span className="text-[12px] text-slate-500">Campo base, no se puede borrar</span>
            ) : (
              <button onClick={onRemove} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="size-3.5" aria-hidden /> Eliminar campo
              </button>
            )}
          </div>

          {/* Solo en el campo base de nombre: dividir en nombre + apellidos. */}
          {field.id === 'nombre' && onToggleNameSplit && (
            <label className="flex cursor-pointer items-start gap-2 border-t border-slate-100 pt-3 text-sm text-slate-700">
              <Checkbox
                checked={!!nameSplit}
                onChange={(e) => onToggleNameSplit(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Pedir nombre y apellidos por separado
                <span className="mt-0.5 block text-[12px] text-slate-500">Crea dos campos obligatorios: Nombre y Apellidos.</span>
              </span>
            </label>
          )}
        </div>
      )}
    </li>
  )
}

function LabeledInput({ label, value, onChange, onBlur, placeholder }: { label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
      />
    </label>
  )
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  return (
    <div>
      <span className="mb-1 block text-[12px] font-medium text-slate-500">Opciones</span>
      <div className="space-y-1.5">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={o}
              onChange={(e) => onChange(options.map((x, j) => (j === i ? e.target.value : x)))}
              className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
            />
            <button
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              disabled={options.length <= 1}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
              aria-label={`Quitar opción ${o}`}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...options, `Opción ${options.length + 1}`])}
        className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <Plus className="size-3.5" aria-hidden /> Añadir opción
      </button>
    </div>
  )
}

// --- Identidad --------------------------------------------------------------
// Lo que ve el candidato en la cabecera del formulario: nombre, foto y banner.
// Vive en la MARCA, no en el puesto: se pone una vez y sale en todos sus
// formularios (el formulario público ya lo lee en vivo). Con una sola marca (el
// caso normal) nunca aparece la palabra "marca": editas tu identidad y ya. Tener
// VARIAS es lo que desbloquea Multi.
function Identidad({ campaign }: { campaign: Campaign }) {
  const { brands, createBrand, updateBrand, deleteBrand, updateCampaign, campaigns } = useStore()
  const { company } = useAuth()
  const demo = useAppBase() === '/demo'
  const toast = useToast()

  // Marca activa: la del puesto; si no tiene ninguna y la empresa solo tiene una,
  // esa (se le asigna en cuanto se toca algo).
  const active = (campaign.brandId ? brands.find((b) => b.id === campaign.brandId) : null) ?? (brands.length <= 1 ? brands[0] ?? null : null)
  // El nombre se escribe en local y se guarda al salir del campo. El borrador se
  // ata a la marca que se estaba editando: si llega otra (los datos acaban de
  // cargar, o se cambia de marca), manda la de la marca y no un texto huérfano.
  const [draft, setDraft] = useState<{ brandId: string | null; value: string } | null>(null)
  const name = draft && draft.brandId === (active?.id ?? null) ? draft.value : active?.name ?? ''
  const setName = (v: string) => setDraft({ brandId: active?.id ?? null, value: v })
  const [upgrade, setUpgrade] = useState(false)
  const [toDelete, setToDelete] = useState(false)
  // Una sola creación aunque lleguen dos ediciones seguidas (subir el logo y salir
  // del campo del nombre): la promesa se comparte.
  const ensuring = useRef<Promise<Brand | null> | null>(null)

  const limit = demo ? Infinity : PLAN_BRAND_LIMIT[company?.plan ?? 'trial'] ?? 1
  const compartida = active ? campaigns.filter((c) => c.brandId === active.id).length : 0

  // Con una sola marca no hay elección que hacer: es la identidad de la casa y le
  // toca a todos los puestos. Si este aún no la tiene (se creó antes, o se quedó
  // huérfano al borrar otra), se le asigna solo, para que la vista previa y el
  // formulario público enseñen lo mismo que este panel.
  const asignada = useRef<string | null>(null)
  useEffect(() => {
    const unica = brands.length === 1 ? brands[0] : null
    if (!unica || campaign.brandId || asignada.current === campaign.id) return
    asignada.current = campaign.id
    void updateCampaign(campaign.id, { brandId: unica.id })
    // updateCampaign viene del store y se recrea en cada render: fuera de las deps
    // a propósito (con el ref, esto corre una vez por puesto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, campaign.id, campaign.brandId])

  const ensureBrand = (): Promise<Brand | null> => {
    if (active) return Promise.resolve(active)
    if (!ensuring.current)
      ensuring.current = createBrand({
        name: company?.name ?? '',
        accent: campaign.branding.accent,
        welcome: '',
        thanks: '',
        showLogo: true,
        logoPath: null,
        bannerPath: null,
      }).then((b) => {
        if (b) void updateCampaign(campaign.id, { brandId: b.id })
        return b
      })
    return ensuring.current
  }

  const patch = async (p: Partial<Omit<Brand, 'id'>>) => {
    const brand = await ensureBrand()
    if (!brand) return
    if (campaign.brandId !== brand.id) void updateCampaign(campaign.id, { brandId: brand.id })
    void updateBrand(brand.id, p)
  }

  const crearMarca = async () => {
    if (brands.length >= limit) {
      setUpgrade(true)
      return
    }
    const b = await createBrand({ name: '', accent: campaign.branding.accent, welcome: '', thanks: '', showLogo: true, logoPath: null, bannerPath: null })
    if (!b) return
    void updateCampaign(campaign.id, { brandId: b.id })
    toast.success('Marca creada')
  }

  return (
    <section>
      <SectionTitle>Identidad</SectionTitle>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
        {/* Con varias marcas hay que elegir de cuál es este puesto antes de editarla. */}
        {brands.length > 1 && (
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-slate-500">Marca de este puesto</span>
            <select
              value={campaign.brandId ?? ''}
              onChange={(e) => void updateCampaign(campaign.id, { brandId: e.target.value || null })}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
            >
              <option value="">Sin marca, usa el nombre de la empresa</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || 'Marca sin nombre'}
                </option>
              ))}
            </select>
          </label>
        )}

        {brands.length > 1 && !active ? (
          <p className="text-[12px] leading-relaxed text-slate-500">
            Este formulario sale con el nombre de tu empresa, {company?.name}, y sin imágenes. Elige una marca arriba para darle otra cara.
          </p>
        ) : (
          <>
            <LabeledInput
              label="Nombre que ve el candidato"
              value={name}
              onChange={setName}
              onBlur={() => {
                const v = name.trim()
                if (v !== (active?.name ?? '')) void patch({ name: v })
              }}
              placeholder={company?.name ?? 'El nombre de tu empresa'}
            />
            <BrandAssets
              logoPath={active?.logoPath ?? null}
              bannerPath={active?.bannerPath ?? null}
              onChange={(p) => void patch(p)}
            />
            {compartida > 1 && (
              <p className="text-[12px] leading-relaxed text-slate-500">
                Esta marca la comparten {compartida} puestos: al cambiarla, cambian todos sus formularios.
              </p>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          <button
            type="button"
            onClick={crearMarca}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <Plus className="size-3.5" aria-hidden /> Añadir otra marca
          </button>
          {brands.length > 1 && active && (
            <button
              type="button"
              onClick={() => setToDelete(true)}
              className="text-[13px] font-medium text-slate-500 hover:text-red-600"
            >
              Eliminar esta marca
            </button>
          )}
        </div>
      </div>

      {upgrade && <UpgradeDialog open feature="multiBrand" onClose={() => setUpgrade(false)} />}
      <ConfirmDialog
        open={toDelete}
        onClose={() => setToDelete(false)}
        onConfirm={() => {
          if (active) void deleteBrand(active.id)
          setToDelete(false)
        }}
        title={active ? `¿Eliminar ${active.name || 'esta marca'}?` : ''}
        confirmLabel="Eliminar"
        confirmVariant="danger"
      >
        Sus puestos no se borran: pasan a salir con el nombre de tu empresa y sin estas imágenes.
      </ConfirmDialog>
    </section>
  )
}

// --- Branding ---------------------------------------------------------------
function Branding({ campaign }: { campaign: Campaign }) {
  const { updateBranding, updateCampaign } = useStore()
  const b = campaign.branding
  const passes = accentPassesWhite(b.accent)
  // Título único del puesto: se ve en el panel, la barra lateral y como cabecera
  // del formulario. Es obligatorio, así que guardamos en vivo pero nunca vacío.
  const [title, setTitle] = useState(campaign.title)
  const onTitleChange = (v: string) => {
    setTitle(v)
    const t = v.trim()
    if (t) void updateCampaign(campaign.id, { title: t })
  }
  const onTitleBlur = () => {
    if (!title.trim()) setTitle(campaign.title)
  }

  return (
    <section>
      <SectionTitle>Apariencia</SectionTitle>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
        {/* El título se ve en el panel, en la barra lateral y como cabecera del
            formulario. Editarlo aquí no cambia el enlace público.
            Placeholders del resto = texto por defecto si el campo se deja vacío. */}
        <LabeledInput label="Título del puesto" value={title} onChange={onTitleChange} onBlur={onTitleBlur} placeholder="Nombre del puesto" />
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-slate-500">Mensaje de bienvenida</span>
          <textarea
            value={b.welcome}
            onChange={(e) => updateBranding(campaign.id, { welcome: e.target.value })}
            rows={2}
            placeholder={FORM_WELCOME_DEFAULT}
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-slate-500">Mensaje de agradecimiento</span>
          <textarea
            value={b.thanks}
            onChange={(e) => updateBranding(campaign.id, { thanks: e.target.value })}
            rows={2}
            placeholder={FORM_THANKS_DEFAULT}
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[12px] font-medium text-slate-500">Color de acento</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateBranding(campaign.id, { accent: c })}
                aria-label={`Color ${c}`}
                aria-pressed={b.accent === c}
                className={`size-7 rounded-lg ring-2 ring-offset-2 transition-transform hover:scale-110 ${b.accent === c ? 'ring-slate-400' : 'ring-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            {/* Picker de color libre (selector nativo del sistema) */}
            <label
              className="relative ml-1 inline-flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-lg ring-1 ring-slate-300 transition-transform hover:scale-110"
              title="Elegir otro color"
            >
              <span
                aria-hidden
                className="absolute inset-0"
                style={{ background: 'conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)' }}
              />
              <Plus className="relative size-3.5 text-white drop-shadow" aria-hidden />
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(b.accent) ? b.accent : '#374cce'}
                onChange={(e) => updateBranding(campaign.id, { accent: e.target.value })}
                aria-label="Elegir un color personalizado"
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          {!passes && (
            <p className="mt-1.5 text-[12px] text-slate-500">
              Ajustamos el texto del botón a tinta oscura para que se lea bien sobre este color.
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-slate-700">
          <Checkbox
            checked={b.showLogo}
            onChange={(e) => updateBranding(campaign.id, { showLogo: e.target.checked })}
          />
          Mostrar nombre de la empresa arriba
        </label>
      </div>
    </section>
  )
}

// --- Preview ----------------------------------------------------------------
function DeviceToggle({ device, setDevice }: { device: 'mobile' | 'desktop'; setDevice: (d: 'mobile' | 'desktop') => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      {([['mobile', Smartphone], ['desktop', Monitor]] as const).map(([d, Icon]) => (
        <button
          key={d}
          onClick={() => setDevice(d)}
          aria-pressed={device === d}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-medium ${device === d ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Icon className="size-3.5" aria-hidden />
          {d === 'mobile' ? 'Móvil' : 'Escritorio'}
        </button>
      ))}
    </div>
  )
}

function PreviewFrame({ device, children }: { device: 'mobile' | 'desktop'; children: React.ReactNode }) {
  if (device === 'mobile') {
    return (
      <div className="w-[380px] overflow-hidden rounded-[2rem] border-[8px] border-slate-900 bg-white shadow-pop">
        <div className="max-h-[640px] overflow-y-auto p-5">{children}</div>
      </div>
    )
  }
  return <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-pop">{children}</div>
}

function Preview({ campaign }: { campaign: Campaign }) {
  const { company } = useAuth()
  const { brands } = useStore()
  const brand = campaign.brandId ? brands.find((b) => b.id === campaign.brandId) : null
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [consent, setConsent] = useState(false)
  return (
    <ApplicationForm
      campaign={campaign}
      values={values}
      errors={{}}
      onChange={(id, v) => setValues((p) => ({ ...p, [id]: v }))}
      companyName={brand?.name ?? company?.name ?? ''}
      logoUrl={brandAssetUrl(brand?.logoPath)}
      bannerUrl={brandAssetUrl(brand?.bannerPath)}
      consent={consent}
      onConsentChange={setConsent}
      preview
    />
  )
}
