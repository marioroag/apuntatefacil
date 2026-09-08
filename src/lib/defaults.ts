import type { Branding, FormField } from './types'
import type { NewCampaignInput } from './store'

// Campos precargados de un puesto nuevo (doctrina: nada de lienzo en blanco).
export const DEFAULT_FIELDS: FormField[] = [
  { id: 'nombre', type: 'text', label: 'Nombre y apellidos', required: true, system: true, placeholder: 'Tu nombre completo' },
  { id: 'telefono', type: 'phone', label: 'Teléfono', required: true, system: true, placeholder: '600 000 000' },
  { id: 'email', type: 'email', label: 'Email', required: true },
  { id: 'experiencia', type: 'textarea', label: 'Cuéntanos tu experiencia', required: false },
]

// Texto por defecto del formulario, usado como placeholder en el editor (Apariencia)
// cuando el campo está vacío. FORM_THANKS_DEFAULT es además el texto real que ve el
// candidato en la pantalla de "gracias" si el campo de agradecimiento está vacío.
export const FORM_WELCOME_DEFAULT = 'Gracias por tu interés. Rellena el formulario y te contactamos pronto.'
export const FORM_THANKS_DEFAULT = 'La empresa revisará tu candidatura y te contactará si encaja con el puesto.'

export function defaultBranding(accent: string): Branding {
  return {
    welcome: FORM_WELCOME_DEFAULT,
    thanks: 'Recibido. Revisamos tu candidatura y te contactamos. Gracias por escribirnos.',
    accent,
    showLogo: true,
  }
}

// Ojo: este 'Nuevo puesto' es el TÍTULO por defecto del puesto recién creado (lo
// que se lee en la lista hasta que le pones nombre), no la etiqueta del botón,
// que desde ago 2026 es "Crear puesto". Son dos cosas distintas y no se sincronizan.
export function blankCampaignInput(accent: string, title = 'Nuevo puesto'): NewCampaignInput {
  return {
    title,
    sector: '',
    location: '',
    provincia: '',
    fields: DEFAULT_FIELDS.map((f) => ({ ...f })),
    branding: defaultBranding(accent),
  }
}
