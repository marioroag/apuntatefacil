import { describe, expect, it } from 'vitest'
// El guardián de los CVs de la demo: garantiza que el momento wow FUNCIONA en
// la demo, que es donde un cliente lo ve por primera vez.
//
// Vigila dos contratos, y los dos se rompieron alguna vez:
//  1. Toda cita de fuente 'cv' de un candidato demo con CV se LOCALIZA en el
//     texto de su CV ficticio, usando el MISMO código que el visor
//     (localizarCita): si esto pasa en verde, el subrayado sale en pantalla,
//     porque los PDFs de public/demo se generan de ese mismo texto
//     (scripts/gen-demo-cvs.mjs, fuente única demoCv.ts).
//  2. `cvUsed` dice la verdad: antes un 65% aleatorio de análisis demo decían
//     "he leído un CV" en fichas cuyo bloque Documentos decía "este formulario
//     no pide documentos". cvUsed === true si y solo si hay cvPath.
//
// Cada detector se probó rompiéndolo a propósito antes de darlo por bueno.
import { SEED } from './seed'
import { DEMO_CVS, textoDemoCv } from './demoCv'
import { localizarCita } from './citas'
import { citasDelAnalisis } from './meridian'

const conCv = SEED.candidates.filter((c) => c.cvPath)

describe('los CVs de la demo sostienen el subrayado', () => {
  it('hay candidatos demo con CV (el wow se enseña, no se cuenta)', () => {
    expect(conCv.length).toBeGreaterThanOrEqual(2)
  })

  it('cada cvPath apunta a un CV ficticio declarado, y su nombre de fichero casa', () => {
    for (const c of conCv) {
      const cv = DEMO_CVS.find((d) => d.fichero === c.cvPath)
      expect(cv, `cvPath sin CV ficticio declarado: ${c.cvPath}`).toBeDefined()
      expect(c.answers.cv).toBe(cv!.nombreFichero)
    }
  })

  it('toda cita de fuente cv (evidencias y contrastes) se localiza en el texto de su CV', () => {
    for (const c of conCv) {
      const cv = DEMO_CVS.find((d) => d.fichero === c.cvPath)!
      const items = [{ str: textoDemoCv(cv) }]
      const citas = citasDelAnalisis(c.ai)
      // Un candidato con CV y sin ni una cita localizable no enseña nada del
      // visor: sería el asset pagado sin el wow que lo justifica.
      expect(citas.length, `sin citas de CV en ${c.id}`).toBeGreaterThan(0)
      for (const cita of citas) {
        expect(
          localizarCita(cita.texto, items),
          `cita no localizable en el CV de ${c.id}: "${cita.texto}"`,
        ).not.toBeNull()
      }
    }
  })

  it('al menos un candidato demo trae un contraste respuesta-vs-CV', () => {
    expect(conCv.some((c) => (c.ai?.contrastes?.length ?? 0) > 0)).toBe(true)
  })

  it('todos traen trayectoria extraída (la ficha del CV se enseña)', () => {
    for (const c of conCv) {
      expect(c.ai?.trayectoria?.empleos.length, `sin trayectoria en ${c.id}`).toBeGreaterThan(0)
    }
  })
})

describe('cvUsed dice la verdad en toda la demo', () => {
  it('cvUsed === true si y solo si hay cvPath (y con cvPath, cvLeido es texto)', () => {
    for (const c of SEED.candidates) {
      if (!c.ai || c.ai.error) continue
      expect(!!c.ai.cvUsed, `cvUsed miente en ${c.id} (cvPath: ${c.cvPath ?? 'no'})`).toBe(!!c.cvPath)
      if (c.cvPath) expect(c.ai.cvLeido).toBe('texto')
    }
  })
})
