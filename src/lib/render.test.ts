import { describe, it, expect } from 'vitest'
// `render.ts` solo importa un tipo de `channels/types.ts`, así que lo carga
// vitest igual que schedule/ y guion/. Ver la cabecera de schedule.test.ts.
//
// Lo que importa aquí es que las etiquetas caben en lo que Meta permite (20 en
// un botón, 24 en el título de una fila, 72 en su descripción) y que el
// candidato pueda leer la lista sin adivinar de qué día es cada hora.
import {
  botonesVispera, diaConContexto, diaCorto, diaISO, diaLargo, donde, dondeODecirlo, enlaceMapa,
  fechaCorta, filasDias, filasHorarios, hora, textoAsistenciaConfirmada,
  textoConfirmacion, textoVispera,
} from '../../supabase/functions/_shared/whatsapp/render'

const MADRID = 'Europe/Madrid'
const CANARIAS = 'Atlantic/Canary'
const CONV = '11111111-2222-3333-4444-555555555555'

const cita = (iso: string) => ({ starts_at: iso, ends_at: iso })

describe('diaLargo', () => {
  it('escribe el día en la zona de la entrevista, no en la del servidor', () => {
    // 22:30 UTC del 3 de agosto ya es día 4 en Madrid (+2 en verano) pero sigue
    // siendo día 3 en Canarias (+1). Un solo instante, dos días distintos.
    expect(diaLargo('2026-08-03T22:30:00Z', MADRID)).toBe('martes, 4 de agosto')
    expect(diaLargo('2026-08-03T22:30:00Z', CANARIAS)).toBe('lunes, 3 de agosto')
  })

  it('la semana del cambio de hora no desplaza el día', () => {
    // El cambio de octubre de 2026 es el domingo 25.
    expect(diaLargo('2026-10-26T08:00:00Z', MADRID)).toBe('lunes, 26 de octubre')
    expect(hora('2026-10-26T08:00:00Z', MADRID)).toBe('09:00')
  })
})

// El paso 1: el día. Su identificador lleva la FECHA dentro, así que al volver
// no hay que adivinar a qué contestaba.
describe('filasDias', () => {
  const dias = [
    { primero: '2026-08-04T07:00:00Z', cuantos: 18 },
    { primero: '2026-08-05T07:00:00Z', cuantos: 1 },
  ]

  it('el identificador lleva la conversación y la fecha del anfitrión', () => {
    expect(filasDias(CONV, dias, MADRID).map((f) => f.id))
      .toEqual([`c:${CONV}:d:2026-08-04`, `c:${CONV}:d:2026-08-05`])
  })

  // Un instante, dos fechas según la zona: la que vale es la del anfitrión, que
  // es de quien es la agenda.
  it('la fecha es la del anfitrión, no la de UTC', () => {
    const tarde = [{ primero: '2026-08-03T22:30:00Z', cuantos: 3 }]
    expect(filasDias(CONV, tarde, MADRID)[0].id).toBe(`c:${CONV}:d:2026-08-04`)
    expect(filasDias(CONV, tarde, CANARIAS)[0].id).toBe(`c:${CONV}:d:2026-08-03`)
  })

  it('dice cuánto hay ese día, para que no elija a ciegas', () => {
    const filas = filasDias(CONV, dias, MADRID)
    expect(filas[0].descripcion).toBe('18 horas libres')
    expect(filas[1].descripcion).toBe('1 hora libre')
  })

  it('el título cabe en un botón', () => {
    for (const f of filasDias(CONV, dias, MADRID)) {
      expect(f.titulo.length).toBeLessThanOrEqual(20)
    }
    expect(diaCorto('2026-08-04T07:00:00Z', MADRID)).toBe('mar 4 ago')
  })
})

// El fallo que dio origen a todo esto: la cita se cerraba y el mensaje decía
// "Presencial", que contesta a CÓMO es la entrevista fingiendo contestar a
// DÓNDE. El candidato se quedaba con una hora y ningún sitio al que ir.
describe('donde', () => {
  it('sin dirección devuelve VACÍO, nunca la palabra "Presencial"', () => {
    expect(donde('presencial', '', null)).toBe('')
    expect(donde('presencial', '   ', null)).toBe('')
  })

  it('con dirección, la dirección', () => {
    expect(donde('presencial', 'Calle Marina 32, nave 4', null)).toBe('Calle Marina 32, nave 4')
  })

  it('videollamada y teléfono siguen contestando lo suyo', () => {
    expect(donde('videollamada', '', 'https://meet.example.com/x'))
      .toBe('Videollamada: https://meet.example.com/x')
    expect(donde('videollamada', '', null)).toBe('Por videollamada')
    expect(donde('telefonica', '', null)).toBe('Te llamamos por teléfono')
  })

  // Una variable vacía tumba la plantilla ENTERA en Meta (132000), así que el
  // recordatorio no llegaría en absoluto. Aquí el hueco se rellena diciendo la
  // verdad, no con una palabra de relleno.
  it('la versión de plantilla nunca va vacía', () => {
    expect(dondeODecirlo('presencial', '', null)).toBe('Te confirmamos la dirección por aquí')
    expect(dondeODecirlo('presencial', 'Nave 4', null)).toBe('Nave 4')
  })
})

describe('textoConfirmacion', () => {
  const base = ['Ana', 'Obras Solera', '2026-08-04T08:00:00Z', MADRID] as const

  it('con punto de mapa, la dirección a secas: el pin va detrás', () => {
    const t = textoConfirmacion(...base, 'presencial', 'Calle Marina 32, nave 4', null, true)
    expect(t).toContain('Dónde: Calle Marina 32, nave 4')
    expect(t).not.toContain('http')
  })

  it('sin punto, la dirección se puede tocar igual', () => {
    const t = textoConfirmacion(...base, 'presencial', 'Calle Marina 32, nave 4', null, false)
    expect(t).toContain('Dónde: Calle Marina 32, nave 4')
    expect(t).toContain(enlaceMapa('Calle Marina 32, nave 4'))
  })

  it('sin dirección lo dice, y no se inventa un sitio ni se calla', () => {
    const t = textoConfirmacion(...base, 'presencial', '', null, false)
    expect(t).toContain('Es presencial. Te decimos la dirección exacta por aquí antes de la cita.')
    expect(t).not.toContain('Dónde:')
    // La hora, que es lo que sí sabemos, sigue estando.
    expect(t).toContain('10:00')
  })

  it('una videollamada no habla de direcciones', () => {
    const t = textoConfirmacion(...base, 'videollamada', '', 'https://meet.example.com/x', false)
    expect(t).toContain('Videollamada: https://meet.example.com/x')
    expect(t).not.toContain('presencial')
  })
})

// El aviso del día antes. Existe porque el de 2 horas avisa cuando ya no da
// tiempo a nada: si al candidato le ha surgido algo, a esas horas lo único que
// puede hacer es no presentarse.
describe('el aviso de la víspera', () => {
  it('pregunta, en vez de solo recordar', () => {
    const t = textoVispera('Ana', 'Peón de albañil', '2026-08-04T08:00:00Z', MADRID, 'Nave 4')
    expect(t).toContain('Mañana es tu entrevista')
    expect(t).toContain('Dónde: Nave 4')
    expect(t).toContain('sigue en pie')
  })

  // Los `like` que enrutan los botones son prefijos, así que dos cargas que se
  // solapen mandarían al candidato por el camino de otra cosa sin avisar.
  it('sus botones no chocan con los que ya existen', () => {
    const [ok, mover] = botonesVispera(CONV)
    expect(ok).toBe(`c:${CONV}:ok`)
    expect(mover).toBe(`c:${CONV}:mover`)
    for (const carga of [ok, mover]) {
      expect(carga.startsWith(`c:${CONV}:s:`)).toBe(false)
      expect(carga.startsWith(`c:${CONV}:d:`)).toBe(false)
      expect(carga.startsWith(`c:${CONV}:no`)).toBe(false)
      expect(carga.startsWith(`c:${CONV}:ver`)).toBe(false)
      expect(carga.startsWith(`c:${CONV}:pregunta`)).toBe(false)
    }
  })

  it('al confirmar se le contesta una vez y con su hora', () => {
    expect(textoAsistenciaConfirmada('2026-08-04T08:00:00Z', MADRID))
      .toContain('te esperamos el martes, 4 de agosto a las 10:00')
  })
})

describe('enlaceMapa', () => {
  it('escapa la dirección, que lleva comas y espacios', () => {
    expect(enlaceMapa('Calle Marina 32, nave 4'))
      .toBe('https://www.google.com/maps/search/?api=1&query=Calle%20Marina%2032%2C%20nave%204')
  })
})

describe('diaISO', () => {
  it('da la fecha civil de la zona, en formato ordenable', () => {
    expect(diaISO('2026-08-03T22:30:00Z', MADRID)).toBe('2026-08-04')
    expect(diaISO('2026-08-03T22:30:00Z', CANARIAS)).toBe('2026-08-03')
    expect(diaISO('2026-01-05T09:00:00Z', MADRID)).toBe('2026-01-05')
  })
})

describe('filasHorarios', () => {
  it('con días distintos, cada fila lleva su fecha', () => {
    const filas = filasHorarios(CONV, [
      cita('2026-08-04T07:00:00Z'), cita('2026-08-05T10:00:00Z'),
    ], MADRID, 30)
    expect(filas[0].titulo).toBe(fechaCorta('2026-08-04T07:00:00Z', MADRID))
    expect(filas[0].descripcion).toBe('30 minutos')
  })

  // Cuando preguntó por un día concreto, repetir la fecha en las diez filas se
  // come el título entero y no deja ver lo único que cambia: la hora.
  it('con todo del mismo día, el título es la hora y el día va debajo', () => {
    const filas = filasHorarios(CONV, [
      cita('2026-08-05T07:00:00Z'), cita('2026-08-05T07:30:00Z'), cita('2026-08-05T14:00:00Z'),
    ], MADRID, 30)
    expect(filas.map((f) => f.titulo)).toEqual(['09:00', '09:30', '16:00'])
    for (const f of filas) expect(f.descripcion).toBe('miércoles, 5 de agosto, 30 minutos')
  })

  it('una sola fila conserva la fecha, que si no se pierde', () => {
    const [f] = filasHorarios(CONV, [cita('2026-08-05T07:00:00Z')], MADRID, 30)
    expect(f.titulo).toBe(fechaCorta('2026-08-05T07:00:00Z', MADRID))
  })

  it('los identificadores llevan dentro la conversación y la posición', () => {
    const filas = filasHorarios(CONV, [cita('2026-08-04T07:00:00Z'), cita('2026-08-05T10:00:00Z')], MADRID, 30)
    expect(filas.map((f) => f.id)).toEqual([`c:${CONV}:s:0`, `c:${CONV}:s:1`])
  })

  // Meta recorta en silencio lo que se pase: si un título no cabe, el candidato
  // ve una etiqueta cortada a media palabra y no sabe qué está eligiendo.
  it('todo cabe en lo que Meta permite', () => {
    const largas = Array.from({ length: 10 }, (_, i) =>
      cita(`2026-12-0${(i % 5) + 1}T${String(7 + i).padStart(2, '0')}:00:00Z`))
    for (const f of filasHorarios(CONV, largas, MADRID, 120)) {
      expect(f.titulo.length).toBeLessThanOrEqual(20) // el tope del botón, más estricto
      expect((f.descripcion ?? '').length).toBeLessThanOrEqual(72)
    }
  })
})

// El agente no sabía qué día es hoy. A "este lunes" contestó "sí, este lunes 10
// de agosto" cuando ese lunes era el de la semana siguiente y el bueno estaba en
// su propia agenda. Estas etiquetas solo las lee el modelo: al candidato le
// siguen llegando las fechas de siempre.
describe('diaConContexto', () => {
  // Domingo 2 de agosto de 2026, a media tarde en Madrid.
  const domingo = new Date('2026-08-02T16:00:00.000Z')

  it('nombra hoy, mañana y pasado', () => {
    expect(diaConContexto('2026-08-02T09:00:00.000Z', MADRID, domingo)).toBe('hoy, domingo 2 de agosto')
    expect(diaConContexto('2026-08-03T09:00:00.000Z', MADRID, domingo))
      .toBe('mañana, este lunes 3 de agosto')
    expect(diaConContexto('2026-08-04T09:00:00.000Z', MADRID, domingo))
      .toBe('pasado mañana, este martes 4 de agosto')
  })

  it('distingue los dos lunes, que es todo el asunto', () => {
    expect(diaConContexto('2026-08-03T09:00:00.000Z', MADRID, domingo)).toContain('este lunes')
    expect(diaConContexto('2026-08-10T09:00:00.000Z', MADRID, domingo))
      .toBe('el lunes que viene, 10 de agosto')
  })

  it('el resto de esta semana va como "este"', () => {
    expect(diaConContexto('2026-08-06T09:00:00.000Z', MADRID, domingo)).toBe('este jueves 6 de agosto')
  })

  it('más allá de dos semanas no se etiqueta, que ya no lo diría nadie así', () => {
    expect(diaConContexto('2026-08-20T09:00:00.000Z', MADRID, domingo)).toBe('jueves, 20 de agosto')
  })

  // Se comparan fechas civiles, no milisegundos: a última hora de la tarde la
  // resta de instantes daría menos de un día y "mañana" saldría como "hoy".
  it('cuenta días de calendario y no horas', () => {
    const casiMedianoche = new Date('2026-08-02T21:30:00.000Z') // 23:30 en Madrid
    expect(diaConContexto('2026-08-03T07:00:00.000Z', MADRID, casiMedianoche))
      .toBe('mañana, este lunes 3 de agosto')
  })

  it('cuenta en la zona de la entrevista, no en la del servidor', () => {
    // En agosto Madrid va a UTC+2 y Canarias a UTC+1, así que a las 22:30 UTC
    // en Madrid ya es lunes (00:30) y en Canarias todavía es domingo (23:30).
    const t = new Date('2026-08-02T22:30:00.000Z')
    expect(diaConContexto('2026-08-03T10:00:00.000Z', CANARIAS, t)).toContain('mañana')
    expect(diaConContexto('2026-08-03T10:00:00.000Z', MADRID, t)).toContain('hoy')
  })
})
