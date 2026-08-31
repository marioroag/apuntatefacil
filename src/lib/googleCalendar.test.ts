import { describe, expect, it } from 'vitest'
import {
  construirEvento, cuerpoEvento, enlaceMeet, type DatosEntrevista,
} from '../../supabase/functions/_shared/google/evento'
// Fundir lo ocupado vive con la AGENDA y no con Google: lo que llega de un
// calendario externo es una fuente más, y quien lo consume es el generador de
// huecos. Aquí se prueba porque este es el guardián que lo trajo.
import { fundirOcupado } from '../../supabase/functions/_shared/schedule/slots'

/**
 * EL GUARDIÁN DEL CALENDARIO DE GOOGLE.
 *
 * Lo que vigila no es cómo queda un evento, es que ESCRIBIR en el calendario de
 * alguien no se convierta en MANDARLE UN MENSAJE A UN CANDIDATO sin que nadie
 * lo haya escrito. Basta con añadir `attendees` al cuerpo para que Google le
 * mande un correo en nombre del empresario, y otro por cada cambio de hora: no
 * es un detalle de la API, es un canal nuevo abierto de lado. Por eso la prueba
 * mira también el FUENTE y no solo la salida de una función: el día que alguien
 * lo añada en otro sitio, esto tiene que caerse.
 *
 * Lo segundo que vigila es lo ocupado. Un tramo mal leído no rompe nada
 * visible: sencillamente deja de chocar, y ofrecemos un hueco que ya estaba
 * cogido. Un fallo así solo se descubre cuando se presentan dos personas.
 */

const BASE: DatosEntrevista = {
  candidato: 'Alberto Herrera',
  puesto: 'Mozo/a de almacén',
  inicio: '2026-09-03T08:30:00.000Z',
  fin: '2026-09-03T09:00:00.000Z',
  timezone: 'Europe/Madrid',
  modo: 'presencial',
  lugar: 'Calle Mayor 3, Valencia',
  meetingUrl: null,
  fichaUrl: 'https://apuntatefacil.com/app/puestos/p1?candidato=c1',
}

describe('al candidato no se le invita', () => {
  it('el cuerpo del evento no lleva invitados', () => {
    const cuerpo = cuerpoEvento(construirEvento(BASE))
    expect(Object.keys(cuerpo)).not.toContain('attendees')
    expect(JSON.stringify(cuerpo)).not.toContain('attendee')
  })

  it('nadie mete invitados en el módulo de Google', () => {
    const FUENTES = import.meta.glob('../../supabase/functions/_shared/google/*.ts', {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>
    const rutas = Object.keys(FUENTES)
    expect(rutas.length, 'no se encuentra el módulo de Google').toBeGreaterThan(0)

    for (const [ruta, texto] of Object.entries(FUENTES)) {
      // Se admite nombrarlo en un comentario (ahí está escrito POR QUÉ no va),
      // no ponerlo en el cuerpo que se manda.
      const codigo = texto
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n')
      expect(
        /attendees|sendUpdates|sendNotifications/.test(codigo),
        `${ruta} añade invitados o avisos al evento. Eso hace que GOOGLE le escriba ` +
        'al candidato en nombre del empresario, con un texto que nadie ha aprobado. ' +
        'Lo que recibe el candidato sale por su canal.',
      ).toBe(false)
    }
  })
})

describe('el evento', () => {
  it('empieza por la persona, que es lo que distingue una cita de otra', () => {
    expect(construirEvento(BASE).titulo).toBe('Alberto Herrera · Entrevista Mozo/a de almacén')
  })

  it('en videollamada no escribe la dirección', () => {
    const ev = construirEvento({ ...BASE, modo: 'videollamada' })
    expect(ev.lugar).not.toContain('Calle Mayor')
  })

  it('pide Meet solo si es videollamada y no hay ya un enlace', () => {
    expect(construirEvento(BASE).conMeet).toBe(false)
    expect(construirEvento({ ...BASE, modo: 'videollamada' }).conMeet).toBe(true)
    expect(
      construirEvento({ ...BASE, modo: 'videollamada', meetingUrl: 'https://zoom.us/j/1' }).conMeet,
      'con un enlace ya puesto, crear otra sala deja media entrevista en la sala vacía',
    ).toBe(false)
  })

  it('solo pide conferencia cuando toca', () => {
    expect(cuerpoEvento(construirEvento(BASE)).conferenceData).toBeUndefined()
    expect(cuerpoEvento(construirEvento({ ...BASE, modo: 'videollamada' })).conferenceData).toBeTruthy()
  })

  it('manda la zona del anfitrión con las dos horas', () => {
    const cuerpo = cuerpoEvento(construirEvento(BASE)) as {
      start: { timeZone: string }; end: { timeZone: string }
    }
    // Sin zona, Google interpreta la hora en la del calendario y la cita se
    // mueve sola en el cambio de hora o vista desde Canarias.
    expect(cuerpo.start.timeZone).toBe('Europe/Madrid')
    expect(cuerpo.end.timeZone).toBe('Europe/Madrid')
  })
})

describe('el enlace de la videollamada', () => {
  it('lo lee del atajo y del desglose', () => {
    expect(enlaceMeet({ hangoutLink: 'https://meet.google.com/abc' })).toBe('https://meet.google.com/abc')
    expect(enlaceMeet({
      conferenceData: {
        entryPoints: [
          { entryPointType: 'phone', uri: 'tel:+34900' },
          { entryPointType: 'video', uri: 'https://meet.google.com/xyz' },
        ],
      },
    })).toBe('https://meet.google.com/xyz')
    expect(enlaceMeet({})).toBeNull()
  })
})

describe('lo ocupado', () => {
  const o = (a: string, b: string) => ({ start: new Date(a), end: new Date(b) })

  it('funde lo que se solapa y lo que solo se toca', () => {
    const r = fundirOcupado([
      o('2026-09-03T10:00:00Z', '2026-09-03T11:00:00Z'),
      o('2026-09-03T11:00:00Z', '2026-09-03T12:00:00Z'), // pegado
      o('2026-09-03T11:30:00Z', '2026-09-03T13:00:00Z'), // solapado
      o('2026-09-03T15:00:00Z', '2026-09-03T16:00:00Z'), // suelto
    ])
    expect(r).toHaveLength(2)
    expect(r[0].start.toISOString()).toBe('2026-09-03T10:00:00.000Z')
    expect(r[0].end.toISOString()).toBe('2026-09-03T13:00:00.000Z')
  })

  it('ordena lo que llega desordenado', () => {
    const r = fundirOcupado([
      o('2026-09-03T15:00:00Z', '2026-09-03T16:00:00Z'),
      o('2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z'),
    ])
    expect(r.map((x) => x.start.toISOString())).toEqual([
      '2026-09-03T09:00:00.000Z', '2026-09-03T15:00:00.000Z',
    ])
  })

  it('tira lo ilegible en vez de dejarlo pasar', () => {
    // Un intervalo con NaN no choca con NADA, así que colarlo no deja un hueco
    // raro: deja un hueco OCUPADO ofrecido como libre.
    const r = fundirOcupado([
      o('no-es-una-fecha', '2026-09-03T10:00:00Z'),
      o('2026-09-03T12:00:00Z', '2026-09-03T11:00:00Z'), // acaba antes de empezar
      o('2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z'),
    ])
    expect(r).toHaveLength(1)
  })

  it('no toca los originales', () => {
    const uno = o('2026-09-03T10:00:00Z', '2026-09-03T11:00:00Z')
    fundirOcupado([uno, o('2026-09-03T10:30:00Z', '2026-09-03T12:00:00Z')])
    expect(uno.end.toISOString(), 'fundir no puede reescribir lo que le pasan').toBe('2026-09-03T11:00:00.000Z')
  })
})

/**
 * EL SEGUNDO GUARDIÁN: la llave no sale al navegador.
 *
 * El refresh token de Google es una llave PERMANENTE al calendario de una
 * persona. Vive en el vault y solo lo alcanzan funciones con `grant ... to
 * service_role`, o sea el servidor. Nada de `src/` puede nombrarlas: lo que se
 * llama desde el cliente viaja con la sesión de quien mira, y el día que
 * alguien "solo para depurar" pida el secreto desde una pantalla, el token
 * acaba en el DevTools de cualquiera.
 *
 * No comprueba la RLS (eso se comprueba en la base, y se comprobó): comprueba
 * que nadie intente pedirlo desde el lado equivocado.
 */
describe('la llave se queda en el servidor', () => {
  const SOLO_SERVIDOR = [
    'calendar_connection_secret',
    'calendar_connection_save',
    'calendar_connection_delete',
    'calendar_connection_error',
    'calendar_oauth_state_new',
    'calendar_oauth_state_claim',
    'interview_calendar_payload',
    'interview_calendar_done',
  ]

  it('ninguna pantalla llama a lo que toca el token', () => {
    const FUENTES = import.meta.glob('../**/*.{ts,tsx}', {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>

    for (const [ruta, texto] of Object.entries(FUENTES)) {
      if (ruta.includes('.test.')) continue
      for (const rpc of SOLO_SERVIDOR) {
        expect(
          texto.includes(`'${rpc}'`),
          `${ruta} llama a "${rpc}" desde el navegador. Esa función está concedida ` +
          'solo a service_role y toca el refresh token de Google: se llama desde una ' +
          'edge function, nunca desde una pantalla.',
        ).toBe(false)
      }
    }
  })
})
