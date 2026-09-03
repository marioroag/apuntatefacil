import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { CvLightbox } from './CvLightbox'
import { useToast } from './ui/Toast'
import { ERROR_DESCARGA, useDocumento } from '../lib/documento'
import { citasDelAnalisis } from '../lib/meridian'
import type { Campaign, Candidate } from '../lib/types'

/**
 * EL DOCUMENTO DE UNA FILA, SIN ABRIR SU FICHA (Mario, sep 2026: "al clickear los
 * documentos abren el preview", "que solo abra el preview no la ficha").
 *
 * El chip "CV" de la columna Documentos abre esto: el mismo visor grande de la
 * ficha, con los mismos subrayados de Meridian y los mismos dos verbos, encima de
 * la lista. Antes había que abrir la persona entera para ver una hoja.
 *
 * Y no es una copia de aquello: el camino de un documento (firmar, bajar los
 * bytes, reintentar, descargar) vive en `useDocumento`, y el visor es la misma
 * pieza. Lo que esta añade es lo que la fila no tiene: la ESPERA, porque desde una
 * tabla no hay ningún incrustado cargando que la explique.
 *
 * LO QUE NO ES UN PDF NO SE PREVISUALIZA, SE DESCARGA. Es la misma regla que la
 * fila de la ficha ("un PDF lo amplía y lo demás lo descarga"): un visor que no
 * sabe abrir un `.docx` no puede prometerlo, y una capa con un error dentro es
 * peor que el fichero en el disco.
 */
export function PreviewDocumento({
  campaign,
  candidate,
  onClose,
}: {
  campaign: Campaign
  candidate: Candidate
  onClose: () => void
}) {
  const path = candidate.cvPath ?? ''
  const doc = useDocumento(path)
  const toast = useToast()
  // El nombre del fichero es la respuesta a la pregunta de tipo fichero, igual que
  // en la ficha: es lo que el candidato subió y cómo se llama para él.
  const cvField = campaign.fields.find((f) => f.type === 'file')
  const cvName = cvField ? String(candidate.answers[cvField.id] ?? '') : ''
  const citas = citasDelAnalisis(candidate.ai)

  // Lo que no se puede enseñar se entrega. Y lo que falla se dice y se cierra: una
  // capa negra con un mensaje encima de la lista no ayuda a nadie.
  const fuera = !doc.esPdf || doc.visorFallo || doc.error
  useEffect(() => {
    if (!fuera) return
    void doc.descargar().then((ok) => {
      if (!ok) toast.error(ERROR_DESCARGA)
      onClose()
    })
    // `doc.descargar` es estable (useCallback) y el resto no cambia mientras esto
    // vive: lo que dispara esto es `fuera`, una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuera])

  if (fuera) return null
  if (!doc.bytes) {
    // LA ESPERA ES UNA CAPA, no un cambio en la fila: se ha pulsado para ver un
    // documento, así que lo que tiene que pasar es que se abra algo. Sin esto, el
    // clic se quedaba mudo el segundo que tarda la firma más la descarga.
    return createPortal(
      <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/70" role="status" aria-live="polite">
        <p className="flex items-center gap-2 text-sm font-medium text-white">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Abriendo {cvName || 'el documento'}…
        </p>
      </div>,
      document.body,
    )
  }

  return (
    <CvLightbox
      nombre={cvName || 'CV'}
      data={doc.bytes}
      citas={citas}
      onClose={onClose}
      onDescargar={() => void doc.descargar().then((ok) => { if (!ok) toast.error(ERROR_DESCARGA) })}
      urlAparte={doc.url}
    />
  )
}
