import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
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
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  GripVertical,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useToast } from '../components/ui/Toast'
import { ApplicationForm } from '../components/ApplicationForm'
import type { FieldValue } from '../components/FieldRenderer'
import { FIELD_TYPE_META } from '../lib/types'
import type { Campaign, FieldType, FormField } from '../lib/types'
import { SWATCHES, accentPassesWhite, isValidHex, normalizeHex } from '../lib/colors'
import { DOMAIN } from '../lib/brand'

const TYPE_ORDER: FieldType[] = ['text', 'textarea', 'phone', 'email', 'select', 'multiselect', 'boolean', 'number', 'date', 'file']

let fc = 0
function newField(type: FieldType): FormField {
  const base: FormField = {
    id: `f_${Date.now().toString(36)}_${fc++}`,
    type,
    label: defaultLabel(type),
    required: false,
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

export function Builder() {
  const { campaignId } = useParams()
  const { getCampaign, updateFields } = useStore()
  const toast = useToast()
  const campaign = getCampaign(campaignId!)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!campaign) return <div className="p-8 text-slate-500">Puesto no encontrado.</div>

  const fields = campaign.fields
  const setFields = (f: FormField[]) => updateFields(campaign.id, f)

  const onDragEnd = (e: DragEndEvent) => {
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
  const updateField = (id: string, patch: Partial<FormField>) =>
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
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
          updateFields(campaign.id, next)
        },
      },
    })
  }
  const addField = (type: FieldType) => {
    const nf = newField(type)
    setFields([...fields, nf])
    setExpandedId(nf.id)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/app/puestos/${campaign.id}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Volver al puesto">
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">Formulario · {campaign.title}</h1>
            <p className="text-[13px] text-slate-500">Lo que ve quien abre tu enlace</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700 ring-1 ring-inset ring-green-200" title="Tus cambios se guardan solos">
          <Check className="size-3.5" aria-hidden /> Autoguardado
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Panel de edición */}
        <div className="overflow-y-auto border-r border-slate-200 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-xl space-y-7">
            {/* Acceso a la vista previa en pantallas donde la columna no cabe */}
            <a
              href={`/a/${campaign.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <Smartphone className="size-4 text-slate-400" aria-hidden /> Ver la vista previa del formulario
            </a>

            {/* Campos */}
            <section>
              <SectionTitle>Campos del formulario</SectionTitle>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
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
                        onUpdate={(patch) => updateField(f.id, patch)}
                        onRemove={() => removeField(f.id)}
                        onMove={(dir) => move(f.id, dir)}
                      />
                    ))}
                  </ul>
                </SortableContext>
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
                      <Plus className="size-3.5 shrink-0 text-indigo-500" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium">{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Apariencia */}
            <Branding key={campaign.id} campaign={campaign} />

            {/* Compartir */}
            <ShareCard campaign={campaign} />
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
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-400">{children}</h2>
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
}: {
  field: FormField
  index: number
  total: number
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<FormField>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const meta = FIELD_TYPE_META[field.type]

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-xl border bg-white ${isDragging ? 'border-indigo-300 shadow-pop' : 'border-slate-200'}`}
    >
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
          aria-label={`Reordenar ${field.label}, posición ${index + 1} de ${total}`}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>

        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-50">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{field.label}</span>
          <span className="hidden shrink-0 text-[12px] text-slate-400 sm:inline">{meta.label}</span>
          {field.required && <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500">Obligatorio</span>}
          <ChevronDown className={`size-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
        </button>

        <div className="flex shrink-0 items-center">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Subir campo">
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Bajar campo">
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>
      </div>

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
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Obligatorio
            </label>
            {field.system ? (
              <span className="text-[12px] text-slate-400">Campo base, no se puede borrar</span>
            ) : (
              <button onClick={onRemove} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="size-3.5" aria-hidden /> Eliminar campo
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
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

// --- Branding ---------------------------------------------------------------
function Branding({ campaign }: { campaign: Campaign }) {
  const { updateBranding } = useStore()
  const b = campaign.branding
  const [hex, setHex] = useState(b.accent)
  const passes = accentPassesWhite(b.accent)

  const commitHex = (v: string) => {
    setHex(v)
    if (isValidHex(v)) updateBranding(campaign.id, { accent: normalizeHex(v) })
  }

  return (
    <section>
      <SectionTitle>Apariencia</SectionTitle>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
        <LabeledInput label="Título del formulario" value={b.headline} onChange={(v) => updateBranding(campaign.id, { headline: v })} />
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-slate-500">Mensaje de bienvenida</span>
          <textarea
            value={b.welcome}
            onChange={(e) => updateBranding(campaign.id, { welcome: e.target.value })}
            rows={2}
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-slate-500">Mensaje de agradecimiento</span>
          <textarea
            value={b.thanks}
            onChange={(e) => updateBranding(campaign.id, { thanks: e.target.value })}
            rows={2}
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
                onClick={() => {
                  setHex(c)
                  updateBranding(campaign.id, { accent: c })
                }}
                aria-label={`Color ${c}`}
                aria-pressed={b.accent === c}
                className={`size-7 rounded-lg ring-2 ring-offset-2 transition-transform hover:scale-110 ${b.accent === c ? 'ring-slate-400' : 'ring-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              value={hex}
              onChange={(e) => commitHex(e.target.value)}
              spellCheck={false}
              className="ml-1 h-8 w-24 rounded-lg border border-slate-300 px-2 font-mono text-[13px] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
            />
          </div>
          {!passes && (
            <p className="mt-1.5 text-[12px] text-slate-500">
              Ajustamos el texto del botón a tinta oscura para que se lea bien sobre este color.
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={b.showLogo}
            onChange={(e) => updateBranding(campaign.id, { showLogo: e.target.checked })}
            className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Mostrar nombre de la empresa arriba
        </label>
      </div>
    </section>
  )
}

// --- Compartir --------------------------------------------------------------
function ShareCard({ campaign }: { campaign: Campaign }) {
  const toast = useToast()
  const url = `${DOMAIN}/a/${campaign.slug}`
  const full = `https://${url}`
  const disabled = campaign.fields.length === 0

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full)
      toast.success('Enlace copiado')
    } catch {
      toast.show('Copia manualmente: ' + url)
    }
  }

  return (
    <section>
      <SectionTitle>Compartir</SectionTitle>
      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{url}</span>
          <button
            onClick={copy}
            disabled={disabled}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Copy className="size-3.5" aria-hidden /> Copiar
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <a href={`/a/${campaign.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700">
            <ExternalLink className="size-3.5" aria-hidden /> Abrir formulario
          </a>
        </div>
        <p className="mt-2.5 text-[12px] leading-relaxed text-slate-400">
          Comparte este enlace con quien responda a tu anuncio. Cualquiera con el enlace puede enviar una candidatura a este puesto.
        </p>
      </div>
    </section>
  )
}

// --- Preview ----------------------------------------------------------------
function DeviceToggle({ device, setDevice }: { device: 'mobile' | 'desktop'; setDevice: (d: 'mobile' | 'desktop') => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {([['mobile', Smartphone], ['desktop', Monitor]] as const).map(([d, Icon]) => (
        <button
          key={d}
          onClick={() => setDevice(d)}
          aria-pressed={device === d}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium ${device === d ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
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
  const { data } = useStore()
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  return (
    <ApplicationForm
      campaign={campaign}
      values={values}
      errors={{}}
      onChange={(id, v) => setValues((p) => ({ ...p, [id]: v }))}
      companyName={data.company.name}
      preview
    />
  )
}
