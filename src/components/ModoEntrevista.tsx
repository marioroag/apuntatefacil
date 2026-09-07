import { MapPin, Phone, Video } from 'lucide-react'
import { INTERVIEW_MODES, INTERVIEW_MODE_META, type InterviewMode } from '../lib/types'

/**
 * Cómo es la entrevista: en persona, por teléfono o por videollamada.
 *
 * Una sola primitiva para los dos sitios donde se decide (los ajustes y el
 * apunte a mano). Si se tocan las opciones, se tocan en los dos a la vez, que es
 * justo lo que no pasaba antes: los selectores ofrecían dos modalidades y la
 * base admitía tres.
 *
 * Van en fila vertical y no en tres pestañas apretadas: "Por teléfono" y
 * "Videollamada" no caben legibles en un tercio de una columna de 36 caracteres,
 * y aquí cabe además la frase que de verdad resuelve la duda (quién se mueve).
 * Son radios de verdad, así que las flechas del teclado funcionan solas.
 */
const ICONO: Record<InterviewMode, typeof MapPin> = {
  presencial: MapPin,
  telefonica: Phone,
  videollamada: Video,
}

export function ModoEntrevista({
  value,
  onChange,
  name,
  etiqueta = 'Modalidad de la entrevista',
  compacto = false,
}: {
  value: InterviewMode
  onChange: (m: InterviewMode) => void
  /** Único por instancia: dos radiogroups con el mismo `name` se pisan. */
  name: string
  /** Cómo se anuncia el grupo. Lo que se ve encima es un título o una leyenda,
   *  que no le pone nombre al grupo por sí solo. */
  etiqueta?: string
  compacto?: boolean
}) {
  return (
    <div className="space-y-1.5" role="radiogroup" aria-label={etiqueta}>
      {INTERVIEW_MODES.map((m) => {
        const Icono = ICONO[m]
        const activo = value === m
        return (
          <label
            key={m}
            className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 ring-1 ring-inset transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 ${
              compacto ? 'py-2' : 'py-2.5'
            } ${
              activo
                ? 'bg-indigo-50 ring-indigo-300'
                : 'bg-white ring-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={m}
              checked={activo}
              onChange={() => onChange(m)}
              // Explícita y no heredada del <label>: sin esto se anuncia el
              // valor crudo ("telefonica"), comprobado en el árbol de la página.
              aria-label={`${INTERVIEW_MODE_META[m].label}. ${INTERVIEW_MODE_META[m].pista}`}
              className="sr-only"
            />
            <Icono
              className={`size-4 shrink-0 ${activo ? 'text-indigo-700' : 'text-slate-400'}`}
              aria-hidden
            />
            <span className="min-w-0">
              <span
                className={`block text-[14px] font-semibold ${
                  activo ? 'text-indigo-700' : 'text-slate-700'
                }`}
              >
                {INTERVIEW_MODE_META[m].label}
              </span>
              <span className="block text-[12px] text-slate-500">{INTERVIEW_MODE_META[m].pista}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
