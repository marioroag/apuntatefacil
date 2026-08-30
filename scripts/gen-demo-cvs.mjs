// Genera los PDF de los CVs ficticios de la demo a partir de src/lib/demoCv.ts
// (la fuente única: mismo texto que las citas de los análisis del seed).
// Se ejecuta a mano cuando cambie demoCv.ts, y los PDF se commitean:
//
//   node --experimental-strip-types scripts/gen-demo-cvs.mjs
//
// Usa el Chrome del sistema en headless (--print-to-pdf), que produce PDFs con
// CAPA DE TEXTO real y seleccionable: es lo que hace que unpdf los lea en el
// servidor y que el visor pueda localizar y subrayar las citas.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEMO_CVS } from '../src/lib/demoCv.ts'

const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT_DIR = resolve(import.meta.dirname, '../public/demo')
const TMP_DIR = resolve(import.meta.dirname, '../node_modules/.tmp-demo-cvs')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Un CV sobrio de persona real: tipografía del sistema, una columna, sin
// florituras. No sigue el sistema de diseño de la app A PROPÓSITO: es un
// documento que trae el candidato, no una superficie nuestra.
function html(cv) {
  const seccion = (titulo, cuerpo) =>
    `<h2>${esc(titulo)}</h2>${cuerpo}`
  const experiencia = cv.experiencia
    .map((e) => `<p class="puesto"><strong>${esc(e.titulo)}</strong><br>${esc(e.detalle)}</p>`)
    .join('')
  const lista = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font: 11pt/1.5 Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 2pt; }
  .titular { font-size: 12pt; color: #444; margin: 0 0 2pt; }
  .contacto { font-size: 10pt; color: #555; margin: 0 0 14pt; }
  h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.06em;
       border-bottom: 1px solid #ccc; padding-bottom: 3pt; margin: 16pt 0 6pt; }
  p, li { margin: 0 0 6pt; }
  ul { padding-left: 16pt; margin: 0; }
  .puesto { margin-bottom: 8pt; }
</style></head><body>
  <h1>${esc(cv.nombre)}</h1>
  <p class="titular">${esc(cv.titular)}</p>
  <p class="contacto">${esc(cv.contacto)}</p>
  <p>${esc(cv.perfil)}</p>
  ${seccion('Experiencia', experiencia)}
  ${seccion('Carnets y certificados', lista(cv.carnets))}
  ${seccion('Formación', lista(cv.formacion))}
  ${seccion('Idiomas', `<p>${esc(cv.idiomas)}</p>`)}
</body></html>`
}

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(TMP_DIR, { recursive: true })
for (const cv of DEMO_CVS) {
  const nombreHtml = resolve(TMP_DIR, cv.nombreFichero.replace(/\.pdf$/, '.html'))
  const destino = resolve(OUT_DIR, cv.nombreFichero)
  writeFileSync(nombreHtml, html(cv))
  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${destino}`,
    `file://${nombreHtml}`,
  ])
  console.log(`OK ${destino}`)
}
rmSync(TMP_DIR, { recursive: true, force: true })
