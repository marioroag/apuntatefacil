import { describe, expect, it } from 'vitest'
import { buildSheet, celdaCsv } from './export'
import type { Campaign, Candidate, CandidateComment } from './types'

// El export es el único sitio donde los datos del cliente salen de la app. Dos
// cosas se pueden romper aquí en silencio, sin error y sin que se note hasta que
// alguien abre el Excel:
//   1) las filas señuelo de las candidaturas bloqueadas se escribían por
//      desplazamiento (`estadoCol + 4`), así que cualquier columna nueva las
//      descuadraba;
//   2) lo que escribe el equipo (antes notas, ahora el hilo) podía dejar de
//      salir al cambiar de modelo, que es pérdida de datos.

const campaign = {
  id: 'cmp1',
  fields: [
    { id: 'nombre', type: 'text', label: 'Nombre', required: true },
    { id: 'telefono', type: 'phone', label: 'Teléfono', required: true },
  ],
} as unknown as Campaign

const candidato = (over: Partial<Candidate> = {}): Candidate =>
  ({
    id: 'c1',
    campaignId: 'cmp1',
    answers: { nombre: 'Rubén Ortega', telefono: '612345678' },
    status: 'contactado',
    submittedAt: '2026-07-28T10:00:00.000Z',
    source: 'enlace',
    favorito: false,
    notes: '',
    tagIds: [],
    ...over,
  }) as Candidate

function hojaDe(...args: Parameters<typeof buildSheet>) {
  const { header, rows } = buildSheet(...args)
  return [header, ...rows]
}

describe('buildSheet', () => {
  it('saca el hilo del equipo en la columna Conversación', () => {
    const comments: Record<string, CandidateComment[]> = {
      c1: [
        {
          id: 'm1',
          candidateId: 'c1',
          authorUserId: null,
          authorEmail: '',
          body: 'Nota vieja',
          mentions: [],
          isNote: true,
          editedAt: null,
          createdAt: '2026-07-28T11:00:00.000Z',
        },
        {
          id: 'm2',
          candidateId: 'c1',
          authorUserId: 'u2',
          authorEmail: 'laura.gil@test.es',
          body: 'Le llamo yo mañana.',
          mentions: [],
          isNote: false,
          editedAt: null,
          createdAt: '2026-07-28T12:00:00.000Z',
        },
      ],
    }
    const filas = hojaDe(campaign, [candidato({ favorito: true })], [], [], comments)
    const cab = filas[0]
    const fila = filas[1]

    expect(cab).toContain('Conversación')
    expect(cab).toContain('Favorito')
    expect(cab).not.toContain('Valoración')

    expect(fila[cab.indexOf('Favorito')]).toBe('Sí')
    const conversacion = fila[cab.indexOf('Conversación')]
    expect(conversacion).toContain('Nota anterior')
    expect(conversacion).toContain('Laura Gil')
    expect(conversacion).toContain('Le llamo yo mañana.')
  })

  it('deja el favorito en blanco cuando no lo es', () => {
    const filas = hojaDe(campaign, [candidato()], [], [], {})
    expect(filas[1][filas[0].indexOf('Favorito')]).toBe('')
  })

  it('coloca las filas bloqueadas en SU columna, no por desplazamiento', () => {
    const filas = hojaDe(campaign, [candidato()], [], ['2026-07-30T09:00:00.000Z'], {})
    const cab = filas[0]
    const bloqueada = filas[1] // las bloqueadas van arriba

    expect(bloqueada[0]).toBe('Candidatura bloqueada')
    expect(bloqueada[cab.indexOf('Estado')]).toBe('Bloqueada')
    expect(bloqueada[cab.indexOf('Recibida')]).toMatch(/30\/07\/2026/)
    expect(bloqueada[cab.indexOf('Conversación')]).toMatch(/Añade tu método de pago/)
    // Y nada de datos personales en las columnas del formulario.
    expect(bloqueada[1]).toBe('•••')
  })
})

/* ---------------------------------------------------------------------------
   INYECCIÓN DE FÓRMULAS EN EL CSV. Una respuesta del formulario público que
   empiece por `=`, `+`, `-` o `@` NO puede llegar a la celda tal cual: abierto
   en Excel o en Google Sheets se evaluaría. Probado rompiéndolo a propósito:
   devolviendo `v` sin la comilla, fallan los cuatro primeros.
--------------------------------------------------------------------------- */
describe('celdaCsv', () => {
  it('neutraliza una celda que empieza por un carácter de fórmula', () => {
    expect(celdaCsv('=1+1')).toBe('"\'=1+1"')
    expect(celdaCsv('+34 600 000 000')).toBe('"\'+34 600 000 000"')
    expect(celdaCsv('-5')).toBe('"\'-5"')
    expect(celdaCsv('@usuario')).toBe('"\'@usuario"')
    expect(celdaCsv('\tfórmula')).toBe('"\'\tfórmula"')
  })
  it('deja el texto normal como estaba, y entrecomilla solo lo que el RFC pide', () => {
    expect(celdaCsv('Juan García')).toBe('Juan García')
    expect(celdaCsv('dice "hola", y sigue')).toBe('"dice ""hola"", y sigue"')
    expect(celdaCsv('dos\nlíneas')).toBe('"dos\nlíneas"')
  })
  it('conserva las comillas de dentro también cuando neutraliza', () => {
    expect(celdaCsv('=HYPERLINK("https://malo.example")')).toBe('"\'=HYPERLINK(""https://malo.example"")"')
  })
})
