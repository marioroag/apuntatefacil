// -----------------------------------------------------------------------------
// PLAYGROUND DE DISEÑO (solo desarrollo, no se compila en producción).
//
// Sitio para probar piezas visuales nuevas (un botón, un chip, una variante de
// campo...) usando los tokens y componentes REALES del proyecto, antes de
// cablearlas a una pantalla de verdad. Es lienzo, no producto: nada de aquí se
// enlaza desde la app ni se expone a un cliente.
//
// Cómo usarlo: entra a /dev/playground con `npm run dev`. Para probar una idea
// nueva, añade una <Section> al final del componente con el fragmento a probar.
// Si el experimento cuaja, muévelo a su sitio final y (si aplica) bórralo de aquí.
// -----------------------------------------------------------------------------
import { useState } from 'react'
import {
  Trash2, Plus, ArrowRight, Loader2,
  Bell, Briefcase, Clock, Download, MapPin, Phone, Search, Settings,
} from 'lucide-react'
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  BTN_PRIMARY_LG,
  BTN_SECONDARY_LG,
  BTN_PRIMARY_SM,
} from '../lib/buttons'
import { STATUS_META, FIELD_TYPE_META, type CandidateStatus, type FormField } from '../lib/types'
import { FieldRenderer, type FieldValue } from '../components/FieldRenderer'
import { SWATCHES } from '../lib/colors'

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl filo bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

// -----------------------------------------------------------------------------
// COMPARATIVA DE TRAZO DE ICONO (ago 2026).
//
// Los ~420 iconos de la app van al trazo por defecto de lucide (2) porque hasta
// ahora no había ni un sitio donde decidirlo. Ya lo hay: `--stroke-icon`, que la
// regla `.lucide` de index.css aplica a todos. Como el token se HEREDA, aquí basta
// con ponerlo en un contenedor para ver una columna entera con otro grosor, sin
// tocar ni un icono.
//
// Las filas son las de verdad y a los tamaños de verdad: el 71% del inventario
// está a size-4 (16px) y size-3.5 (14px), que es donde se decide la cuestión. Un
// icono suelto a 32px no dice nada del producto.
const TRAZOS = ['2', '1.75', '1.5'] as const

function FilasReales() {
  return (
    <div className="w-full min-w-0 space-y-3">
      {/* Menú lateral: icono 16px junto a texto de 14px */}
      <div className="rounded-lg bg-indigo-50 px-2.5 py-2">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
          <Briefcase className="size-4 shrink-0 text-indigo-600" aria-hidden />
          <span className="min-w-0 flex-1 truncate">Peón de albañil</span>
          <span className="num shrink-0 rounded-full bg-slate-200 px-1.5 py-px text-[11px] font-bold text-slate-700">96</span>
        </div>
      </div>
      {/* Fila de candidato: metadatos a 14px con iconos de 14px */}
      <div className="rounded-lg filo bg-white px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-900">Mohamed El Amrani</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
          <span className="inline-flex items-center gap-1"><Phone className="size-3.5 text-slate-400" aria-hidden /><span className="num">612 34 56 78</span></span>
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-slate-400" aria-hidden />Valencia</span>
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5 text-slate-400" aria-hidden />hace 2 días</span>
        </div>
      </div>
      {/* Barra superior: cluster de acciones a 16px */}
      <div className="flex items-center justify-end gap-1 rounded-lg filo bg-white px-2 py-1.5">
        {[Search, Bell, Settings].map((Ico, i) => (
          <span key={i} className="grid size-8 place-items-center rounded-lg text-slate-500"><Ico className="size-4" aria-hidden /></span>
        ))}
      </div>
      {/* Botones con icono */}
      <div className="flex flex-wrap gap-2">
        <button className={BTN_PRIMARY}><Plus className="size-4" aria-hidden />Crear puesto</button>
        <button className={BTN_SECONDARY}><Download className="size-4" aria-hidden />Exportar</button>
      </div>
    </div>
  )
}

function TrazoIconos() {
  return (
    <Section
      title="Grosor de trazo de los iconos"
      note="Mismas filas, mismo tamaño, tres grosores. El de la izquierda es el actual (el de fábrica de lucide). Se cambia en un sitio: --stroke-icon en index.css."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {TRAZOS.map((t) => (
          <div key={t} style={{ ['--stroke-icon' as string]: t }} className="min-w-0">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[var(--tracking-overline)] text-slate-500">
              Trazo {t.replace('.', ',')}
              {t === '2' && <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">· el de ahora</span>}
            </p>
            <FilasReales />
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-slate-400">
        Los checks sobre relleno sólido (casilla marcada) NO se ven afectados: llevan su grosor con
        `[stroke-width:3.5]`, que gana a la regla global a propósito.
      </p>
    </Section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-4 first:border-t-0 first:pt-0">
      <span className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

const SAMPLE_FIELDS: FormField[] = [
  { id: 'text', type: 'text', label: 'Nombre completo', placeholder: 'Ana García', required: true },
  { id: 'textarea', type: 'textarea', label: 'Experiencia previa', helpText: 'Cuenta brevemente en qué has trabajado antes', required: false },
  { id: 'phone', type: 'phone', label: 'Teléfono', required: true },
  { id: 'email', type: 'email', label: 'Email', required: true },
  { id: 'select', type: 'select', label: 'Disponibilidad', options: ['Inmediata', 'En 15 días', 'En 1 mes'], required: true },
  // Con más de 5 opciones, `select` deja de pintar botones y pasa a un <select>
  // nativo. Es una rama de render DISTINTA y hay que poder verla: aquí vivía sin
  // cubrir el bug del chevron, que estuvo meses sin flecha porque nadie la miró.
  { id: 'select-largo', type: 'select', label: 'Zona (más de 5 opciones)', options: ['Valencia ciudad', 'Torrent', 'Paterna', 'Sagunto', 'Manises', 'Aldaia'], required: false },
  { id: 'multiselect', type: 'multiselect', label: 'Turnos disponibles', options: ['Mañana', 'Tarde', 'Noche', 'Fin de semana'], required: false },
  { id: 'boolean', type: 'boolean', label: '¿Tienes carnet de conducir?', required: true },
  { id: 'number', type: 'number', label: 'Años de experiencia', required: false },
  { id: 'date', type: 'date', label: 'Fecha de nacimiento', required: false },
  { id: 'file', type: 'file', label: 'CV', helpText: 'PDF o Word, máx. 5 MB', required: false },
]

export function Playground() {
  const [values, setValues] = useState<Record<string, FieldValue>>({})

  return (
    <div className="min-h-svh bg-[#f9fafb] pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Solo desarrollo</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Playground de diseño</h1>
          <p className="mt-1 text-sm text-slate-500">
            Componentes y tokens reales del sistema. No se despliega ni se enlaza desde la app.
          </p>
        </div>
      </header>

      <main className="mx-auto mt-8 flex max-w-4xl flex-col gap-6 px-6">
        {/* -------------------------------------------------------------------
            Sandbox libre: pega aquí el fragmento que quieras enseñar a Mario
            (un botón nuevo, una variante de tarjeta...) y bórralo cuando ya
            no haga falta. No cuenta como parte del sistema hasta que se saque
            de aquí y se le dé un sitio de verdad. Arriba del todo para verlo
            sin tener que bajar por las secciones de referencia.
        ------------------------------------------------------------------- */}
        <Section title="Sandbox libre" note="Prototipo suelto. Bórralo o muévelo cuando termines.">
          <p className="text-sm text-slate-400">
            Vacío por ahora. (Aquí se compararon los tres tratamientos de botón de ago 2026; ganó
            el plano y vive ya en <code className="text-slate-500">lib/buttons.ts</code>.)
          </p>
        </Section>

        <Section title="Botones" note="lib/buttons.ts. Radio 8px, plano, press = oscurece.">
          <Row label="Primario">
            <button className={BTN_PRIMARY}>Guardar</button>
            <button className={BTN_PRIMARY} disabled>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Guardando
            </button>
            <button className={BTN_PRIMARY_SM}>Copiar enlace</button>
            <button className={BTN_PRIMARY_LG}>
              Empezar gratis <ArrowRight className="size-4" aria-hidden />
            </button>
          </Row>
          <Row label="Secundario">
            <button className={BTN_SECONDARY}>Cancelar</button>
            <button className={BTN_SECONDARY_LG}>Ver planes</button>
          </Row>
          <Row label="Peligro">
            <button className={BTN_DANGER}>
              <Trash2 className="size-4" aria-hidden /> Eliminar puesto
            </button>
          </Row>
          <Row label="Idea nueva">
            {/* Prototipa aquí una variante antes de darla de alta en buttons.ts */}
            <button className={BTN_SECONDARY}>
              <Plus className="size-4" aria-hidden /> Añadir campo
            </button>
          </Row>
        </Section>

        <Section title="Estados de candidato" note="lib/types.ts → STATUS_META. Punto + texto, nunca solo color.">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_META) as CandidateStatus[]).map((status) => {
              const meta = STATUS_META[status]
              return (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.chip}`}
                >
                  <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
                  {meta.label}
                </span>
              )
            })}
          </div>
        </Section>

        <Section title="Acento de marca" note="lib/colors.ts → SWATCHES. Acento configurable por cliente, con guarda AA.">
          <div className="flex flex-wrap gap-3">
            {SWATCHES.map((hex) => (
              <div key={hex} className="flex flex-col items-center gap-1.5">
                <div className="size-10 rounded-lg ring-1 ring-inset ring-black/10" style={{ backgroundColor: hex }} />
                <span className="num text-xs text-slate-500">{hex}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Neutros grafito" note="rampa slate reasignada en @theme. Texto con significado ≥ 4.5:1.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { c: 'bg-[#f9fafb]', l: 'fondo app', ring: true },
              { c: 'bg-white', l: 'superficie', ring: true },
              { c: 'bg-[#131822]', l: 'texto', ring: false },
              { c: 'bg-[#50545e]', l: 'texto secundario', ring: false },
              { c: 'bg-[#6f727c]', l: 'texto terciario', ring: false },
              { c: 'bg-[#e5e7eb]', l: 'borde', ring: true },
              { c: 'bg-indigo-600', l: 'acento', ring: false },
              { c: 'bg-[#DC2626]', l: 'error', ring: false },
            ].map((s) => (
              <div key={s.l} className="flex flex-col gap-1.5">
                <div className={`h-12 rounded-lg ${s.c} ${s.ring ? 'ring-1 ring-inset ring-black/10' : ''}`} />
                <span className="text-xs text-slate-500">{s.l}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Radios por rol" note="inputs/tarjetas/modales 10px · botones/controles 8px · pills 999px.">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex h-16 w-24 items-center justify-center rounded-xl border border-slate-300 text-xs text-slate-500">10px</div>
            <div className="flex h-9 w-24 items-center justify-center rounded-lg border border-slate-300 text-xs text-slate-500">8px</div>
            <div className="flex h-9 w-24 items-center justify-center rounded-full border border-slate-300 text-xs text-slate-500">999px</div>
          </div>
        </Section>

        <Section title="Sombras" note="el vocabulario cerrado de elevación. Una por nivel, nunca apiladas.">
          <div className="flex flex-wrap gap-6">
            {(['control', 'raised', 'pressed', 'card', 'pop', 'sticky'] as const).map((s) => (
              <div key={s} className={`flex h-20 w-32 items-center justify-center rounded-xl bg-white text-xs text-slate-500 shadow-${s}`}>
                shadow-{s}
              </div>
            ))}
          </div>
        </Section>

        <TrazoIconos />

        <Section title="Campos de formulario" note="components/FieldRenderer.tsx. El mismo componente pinta el builder y el formulario público.">
          <div className="flex flex-col gap-5">
            {SAMPLE_FIELDS.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
                idPrefix="pg"
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            {Object.keys(FIELD_TYPE_META).length} tipos de campo disponibles en el constructor.
          </p>
        </Section>
      </main>
    </div>
  )
}
