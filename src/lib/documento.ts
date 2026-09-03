import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * CARGAR UN DOCUMENTO DE CANDIDATO, EN UN SOLO SITIO.
 *
 * Firmar la URL, bajarse los bytes para el visor con subrayados, leer el peso y
 * volver a empezar tras un fallo son cuatro cosas que estaban dentro del bloque
 * de Documentos de la ficha, y la doctrina decía por eso que "el CV no es un
 * control de la fila": desde la tabla no se podía abrir sin copiar todo esto.
 *
 * Con el camino aquí, la copia deja de hacer falta y la regla se cumple mejor que
 * antes: el chip "CV" de la columna abre el visor grande (Mario, sep 2026: "al
 * clickear los documentos abren el preview", "que solo abra el preview no la
 * ficha") y sigue habiendo UNA sola forma de resolver un documento.
 *
 * Dos caminos y no uno, y esto es lo que se olvida al tocarlo: los documentos de
 * la DEMO (y el que se acaba de añadir en ella) son rutas de asset o `blob:`, que
 * se usan tal cual; los de verdad viven en un bucket privado y hay que firmarlos.
 * Una firma caduca, así que se pide al abrir y se renueva al reintentar.
 */
export interface Documento {
  /** La URL con la que se pinta y se abre fuera: firmada, o la del asset. */
  url: string | null
  /** Los bytes del PDF, para el visor que subraya citas. */
  bytes: ArrayBuffer | null
  /** "184 KB", si Storage lo sabe. Es un extra: sin él no se pinta y ya está. */
  peso: string | null
  /** No se pudo firmar (o no existe): el bloque enseña su error. */
  error: boolean
  esPdf: boolean
  /** El visor de PDF no pudo con él: se cae al iframe del navegador. */
  visorFallo: boolean
  fallarVisor: () => void
  reintentar: () => void
  /** Abre el fichero para bajarlo. `false` si no se pudo firmar. */
  descargar: () => Promise<boolean>
}

/** Lo que se le dice al usuario cuando la descarga no sale. Vive aquí para que
 *  las dos superficies que la ofrecen digan lo mismo. */
export const ERROR_DESCARGA = 'No se pudo descargar el CV.'

export function useDocumento(path: string): Documento {
  const [urlFirmada, setUrlFirmada] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [peso, setPeso] = useState<string | null>(null)
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [visorFallo, setVisorFallo] = useState(false)
  const [intento, setIntento] = useState(0)

  const esPdf = path.toLowerCase().endsWith('.pdf')
  // Ruta que se usa TAL CUAL, sin firmar: los assets de la demo (`/demo/...`) y
  // el object URL de un documento recién añadido en la demostración.
  const esAssetDemo = path.startsWith('/') || path.startsWith('blob:')

  // La ruta de un asset de la demo NO pasa por el estado: se USA tal cual, así que
  // derivarla es más honesto que copiarla a un `useState` desde un efecto (y es lo
  // que el linter pide, con razón: eso es un render de más para un dato que ya
  // tenías). Solo la firmada necesita estado, porque llega de la red.
  const url = esAssetDemo ? path : urlFirmada

  useEffect(() => {
    if (esAssetDemo) return
    let vivo = true
    // La firma caduca: se pide al abrir y se renueva al reintentar.
    void supabase.storage
      .from('cvs')
      .createSignedUrl(path, 600)
      .then(({ data, error: e }) => {
        if (!vivo) return
        if (e || !data?.signedUrl) setError(true)
        else setUrlFirmada(data.signedUrl)
      })
    // El tamaño es un extra: si Storage no lo da, simplemente no se pinta.
    const dir = path.split('/').slice(0, -1).join('/')
    const file = path.split('/').pop() ?? ''
    void supabase.storage
      .from('cvs')
      .list(dir, { search: file })
      .then(({ data }) => {
        if (!vivo) return
        const size = data?.find((f) => f.name === file)?.metadata?.size
        if (typeof size === 'number') setPeso(`${Math.max(1, Math.round(size / 1024))} KB`)
      })
    return () => {
      vivo = false
    }
  }, [path, esAssetDemo, intento])

  // Los BYTES del PDF, para el visor con subrayados: una sola descarga sirve para
  // renderizar y para buscar las citas. Si falla se cae al iframe con la URL
  // firmada, que es lo que había.
  useEffect(() => {
    if (!esPdf || !url || visorFallo) return
    let vivo = true
    void fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((buf) => {
        if (vivo) setBytes(buf)
      })
      .catch((e) => {
        console.error('[apuntatefacil] no se pudo descargar el CV para el visor:', e)
        if (vivo) setVisorFallo(true)
      })
    return () => {
      vivo = false
    }
  }, [esPdf, url, visorFallo])

  /** Vuelve a empezar el camino ENTERO, con firma nueva incluida, en vez de
   *  obligar a cerrar la ficha y reabrirla. */
  const reintentar = useCallback(() => {
    setUrlFirmada(null)
    setError(false)
    setBytes(null)
    setVisorFallo(false)
    setIntento((n) => n + 1)
  }, [])

  const fallarVisor = useCallback(() => setVisorFallo(true), [])

  const descargar = useCallback(async () => {
    if (esAssetDemo) {
      window.open(path, '_blank', 'noopener')
      return true
    }
    const { data, error: e } = await supabase.storage.from('cvs').createSignedUrl(path, 120, { download: true })
    if (e || !data?.signedUrl) return false
    window.open(data.signedUrl, '_blank', 'noopener')
    return true
  }, [esAssetDemo, path])

  return { url, bytes, peso, error, esPdf, visorFallo, fallarVisor, reintentar, descargar }
}
