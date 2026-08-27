import { MessageCircleDashed } from 'lucide-react'
import { WHATSAPP_WIP } from '../lib/whatsapp'
import { IconoVacio } from './ui/IconoVacio'

/**
 * Lo que se ve donde había una función que manda un WhatsApp, mientras el canal
 * no esté de alta (ver `lib/whatsapp.ts`).
 *
 * Dos formas y ni una más: el PANEL, para cuando el WhatsApp era el asunto de la
 * pantalla (la pestaña Conversación), y el AVISO de una línea, para cuando era
 * una opción entre otras que sí funcionan (el canal de "Comprobar interés", los
 * ajustes del asistente). Las dos sacan el texto de `WHATSAPP_WIP`, así que el
 * día que se encienda no queda ninguna copia contando algo que ya no pasa.
 *
 * El glifo es la burbuja DISCONTINUA, no la de siempre en gris: una burbuja
 * apagada se lee como "sin mensajes", y aquí lo que pasa es que el canal todavía
 * no existe. Y el tono es neutro a propósito: no está pasando nada malo, así que
 * ni ámbar ni rojo, que en esta app significan otra cosa.
 */
export function PanelWhatsappPendiente() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      <div className="mx-auto max-w-[36ch]">
        <IconoVacio Icon={MessageCircleDashed} alineado="izquierda" />
        <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{WHATSAPP_WIP.titulo}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{WHATSAPP_WIP.cuerpo}</p>
        {/* Nunca un callejón sin salida: cuadrar la entrevista se puede hacer
            hoy, lo único que no hacemos es escribirle nosotros.
            Y se manda al botón de la cabecera en vez de repetirlo aquí: ese
            botón está a la vista en todos los anchos y abre este mismo diálogo,
            así que un segundo "Agendar entrevista" a dos dedos del primero se
            lee como otra acción distinta. Es lo mismo que hace la ficha cuando
            la cita ya existe ("desde el botón de la entrevista, arriba"). */}
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          Mientras tanto, quedas tú con el candidato y apuntas la cita con "Agendar entrevista",
          aquí arriba: la verás en tu agenda igual.
        </p>
      </div>
    </div>
  )
}

/** Una línea. Para donde el WhatsApp era una opción, no la pantalla entera. */
export function AvisoWhatsappPendiente({ className = '' }: { className?: string }) {
  return (
    <p
      className={`flex gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] leading-5 text-slate-600 ring-1 ring-inset ring-slate-200 ${className}`}
    >
      <MessageCircleDashed className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
      <span>{WHATSAPP_WIP.linea}</span>
    </p>
  )
}
