// Texto del correo de comprobación de interés, para poder ENSEÑARLO antes de enviar.
//
// Misma doctrina que el FieldRenderer único: la vista previa no es una versión
// bonita aparte, es el correo que sale de verdad. La fuente de la verdad del
// envío es `supabase/functions/send-interest-check/index.ts` (busca `const subject`);
// esto es su espejo en texto plano para la interfaz. Si cambias el copy allí,
// cámbialo aquí, y al revés. Hay un test que fija este texto.
import type { InterestSendMode } from './interest'

export interface InterestEmailPreview {
  subject: string
  /** Cuerpo en texto plano, ya con el saludo. Una línea por párrafo. */
  body: string
  /** Las dos opciones que ve el candidato, en el mismo orden que el correo. */
  options: [string, string]
  footnote: string
}

export interface InterestEmailInput {
  campaignTitle: string
  /** Marca del puesto si la tiene, si no el nombre de la empresa. */
  senderName: string
  /** Nombre de pila del candidato, si lo dejó. */
  candidateName?: string | null
  mode?: InterestSendMode
}

export function interestEmailPreview({
  campaignTitle,
  senderName,
  candidateName,
  mode = 'initial',
}: InterestEmailInput): InterestEmailPreview {
  const greeting = candidateName ? `Hola, ${candidateName}.` : 'Hola.'
  const reminder = mode === 'reminder'
  const subject = reminder
    ? `Recordatorio: ¿sigues interesado/a en el puesto de ${campaignTitle}?`
    : `¿Sigues interesado/a en el puesto de ${campaignTitle}?`
  const paragraph = reminder
    ? `Hace unos días, ${senderName} te preguntó si sigues interesado/a en el puesto de ${campaignTitle}. Como todavía no hemos recibido respuesta, puedes indicarlo con una de estas opciones.`
    : `${senderName} está revisando las candidaturas para el puesto de ${campaignTitle} y quiere saber si sigues interesado/a.`
  return {
    subject,
    body: `${greeting}\n\n${paragraph}`,
    options: ['Sí, sigo interesado/a', 'No, ya no me interesa'],
    footnote: 'Recibes este correo porque enviaste una candidatura para este puesto.',
  }
}
