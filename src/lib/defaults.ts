import type { Branding, FormField } from './types'
import type { NewCampaignInput } from './store'

// Campos precargados de un puesto nuevo (doctrina: nada de lienzo en blanco).
export const DEFAULT_FIELDS: FormField[] = [
  { id: 'nombre', type: 'text', label: 'Nombre y apellidos', required: true, system: true, placeholder: 'Tu nombre completo' },
  { id: 'telefono', type: 'phone', label: 'Teléfono', required: true, system: true, placeholder: '600 000 000' },
  { id: 'email', type: 'email', label: 'Email' },
  { id: 'experiencia', type: 'textarea', label: 'Cuéntanos tu experiencia' },
]

export function defaultBranding(accent: string): Branding {
  return {
    headline: '',
    welcome: 'Gracias por tu interés. Rellena el formulario y te contactamos pronto.',
    thanks: 'Recibido. Revisamos tu candidatura y te contactamos. Gracias por escribirnos.',
    accent,
    showLogo: true,
  }
}

export function blankCampaignInput(accent: string, title = 'Nuevo puesto'): NewCampaignInput {
  return {
    title,
    sector: '',
    location: '',
    fields: DEFAULT_FIELDS.map((f) => ({ ...f })),
    branding: defaultBranding(accent),
  }
}
