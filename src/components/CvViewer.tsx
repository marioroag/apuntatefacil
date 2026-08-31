import { useEffect, useMemo, useRef, useState } from 'react'
import { cargarPdfjs, type PDFDocumentProxy } from '../lib/pdf'
import { ajustarAPalabras, fraccionAvance, localizarCita, type TramoCita } from '../lib/citas'
import { MERIDIAN_NAME, type CitaCv } from '../lib/meridian'

/**
 * VISOR DE CV CON LAS CITAS DE MERIDIAN SUBRAYADAS (ago 2026). Sustituye al
 * iframe para los PDF: un iframe pinta el documento pero no deja tocarlo, y el
 * momento que este producto quiere es enseñar EN el CV la evidencia exacta que
 * sostiene cada juicio. El subrayado no es un adorno: como el evaluador está
 * obligado a citar literal y el CÓDIGO localiza la cita en el documento
 * (lib/citas), cada marca es la prueba física de que Meridian no se lo inventa.
 *
 * EL DOCUMENTO SE MUESTRA ENTERO, no en una caja con su propio scroll (Mario,
 * ago 2026): las páginas se apilan a su alto natural y quien se desplaza es la
 * columna de la ficha, que es la regla de la casa ("una superficie, un
 * scroll"). Con la caja de 520px había dos barras anidadas, y de regalo se va
 * la pereza por posición de scroll: todas las páginas se renderizan al abrir
 * (un CV son 1-3; el tope de 12 acota el resto), que es menos piezas que
 * pueden fallar y por eso también más difícil que el visor se quede a medias.
 *
 * Decisiones que no son opcionales:
 *  - pdf.js entra por import() dinámico (lib/pdf): pesa ~1MB y solo lo paga
 *    quien abre un CV. El iframe sigue existiendo como plan B (prop onFallo):
 *    un PDF que pdf.js no pueda abrir se enseña como siempre.
 *  - La GEOMETRÍA se calcula UNA vez a escala 1 y se pinta en PORCENTAJES del
 *    tamaño de página; el canvas se renderiza aparte a la resolución del
 *    contenedor. Así un resize no recoloca marcas (los % no cambian) y el
 *    bitmap puede regenerarse sin tocar la capa de subrayado.
 *  - El viaje a una cita es un scrollIntoView SOBRE LA PROPIA MARCA: el
 *    navegador desplaza el contenedor que toque (la columna de la ficha), y
 *    desaparece la aritmética de offsetTop contra un contenedor propio que ya
 *    costó un bug de 1400px.
 *  - Las marcas son ámbar de marcador (ver .cita-cv en index.css, excepción
 *    declarada) y NO son botones: un control que no hace nada es una puerta
 *    pintada. El índice interactivo de las citas es el INFORME de Meridian;
 *    la marca lleva `title` para el hover y el recuento de la línea de estado
 *    dice cuántas hay. El canal accesible de las citas es el informe, que las
 *    tiene todas en texto.
 */

export interface CitaActiva {
  id: string
  /** Cambia en cada petición: pulsar dos veces la misma evidencia vuelve a
   *  hacer el viaje (scroll + destello). */
  n: number
}

interface Marca {
  citaId: string
  etiqueta: string
  left: number
  top: number
  width: number
  height: number
}

interface Pagina {
  num: number
  w: number
  h: number
  marcas: Marca[]
}

/** Tope de páginas que se procesan: un CV real son 1-3; pasado esto ya no es un
 *  CV sino un dosier, y el resto se puede leer descargándolo. */
const MAX_PAGINAS = 12

export function CvViewer({
  data,
  titulo,
  citas,
  citaActiva,
  nota,
  onFallo,
  onLocalizadas,
}: {
  data: ArrayBuffer
  titulo: string
  citas: CitaCv[]
  citaActiva?: CitaActiva | null
  /** Línea de estado alternativa (p. ej. "CV escaneado: leído, sin subrayado"). */
  nota?: string
  /** El PDF no se pudo abrir con pdf.js: el padre vuelve al iframe de siempre. */
  onFallo: () => void
  /** Qué citas se han localizado de verdad en el documento. La ficha lo usa
   *  para que el informe solo enlace citas con marca: un botón que salta a
   *  ninguna parte es una puerta pintada. */
  onLocalizadas?: (ids: string[]) => void
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [paginas, setPaginas] = useState<Pagina[] | null>(null)
  const [flash, setFlash] = useState<CitaActiva | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Un ArrayBuffer TRANSFERIDO al worker queda inservible para un segundo
  // getDocument (React 18+ remonta efectos en dev): se le pasa una copia. El
  // destroy vive en la LOADING TASK (API de pdf.js v6), no en el documento.
  useEffect(() => {
    let vivo = true
    let tarea: { destroy: () => Promise<void> } | null = null
    void (async () => {
      try {
        const pdfjs = await cargarPdfjs()
        const t = pdfjs.getDocument({ data: data.slice(0) })
        tarea = t
        const d = await t.promise
        if (!vivo) return
        const total = Math.min(d.numPages, MAX_PAGINAS)
        const encontradas = new Set<string>()
        const out: Pagina[] = []
        for (let num = 1; num <= total; num++) {
          const page = await d.getPage(num)
          const viewport = page.getViewport({ scale: 1 })
          const contenido = await page.getTextContent()
          // Frontera con pdf.js: de sus items solo interesan los de texto, y de
          // ellos, tres campos. El cast estructural es el peaje de la frontera.
          const items = contenido.items.filter(
            (it) => typeof (it as { str?: unknown }).str === 'string',
          ) as unknown as { str: string; transform: number[]; width: number }[]
          const marcas: Marca[] = []
          for (const cita of citas) {
            // Cada cita se subraya UNA vez, en la primera página donde aparece:
            // dos marcas para el mismo juicio dirían que hay dos evidencias.
            if (encontradas.has(cita.id)) continue
            const tramos = localizarCita(cita.texto, items)
            if (!tramos) continue
            encontradas.add(cita.id)
            for (const t of tramos) marcas.push(aMarca(cita, t, items[t.item], viewport, pdfjs))
          }
          out.push({ num, w: viewport.width, h: viewport.height, marcas })
        }
        if (!vivo) return
        setDoc(d)
        setPaginas(out)
        onLocalizadas?.([...encontradas])
      } catch (e) {
        // La miga de pan importa: el fallo cae al iframe y desde fuera no se
        // distingue de un iframe que tampoco pinta. Con esto, una captura de
        // consola dice si murió pdf.js, el worker o el propio documento.
        console.error('[apuntatefacil] el visor de CV no pudo abrir el documento:', e)
        if (vivo) onFallo()
      }
    })()
    return () => {
      vivo = false
      void tarea?.destroy()
    }
    // `citas` cambia solo con el análisis, y el análisis remonta la ficha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // El viaje hasta una cita: scroll suave HASTA LA MARCA y destello. El
  // scrollIntoView va sobre el span de la marca, así que desplaza el scroll
  // que corresponda (la columna de la ficha): el visor no necesita saber en
  // qué contenedor vive. Si la cita no se pudo localizar, el visor LO DICE en
  // su línea de estado: un toque que no hace nada visible es un toque roto.
  const [noEncontrada, setNoEncontrada] = useState(false)
  useEffect(() => {
    if (!citaActiva || !paginas) return
    const hay = paginas.some((p) => p.marcas.some((m) => m.citaId === citaActiva.id))
    if (!hay) {
      setNoEncontrada(true)
      return
    }
    setNoEncontrada(false)
    setFlash(citaActiva)
    // Al fotograma siguiente: el destello remonta el span (cambia su clave) y
    // hay que desplazarse al nodo que queda en el DOM, no al que se va.
    requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector(`[data-cita="${CSS.escape(citaActiva.id)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [citaActiva, paginas])

  const localizadas = useMemo(() => {
    if (!paginas) return 0
    return new Set(paginas.flatMap((p) => p.marcas.map((m) => m.citaId))).size
  }, [paginas])

  const linea = noEncontrada
    ? 'Esa cita no se ha podido localizar en el documento.'
    : nota ??
      (localizadas > 0
        ? `${localizadas === 1 ? '1 cita' : `${localizadas} citas`} de ${MERIDIAN_NAME} subrayada${localizadas === 1 ? '' : 's'} en el documento`
        : null)

  if (!paginas) {
    return (
      <div className="grid min-h-[240px] place-items-center bg-slate-50 px-6 text-center">
        <p className="text-sm text-slate-500" role="status">
          Abriendo el CV…
        </p>
      </div>
    )
  }

  return (
    <div ref={rootRef}>
      {linea && (
        <p className="border-b border-slate-100 px-4 py-2 text-[12px] leading-4 text-slate-500 sm:px-3.5">
          {linea}
        </p>
      )}
      <div className="bg-slate-100 p-3" aria-label={titulo}>
        <div className="mx-auto max-w-[720px] space-y-3">
          {paginas.map((p) => (
            <div
              key={p.num}
              className="relative w-full overflow-hidden rounded-sm bg-white shadow-card"
              style={{ aspectRatio: `${p.w} / ${p.h}` }}
            >
              <PaginaCanvas doc={doc} num={p.num} baseW={p.w} />
              {p.marcas.map((m, k) => {
                const activa = flash?.id === m.citaId
                return (
                  <span
                    // Con el destello activo la clave cambia, y remontar el span
                    // es lo que re-lanza la animación al pedir la misma cita otra vez.
                    key={activa ? `${k}-${flash!.n}` : k}
                    aria-hidden
                    data-cita={m.citaId}
                    title={`Evidencia de ${MERIDIAN_NAME}: ${m.etiqueta}`}
                    className={`cita-cv absolute ${activa ? 'cita-flash' : ''}`}
                    style={{
                      left: `${m.left}%`,
                      top: `${m.top}%`,
                      width: `${m.width}%`,
                      height: `${m.height}%`,
                    }}
                  />
                )
              })}
            </div>
          ))}
          {doc && doc.numPages > paginas.length && (
            <p className="pb-1 text-center text-[12px] text-slate-500">
              El documento sigue: se enseñan las primeras {paginas.length} páginas. Descárgalo para verlo entero.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Un tramo de cita -> una marca en porcentajes de la página. La caja del item
// sale de componer su transform con el del viewport (vale también para texto
// rotado en lo que importa: dónde está). El recorte parcial dentro del item se
// AJUSTA A PALABRAS y se convierte a píxeles pesando cada carácter por su
// anchura típica (fraccionAvance): el reparto por número de caracteres
// derrapaba una letra o dos con fuentes proporcionales y la marca empezaba a
// media palabra.
function aMarca(
  cita: CitaCv,
  t: TramoCita,
  item: { str: string; transform: number[]; width: number },
  viewport: { width: number; height: number; transform: number[]; scale: number },
  pdfjs: { Util: { transform: (a: number[], b: number[]) => number[] } },
): Marca {
  const tx = pdfjs.Util.transform(viewport.transform, item.transform)
  const alto = Math.hypot(tx[2], tx[3])
  const anchoItem = item.width * viewport.scale
  const { desde, hasta } = ajustarAPalabras(item.str, t.desde, t.hasta)
  const f0 = fraccionAvance(item.str, desde)
  const f1 = fraccionAvance(item.str, hasta)
  const x = tx[4] + anchoItem * f0
  const ancho = anchoItem * (f1 - f0)
  // tx[5] es la línea de base; la marca cubre el ojo de la letra con un poco
  // de holgura por abajo, como un marcador de verdad.
  const y = tx[5] - alto
  return {
    citaId: cita.id,
    etiqueta: cita.etiqueta,
    left: (x / viewport.width) * 100,
    top: (y / viewport.height) * 100,
    width: (ancho / viewport.width) * 100,
    height: ((alto * 1.18) / viewport.height) * 100,
  }
}

// El bitmap de una página, renderizado a la resolución real del contenedor
// (nítido en retina). La caja la pone el padre con aspect-ratio, así que antes
// de renderizar ya ocupa su sitio y la página no salta.
function PaginaCanvas({
  doc,
  num,
  baseW,
}: {
  doc: PDFDocumentProxy | null
  num: number
  baseW: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hecho = useRef(false)

  useEffect(() => {
    if (!doc || hecho.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    let vivo = true
    let tarea: { cancel: () => void } | null = null
    void (async () => {
      try {
        const page = await doc.getPage(num)
        if (!vivo || !canvas.parentElement) return
        const cssW = canvas.parentElement.clientWidth || baseW
        const scale = (cssW * Math.min(2, window.devicePixelRatio || 1)) / baseW
        const viewport = page.getViewport({ scale })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const render = page.render({ canvas, viewport })
        tarea = render
        await render.promise
        hecho.current = true
      } catch {
        // Una página que no renderiza se queda en blanco; el documento sigue.
      }
    })()
    return () => {
      vivo = false
      tarea?.cancel()
    }
  }, [doc, num, baseW])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
}
