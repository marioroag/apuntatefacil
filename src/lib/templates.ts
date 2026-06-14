import type { FormField } from './types'
import type { NewCampaignInput } from './store'
import { defaultBranding } from './defaults'

export interface SectorTemplate {
  key: string
  label: string
  /** Nombre del icono de lucide-react (se resuelve en el wizard). */
  icon: string
  title: string
  sector: string
  fields: FormField[]
}

// Helper: required = false por defecto.
const f = (field: Omit<FormField, 'required'> & { required?: boolean }): FormField => ({
  required: false,
  ...field,
})

const SYS: FormField[] = [
  f({ id: 'nombre', type: 'text', label: 'Nombre y apellidos', required: true, system: true, placeholder: 'Tu nombre completo' }),
  f({ id: 'telefono', type: 'phone', label: 'Teléfono', required: true, system: true, placeholder: '600 000 000' }),
]

export const TEMPLATES: SectorTemplate[] = [
  {
    key: 'hosteleria',
    label: 'Hostelería',
    icon: 'UtensilsCrossed',
    title: 'Camarero/a',
    sector: 'Hostelería',
    fields: [
      ...SYS,
      f({ id: 'exp_sala', type: 'select', label: 'Experiencia en sala', required: true, options: ['Ninguna', 'Menos de 1 año', 'Entre 1 y 3 años', 'Más de 3 años'] }),
      f({ id: 'idiomas', type: 'multiselect', label: 'Idiomas que hablas', options: ['Español', 'Inglés', 'Francés', 'Alemán'] }),
      f({ id: 'noches', type: 'boolean', label: '¿Disponible para turnos de noche?', required: true }),
    ],
  },
  {
    key: 'construccion',
    label: 'Construcción',
    icon: 'HardHat',
    title: 'Peón de albañil',
    sector: 'Construcción',
    fields: [
      ...SYS,
      f({ id: 'exp', type: 'number', label: 'Años de experiencia en obra', required: true, placeholder: '0' }),
      f({ id: 'carnet', type: 'boolean', label: '¿Tienes carnet de conducir B?', required: true }),
      f({ id: 'vehiculo', type: 'boolean', label: '¿Vehículo propio?' }),
      f({ id: 'disp', type: 'select', label: 'Disponibilidad para incorporarte', required: true, options: ['Inmediata', 'En 15 días', 'En 1 mes'] }),
    ],
  },
  {
    key: 'logistica',
    label: 'Logística',
    icon: 'Truck',
    title: 'Mozo/a de almacén',
    sector: 'Logística',
    fields: [
      ...SYS,
      f({ id: 'carretillero', type: 'boolean', label: '¿Tienes carnet de carretillero?', required: true }),
      f({ id: 'turnos', type: 'multiselect', label: '¿Qué turnos puedes cubrir?', required: true, options: ['Mañana', 'Tarde', 'Noche'] }),
      f({ id: 'vehiculo', type: 'boolean', label: '¿Vehículo propio?', required: true }),
      f({ id: 'exp', type: 'number', label: 'Años en almacén o logística' }),
    ],
  },
  {
    key: 'limpieza',
    label: 'Limpieza',
    icon: 'Sparkles',
    title: 'Limpiador/a',
    sector: 'Limpieza',
    fields: [
      ...SYS,
      f({ id: 'exp', type: 'boolean', label: '¿Experiencia previa en limpieza?', required: true }),
      f({ id: 'horario', type: 'select', label: 'Disponibilidad horaria', required: true, options: ['Solo mañanas', 'Solo tardes', 'Mañanas y tardes'] }),
      f({ id: 'zona', type: 'text', label: '¿En qué barrio o zona vives?' }),
    ],
  },
  {
    key: 'comercio',
    label: 'Comercio',
    icon: 'ShoppingBag',
    title: 'Dependiente/a',
    sector: 'Comercio',
    fields: [
      ...SYS,
      f({ id: 'exp_venta', type: 'select', label: 'Experiencia en venta o cara al público', required: true, options: ['Ninguna', 'Menos de 1 año', 'Más de 1 año'] }),
      f({ id: 'finde', type: 'boolean', label: '¿Disponible los fines de semana?', required: true }),
      f({ id: 'idiomas', type: 'multiselect', label: 'Idiomas que hablas', options: ['Español', 'Inglés', 'Francés'] }),
    ],
  },
  {
    key: 'cuidados',
    label: 'Cuidados',
    icon: 'HeartHandshake',
    title: 'Cuidador/a',
    sector: 'Cuidados',
    fields: [
      ...SYS,
      f({ id: 'exp', type: 'select', label: 'Experiencia cuidando personas', required: true, options: ['Ninguna', 'Menos de 1 año', 'Entre 1 y 3 años', 'Más de 3 años'] }),
      f({ id: 'titulacion', type: 'boolean', label: '¿Tienes titulación relacionada?' }),
      f({ id: 'interna', type: 'boolean', label: '¿Disponible como interna?' }),
      f({ id: 'carnet', type: 'boolean', label: '¿Carnet de conducir?' }),
    ],
  },
]

export function templateCampaignInput(t: SectorTemplate, accent: string): NewCampaignInput {
  return {
    title: t.title,
    sector: t.sector,
    location: '',
    fields: t.fields.map((f2) => ({ ...f2 })),
    branding: defaultBranding(accent),
  }
}
