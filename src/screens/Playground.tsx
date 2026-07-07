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
import { Trash2, Plus, ArrowRight, Loader2 } from 'lucide-react'
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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
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
          <p className="text-sm text-slate-400">Vacío por ahora. (La fila de candidatos bloqueados se probó aquí y ya vive en Dashboard.tsx.)</p>
        </Section>

        <Section title="Botones" note="lib/buttons.ts. Radio 8px, relieve nítido, press = translate-y-px.">
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
              { c: 'bg-[#374cce]', l: 'acento', ring: false },
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

        <Section title="Sombras" note="una por elevación: shadow-card para tarjetas, shadow-pop para overlays.">
          <div className="flex flex-wrap gap-6">
            <div className="flex h-20 w-36 items-center justify-center rounded-xl bg-white text-xs text-slate-500 shadow-card">shadow-card</div>
            <div className="flex h-20 w-36 items-center justify-center rounded-xl bg-white text-xs text-slate-500 shadow-pop">shadow-pop</div>
          </div>
        </Section>

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
