import { useEffect } from 'react'
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
 * pieza. Lo que esta añade es la ESPERA, porque desde una tabla no hay ningún
 * incrustado cargando que explique el segundo que tarda la firma; pero esa espera
 * la pinta el VISOR (`cargando`) y no una capa propia, que es lo que hacía antes:
 * con su telón y su mensaje aparte, un clic encadenaba dos capas seguidas y el
 * relevo se veía como un parpadeo.
 *
 * LO QUE NO ES UN PDF NO SE PREVISUALIZA, SE DESCARGA. Es la misma regla que la
 * fila de la ficha ("un PDF lo amplía y lo demás lo descarga"): un visor que no
 * sabe abrir un `.docx` no puede prometerlo, y una capa con un error dentro es
 * peor que el fichero en el disco.
 *
 * PERO UN PDF QUE NO SE PUEDE SUBRAYAR SÍ SE PREVISUALIZA, con el visor del
 * navegador (el plan B, que vive dentro de `CvLightbox` desde sep 2026). Eso es
 * un fallo de NUESTRO visor, no del documento, y cerrar la capa por eso dejaba el
 * clic mudo: se veía abrirse y cerrarse.
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

  // Lo que no se puede enseñar se entrega: un Word no tiene visor y una firma que
  // no sale tampoco tiene documento que pintar, así que ahí se descarga y punto.
  //
  // QUE LOS BYTES NO LLEGUEN NO ES DE ESTA LISTA (`visorFallo`): el documento se
  // puede ver igual con el visor del navegador, y el visor grande lo hace desde
  // sep 2026. Estaba dentro, así que el clic abría la capa de espera y la cerraba
  // en seco sin enseñar nada, que es el peor final posible para un clic.
  const fuera = !doc.esPdf || doc.error
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

  // La capa se monta en el CLIC, no cuando llegan los bytes: se ha pulsado para
  // ver un documento, así que lo que tiene que pasar es que se abra algo. Se
  // espera a los bytes (los que subrayan las citas) mientras puedan llegar; si se
  // sabe que no van a llegar (`visorFallo`), se enseña ya el plan B en vez de
  // seguir dando vueltas a un molinillo.
  return (
    <CvLightbox
      nombre={cvName || 'CV'}
      data={doc.bytes}
      cargando={!doc.bytes && !doc.visorFallo}
      citas={citas}
      onClose={onClose}
      onDescargar={() => void doc.descargar().then((ok) => { if (!ok) toast.error(ERROR_DESCARGA) })}
      urlAparte={doc.url}
    />
  )
}
