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

async function importar(): Promise<Pdfjs> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

export function cargarPdfjs(): Promise<Pdfjs> {
  if (!promesa) {
    // Un import dinámico también falla por un tropiezo PUNTUAL (un corte de
    // red, el dev server recargando): un único reintento corto cubre el caso
    // ocasional ("a veces el visor sale gris") sin esconder el permanente (el
    // chunk desaparecido tras un deploy vuelve a fallar y se cae al plan B).
    promesa = importar().catch(async (e) => {
      console.error('[apuntatefacil] pdf.js no cargó a la primera, reintento:', e)
      await new Promise((r) => setTimeout(r, 400))
      return importar()
    })
    // Si aun así falla (sin red al pedir el chunk), el siguiente intento
    // vuelve a empezar en vez de quedarse con una promesa rota para siempre.
    promesa.catch(() => {
      promesa = null
    })
  }
  return promesa
}
