// ============================================================================
// El ÚNICO importador de pdfjs-dist de la app. La librería pesa cerca de un
// mega, así que entra por import() dinámico (el mismo patrón que xlsx en
// export.ts) y solo la paga quien abre un CV. El worker viaja con ?url DESDE
// AQUÍ DENTRO, para que también quede fuera del bundle principal y Vite lo
// sirva como asset con hash; GlobalWorkerOptions se configura una sola vez.
// ============================================================================

export type Pdfjs = typeof import('pdfjs-dist')
export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

let promesa: Promise<Pdfjs> | null = null

export function cargarPdfjs(): Promise<Pdfjs> {
  if (!promesa) {
    promesa = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
    // Si la carga falla (sin red al pedir el chunk), el siguiente intento
    // vuelve a empezar en vez de quedarse con una promesa rota para siempre.
    promesa.catch(() => {
      promesa = null
    })
  }
  return promesa
}
