import { describe, it, expect } from 'vitest'
// El guion del agente no importa nada de red, así que lo carga vitest igual que
// schedule/ y channels/. Ver la cabecera de schedule.test.ts.
//
// Lo que se prueba aquí NO es la IA (eso no se puede probar), sino las dos
// fronteras que hacen que la IA se pueda soltar a hablar con un candidato:
//
//   * `revisar`, que impide que salga un dato que no le hemos dado.
//   * `normalizarRespuesta` y `conAntecedentes`, que impiden que lo que
//     proponga acabe moviendo algo que no debía.
import {
  citaPrometida, conAntecedentes, construirConversacion, construirSistema,
  normalizarRespuesta, revisar, totalAgenda,
  type Hechos, type Respuesta,
} from '../../supabase/functions/_shared/interviews/guion'

const HECHOS: Hechos = {
  empresa: 'Solera Canarias',
  puesto: 'Peón de albañil',
  ubicacion: 'Las Palmas',
  candidato: 'Ana',
  anfitrion: 'Luis Gómez',
  estado: 'proponiendo_horarios',
  hoy: 'lunes, 3 de agosto',
  citaTexto: null,
  donde: null,
  duracion: 30,
  agenda: [
    { dia: 'martes 4 de agosto', horas: [{ indice: 0, hora: '09:00' }, { indice: 1, hora: '12:00' }] },
    { dia: 'miércoles 5 de agosto', horas: [{ indice: 2, hora: '16:30' }] },
  ],
  huecos: [
    { indice: 0, cuando: 'martes, 4 de agosto a las 09:00' },
    { indice: 2, cuando: 'miércoles, 5 de agosto a las 16:30' },
  ],
  enlaces: [],
}

const CERRADA: Hechos = {
  ...HECHOS,
  estado: 'entrevista_confirmada',
  citaTexto: 'martes, 4 de agosto a las 09:00',
  donde: 'Videollamada: https://meet.example.com/abc-def',
  huecos: [],
  enlaces: ['https://meet.example.com/abc-def'],
}

const ok = (m: string, h: Hechos = HECHOS) => revisar(m, h).ok

describe('revisar: horas', () => {
  it('deja pasar una hora que sí le hemos dado', () => {
    expect(ok('Te apunto el martes a las 09:00 entonces.')).toBe(true)
  })

  // El peor error posible del agente, y por eso es la primera prueba: citar a
  // alguien a una hora que no existe le hace perder una mañana de trabajo.
  it('para una hora inventada', () => {
    expect(ok('Te veo el martes a las 11:45.')).toBe(false)
  })

  it('9:00 y 09:00 son la misma hora', () => {
    expect(ok('Quedamos a las 9:00.')).toBe(true)
    expect(ok('Quedamos a las 9:30.')).toBe(false)
  })
})

describe('revisar: días y fechas', () => {
  it('deja pasar los días ofrecidos', () => {
    expect(ok('Puedes el martes o el miércoles, como prefieras.')).toBe(true)
  })

  it('los acentos no abren un agujero', () => {
    // La ficha dice "miércoles". Si comparásemos en crudo, "miercoles" pasaría
    // por día inventado y se caería una respuesta correcta.
    expect(ok('El miercoles me viene bien a mí también.')).toBe(true)
  })

  it('para un día que no está ofrecido', () => {
    expect(ok('Nos vemos el viernes.')).toBe(false)
  })

  it('para una fecha que no está ofrecida', () => {
    expect(ok('Sería el 12 de agosto.')).toBe(false)
    expect(ok('Sería el 4 de agosto.')).toBe(true)
  })
})

describe('revisar: dinero', () => {
  // Del sueldo no sabemos NADA, así que cualquier cifra en euros solo puede
  // habérsela inventado.
  it('para cualquier cantidad en euros', () => {
    expect(ok('Son unos 1.200 € al mes.')).toBe(false)
    expect(ok('Pagan 12€/hora.')).toBe(false)
    expect(ok('El sueldo es de €1400.')).toBe(false)
    expect(ok('Son 9 euros la hora.')).toBe(false)
  })

  // Lo que se prohíbe es la CIFRA, no la palabra: el agente tiene que poder
  // decir que no sabe el sueldo, que es justo su respuesta honesta.
  it('deja hablar del sueldo sin dar una cifra', () => {
    expect(ok('Del sueldo no tengo el dato, te lo cuentan en la entrevista.')).toBe(true)
  })
})

describe('revisar: enlaces, correos y teléfonos', () => {
  it('para un enlace inventado', () => {
    expect(ok('Entra en https://solera-canarias.com/entrevista')).toBe(false)
  })

  it('deja pasar el enlace de la videollamada que le hemos dado', () => {
    expect(ok('Te conectas en https://meet.example.com/abc-def', CERRADA)).toBe(true)
  })

  it('para un correo', () => {
    expect(ok('Escríbenos a rrhh@solera.com')).toBe(false)
  })

  it('para un teléfono', () => {
    expect(ok('Llama al 612 345 678 si no puedes.')).toBe(false)
  })
})

// Salió en producción: el agente contestó "podemos cambiarla al viernes 7 de
// agosto a las 10:00" y debajo le pegó tres botones que no eran ese viernes. El
// horario era cierto cuando lo escribió, pero la lista se calcula DESPUÉS, así
// que la cabecera se revisa contra la tanda que de verdad va a salir.
describe('revisar: la cabecera se juzga contra los horarios que van a salir', () => {
  // Es lo que construye `ofrecerHorarios`: la ficha ESTRECHADA a la tanda que va
  // a salir debajo, agenda incluida. Si solo se estrechara `huecos`, la agenda
  // seguiría avalando horarios que ya no están entre los botones.
  const tandaNueva: Hechos = {
    ...HECHOS,
    agenda: [
      { dia: 'miércoles 5 de agosto', horas: [{ indice: 0, hora: '09:00' }] },
      { dia: 'lunes 10 de agosto', horas: [{ indice: 1, hora: '12:00' }] },
    ],
    huecos: [
      { indice: 0, cuando: 'miércoles, 5 de agosto a las 09:00' },
      { indice: 1, cuando: 'lunes, 10 de agosto a las 12:00' },
    ],
  }

  it('para el horario que ya no está en la tanda', () => {
    const m = 'Sí, podemos cambiarla al martes 4 de agosto a las 09:00. ¿Te viene bien?'
    expect(ok(m)).toBe(true)                  // era cierto con los horarios de antes
    expect(revisar(m, tandaNueva).ok).toBe(false) // ya no lo es con los de ahora
  })

  // Y lo que esto compra: puede hablar de la tanda nueva con naturalidad en vez
  // de soltar la frase neutra de siempre.
  it('deja pasar una cabecera que sí encaja con la tanda', () => {
    expect(revisar('Ese martes solo me queda el miércoles a las 09:00, ¿te sirve?',
      tandaNueva, { dichoPorEl: ['me viene bien el martes pero no a esa hora'] }).ok).toBe(true)
  })
})

// El otro caso real: preguntó "¿puedes el sábado?" dos veces y las dos recibió
// la misma frase enlatada, porque "sábado" no estaba en la ficha y el filtro
// tumbaba la respuesta honesta.
describe('revisar: puede devolverle sus propias palabras', () => {
  it('contestar que un día no lo tenemos deja de ser inventárselo', () => {
    const m = 'El sábado no tenemos hueco, lo siento. ¿Te encaja alguno de los otros?'
    expect(ok(m)).toBe(false)
    expect(revisar(m, HECHOS, { dichoPorEl: ['La quiero el sabado'] }).ok).toBe(true)
  })

  // Lo que NO se relaja: las horas. Es lo que hace que alguien se plante un día
  // a una hora que no era.
  it('pero no puede darle una hora por el hecho de que él la haya dicho', () => {
    expect(revisar('Perfecto, te espero a las 17:30.', HECHOS,
      { dichoPorEl: ['puedo a las 17:30'] }).ok).toBe(false)
  })
})

// Lo que compra meter la agenda entera en la ficha. En producción, a "qué horas
// tienes el miércoles" el agente contestó "no tengo ningún hueco el miércoles",
// que era FALSO: solo veía los tres huecos ofrecidos.
describe('revisar: ahora conoce la agenda, no solo lo ofrecido', () => {
  it('deja pasar una hora libre aunque no se la hubiéramos ofrecido', () => {
    expect(ok('El martes también tengo libre a las 12:00, ¿te va mejor?')).toBe(true)
  })

  it('sigue parando una hora que no está en ningún sitio', () => {
    expect(ok('El martes tengo a las 18:45.')).toBe(false)
  })

  // El agujero que abre ampliar la ficha, y que hay que cerrar: la ficha es una
  // bolsa plana, así que sin emparejar, "el jueves a las 16:00" pasaría por
  // tener un jueves en un sitio y unas 16:00 en otro.
  it('no puede dar una hora de OTRO día', () => {
    const r = revisar('El martes te puedo dar las 16:30.', HECHOS)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.motivo).toContain('no es de martes 4 de agosto')
  })

  it('la misma hora sí pasa si es del día que nombra', () => {
    expect(ok('El miércoles te puedo dar las 16:30.')).toBe(true)
  })

  // Con varios días nombrados no se puede saber a cuál se refiere cada hora, así
  // que se vuelve a la comprobación de unión: preferimos dejar pasar una
  // respuesta correcta a tumbarla por no saber.
  it('con dos días nombrados no tumba una respuesta correcta', () => {
    expect(ok('Tengo el martes a las 09:00 y el miércoles a las 16:30.')).toBe(true)
  })

  it('la hora de la entrevista ya cerrada se puede decir siempre', () => {
    expect(ok('Tu entrevista del martes sigue a las 09:00.', CERRADA)).toBe(true)
  })
})

describe('revisar: forma', () => {
  it('para un mensaje vacío', () => {
    expect(ok('   ')).toBe(false)
  })

  // Un WhatsApp kilométrico no lo lee nadie, y además es la señal típica de que
  // el modelo se ha puesto a redactar por su cuenta.
  it('para un ladrillo', () => {
    expect(ok('Hola. '.repeat(200))).toBe(false)
  })

  it('deja pasar una respuesta honesta y normal', () => {
    expect(ok(
      'Soy el asistente de Solera Canarias y me encargo de organizar las entrevistas, ' +
      'así que del contrato no tengo el detalle. Te lo resuelven ellos. ¿Te va bien alguno de los dos?',
    )).toBe(true)
  })
})

// ---------------------------------------------------------------------------

const crudo = (p: Record<string, unknown>) => ({
  accion: 'contestar', hueco: null, mensaje: 'Vale.', confianza: 'alta', aclaracion: false, ...p,
})

describe('normalizarRespuesta', () => {
  it('acepta una respuesta bien formada', () => {
    const r = normalizarRespuesta(crudo({ accion: 'reservar', hueco: 1 }), 2)
    expect(r.accion).toEqual({ tipo: 'reservar', hueco: 1 })
  })

  // Lo importante: un índice fuera de rango NO puede acabar reservando un hueco
  // que no existe, aunque el esquema estricto "no debería" permitirlo.
  it('un hueco fuera de rango no reserva nada', () => {
    expect(normalizarRespuesta(crudo({ accion: 'reservar', hueco: 7 }), 2).accion)
      .toEqual({ tipo: 'ofrecer_horarios', mostrar: [] })
    expect(normalizarRespuesta(crudo({ accion: 'reservar', hueco: -1 }), 2).accion)
      .toEqual({ tipo: 'ofrecer_horarios', mostrar: [] })
    expect(normalizarRespuesta(crudo({ accion: 'reservar', hueco: null }), 2).accion)
      .toEqual({ tipo: 'ofrecer_horarios', mostrar: [] })
  })

  // Con dudas se HABLA, no se actúa. Es la diferencia entre un agente prudente
  // y uno que deja al candidato colgado: sigue contestando, pero no mueve nada.
  it('con confianza baja no se mueve nada, se pregunta', () => {
    const r = normalizarRespuesta(crudo({ accion: 'cancelar', confianza: 'baja' }), 2)
    expect(r.accion).toEqual({ tipo: 'contestar' })
    expect(r.aclaracion).toBe(true)
  })

  it('un enum inventado es una respuesta rota, no una intención rara', () => {
    expect(normalizarRespuesta(crudo({ accion: 'despedir_al_jefe' }), 2).accion.tipo)
      .toBe('a_una_persona')
  })

  it('pedir hablar con alguien del equipo se respeta', () => {
    expect(normalizarRespuesta(crudo({ accion: 'persona' }), 2).accion.tipo).toBe('a_una_persona')
  })

  // `mostrar` es cómo el modelo elige qué horarios enseñar. Un índice malo NO
  // puede romper la respuesta: degradar aquí es enseñarle menos, no dejarle sin
  // contestación.
  it('mostrar: tira los índices que no existen, sin romperse', () => {
    const r = normalizarRespuesta(crudo({ accion: 'ofrecer_horarios', mostrar: [0, 99, -3, 2] }), 3)
    expect(r.accion).toEqual({ tipo: 'ofrecer_horarios', mostrar: [0, 2] })
  })

  it('mostrar: deduplica, ordena y corta a las 10 filas de WhatsApp', () => {
    const r = normalizarRespuesta(
      crudo({ accion: 'ofrecer_horarios', mostrar: [5, 1, 5, 3, 1] }), 20)
    expect(r.accion).toEqual({ tipo: 'ofrecer_horarios', mostrar: [1, 3, 5] })

    const muchos = normalizarRespuesta(
      crudo({ accion: 'ofrecer_horarios', mostrar: Array.from({ length: 30 }, (_, i) => i) }), 30)
    expect((muchos.accion as { mostrar: number[] }).mostrar).toHaveLength(10)
  })

  it('mostrar: lo que no es una lista se trata como vacío', () => {
    for (const m of [null, 'tres', 7, {}]) {
      expect(normalizarRespuesta(crudo({ accion: 'ofrecer_horarios', mostrar: m }), 3).accion)
        .toEqual({ tipo: 'ofrecer_horarios', mostrar: [] })
    }
  })

  // "Reservo uno de estos" sin decir cuál: enseñarle ESOS es mejor que
  // enseñarle otros distintos.
  it('reservar sin hueco conserva lo que quería enseñar', () => {
    const r = normalizarRespuesta(crudo({ accion: 'reservar', hueco: null, mostrar: [1, 2] }), 5)
    expect(r.accion).toEqual({ tipo: 'ofrecer_horarios', mostrar: [1, 2] })
  })

  it('el hueco se valida contra la agenda, no contra lo ofrecido', () => {
    // 7 no existe con 3 huecos de agenda...
    expect(normalizarRespuesta(crudo({ accion: 'reservar', hueco: 7 }), 3).accion.tipo)
      .toBe('ofrecer_horarios')
    // ...y sí existe con 20, aunque solo se le hubieran enseñado tres.
    expect(normalizarRespuesta(crudo({ accion: 'reservar', hueco: 7 }), 20).accion)
      .toEqual({ tipo: 'reservar', hueco: 7 })
  })

  it('recorta un mensaje kilométrico en vez de romperse', () => {
    expect(normalizarRespuesta(crudo({ mensaje: 'a'.repeat(9000) }), 0).mensaje.length).toBe(1500)
  })
})

describe('totalAgenda', () => {
  it('cuenta las horas de todos los días', () => {
    expect(totalAgenda(HECHOS)).toBe(3)
    expect(totalAgenda({ ...HECHOS, agenda: [] })).toBe(0)
  })
})

describe('conAntecedentes', () => {
  const preguntando: Respuesta = {
    accion: { tipo: 'contestar' }, mensaje: '¿Me lo repites?', confianza: 'baja', aclaracion: true,
  }

  it('preguntar una vez es atender', () => {
    expect(conAntecedentes(preguntando, false).accion).toEqual({ tipo: 'contestar' })
  })

  // Sin esto, quien escribe de una forma que el modelo no pilla se queda en un
  // bucle de "¿me lo repites?" hasta que se cansa y se va.
  it('preguntar dos veces seguidas es marear, y ahí sí para una persona', () => {
    expect(conAntecedentes(preguntando, true).accion.tipo).toBe('a_una_persona')
  })

  it('una respuesta normal no se ve afectada por lo anterior', () => {
    const normal: Respuesta = {
      accion: { tipo: 'reservar', hueco: 0 }, mensaje: 'Hecho.', confianza: 'alta', aclaracion: false,
    }
    expect(conAntecedentes(normal, true).accion).toEqual({ tipo: 'reservar', hueco: 0 })
  })
})

describe('construirConversacion', () => {
  const hilo = [
    { quien: 'agente' as const, texto: 'Hola Ana, ¿te viene bien una entrevista?' },
    { quien: 'candidato' as const, texto: 'a ver' },
  ]

  // Lo que arregla la agrupación: en un chat la gente suelta la idea a trozos.
  it('junta los mensajes seguidos y pide UNA respuesta', () => {
    const u = construirConversacion(hilo, ['hola', 'vi el anuncio', '¿sigue abierto?'])
    expect(u).toContain('Sus 3 últimos mensajes')
    expect(u).toContain('con un solo mensaje')
    expect(u).toContain('hola\nvi el anuncio\n¿sigue abierto?')
  })

  it('con uno solo no habla de varios', () => {
    const u = construirConversacion(hilo, ['¿sigue abierto?'])
    expect(u).toContain('Su último mensaje')
    expect(u).not.toContain('JUNTOS')
  })

  it('no cuenta los vacíos como mensajes', () => {
    expect(construirConversacion(hilo, ['hola', '   '])).toContain('Su último mensaje')
  })

  it('el hilo anterior va etiquetado por quién habló', () => {
    const u = construirConversacion(hilo, ['sí'])
    expect(u).toContain('TÚ: Hola Ana, ¿te viene bien una entrevista?')
    expect(u).toContain('ÉL: a ver')
  })
})

describe('construirSistema', () => {
  it('le da la agenda por días, con el número pegado a cada hora', () => {
    const s = construirSistema(HECHOS)
    expect(s).toContain('martes 4 de agosto: 0 09:00, 1 12:00')
    expect(s).toContain('miércoles 5 de agosto: 2 16:30')
    // Y cuáles tiene delante, por número: no hace falta repetir las fechas.
    expect(s).toContain('Horarios que tiene delante ahora mismo: 0, 2')
  })

  // Es lo que le permite decir la verdad en vez de callarse.
  it('sin agenda lo dice, no se queda mudo', () => {
    expect(construirSistema({ ...HECHOS, agenda: [], huecos: [] }))
      .toContain('No tienes ningún hueco libre')
  })

  it('cuando no sabemos el nombre, se lo dice en vez de dejarlo en blanco', () => {
    const s = construirSistema({ ...HECHOS, candidato: null })
    expect(s).toContain('no sabemos su nombre')
    expect(s).not.toContain('Candidato: Ana')
  })

  it('cambia de objetivo cuando la entrevista ya está cerrada', () => {
    expect(construirSistema(HECHOS)).toContain('Que elija uno de los horarios')
    expect(construirSistema(CERRADA)).toContain('ya está cerrada')
  })

  // "¿Dónde es?" se pregunta muchas veces ANTES de elegir hora: si está a 40 km
  // eso cambia qué día te viene bien. Antes el sitio solo entraba en la ficha
  // con la cita ya cerrada, así que el agente no lo tenía delante justo cuando
  // más falta hacía.
  it('sabe dónde es aunque la cita no esté cerrada todavía', () => {
    const s = construirSistema({ ...HECHOS, donde: 'Calle Marina 32, nave 4' })
    expect(s).toContain('Dónde es la entrevista: Calle Marina 32, nave 4')
    expect(s).toContain('Entrevista: todavía sin día ni hora.')
  })

  it('si no tenemos dirección, se lo dice, para que no la invente', () => {
    const s = construirSistema(HECHOS)
    expect(s).toContain('Dónde es la entrevista: TODAVÍA NO LO SABES')
  })

  // La trampa: la zona del anuncio ("Las Palmas") está en la ficha al lado del
  // puesto, y contestar "es en Las Palmas" a "¿dónde tengo que ir?" pasaría
  // cualquier filtro siendo inútil.
  it('avisa de que la zona del anuncio no es una dirección', () => {
    expect(construirSistema(HECHOS)).toContain('la zona del anuncio, no una dirección')
  })
})

describe('revisar: la dirección', () => {
  const CON_SITIO: Hechos = { ...HECHOS, donde: 'Calle Marina 32, nave 4, 35008 Las Palmas' }

  it('puede decir la dirección que le hemos dado', () => {
    expect(revisar('Es en Calle Marina 32, nave 4, 35008 Las Palmas.', CON_SITIO).ok).toBe(true)
  })

  // El número de portal y el código postal no pueden confundirse con un
  // teléfono ni con una hora, o la respuesta correcta se caería.
  it('el portal y el código postal no cuentan como número inventado', () => {
    expect(revisar('Te esperamos en el 32, el código postal es 35008.', CON_SITIO).ok).toBe(true)
  })

  it('sigue sin poder inventarse otra dirección', () => {
    // Un enlace de mapa que no le hemos dado es indistinguible de una estafa.
    expect(revisar('Te paso el mapa: https://maps.google.com/?q=inventado', CON_SITIO).ok).toBe(false)
  })

  it('el enlace del mapa sí, cuando se lo hemos dado', () => {
    const conEnlace: Hechos = {
      ...CON_SITIO,
      enlaces: ['https://www.google.com/maps/search/?api=1&query=Calle%20Marina%2032'],
    }
    expect(revisar(
      'Aquí lo tienes: https://www.google.com/maps/search/?api=1&query=Calle%20Marina%2032',
      conEnlace,
    ).ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Mover una cita: los dos fallos de la conversación del 2 de agosto
// ---------------------------------------------------------------------------
//
// Reproducidos con los datos reales. Con la cita cerrada el LUNES 10 a las
// 17:00, el candidato pidió "este lunes" (que era el 3) y el agente escribió
// "te la cambio al lunes 3 a las 17:00" mientras el sistema le pegaba debajo
// tres botones de DÍA. O sea: le dio una hora y acto seguido se la pidió.

// Con horizonte de diez días hay DOS lunes en la agenda, que es lo que
// desactivaba el emparejamiento hora-día.
const DOS_LUNES: Hechos = {
  ...HECHOS,
  hoy: 'domingo, 2 de agosto',
  estado: 'entrevista_confirmada',
  citaTexto: 'lunes, 10 de agosto a las 17:00',
  huecos: [],
  agenda: [
    {
      dia: 'mañana, este lunes 3 de agosto',
      horas: [
        { indice: 0, hora: '09:00' }, { indice: 1, hora: '12:00' },
        { indice: 2, hora: '14:30' }, { indice: 3, hora: '17:30' },
      ],
    },
    { dia: 'el lunes que viene, 10 de agosto', horas: [{ indice: 4, hora: '09:00' }] },
  ],
}

describe('revisar: la hora de la cita no vale para OTRO día', () => {
  it('tumba la frase exacta que salió en producción', () => {
    // Las 17:00 existen, pero son las del lunes 10. El lunes 3 no las tiene, y
    // antes colaba porque la hora de la cita cerrada se admitía hablando de
    // cualquier día. El candidato recibió una hora que nadie le había guardado.
    expect(revisar('Te la cambio al lunes 3 a las 17:00.', DOS_LUNES).ok).toBe(false)
  })

  it('la fecha manda sobre el nombre del día', () => {
    // Sin esto, "lunes" señalaba los dos lunes de la agenda, y con dos días
    // señalados el emparejamiento se desactivaba solo.
    expect(revisar('El lunes 3 te puedo dar las 09:00.', DOS_LUNES).ok).toBe(true)
    expect(revisar('El lunes 3 te puedo dar las 20:00.', DOS_LUNES).ok).toBe(false)
  })

  it('pero sí puede repetir la cita que ya tiene', () => {
    expect(revisar('Sí, sigue en pie el lunes 10 de agosto a las 17:00.', DOS_LUNES).ok).toBe(true)
  })
})

describe('citaPrometida', () => {
  it('reconoce la hora prometida y devuelve su hueco', () => {
    // Con esto, debajo sale ESA hora y nada más: aceptar le da lo que leyó.
    expect(citaPrometida('Te la cambio al lunes 3 a las 14:30.', DOS_LUNES)).toBe(2)
  })

  it('repetirle la cita que ya tiene no es prometer nada', () => {
    // Su hueco ya es suyo: no hay nada que ofrecerle.
    expect(citaPrometida('Sigue el lunes 10 a las 17:00.', DOS_LUNES)).toBe(null)
  })

  it('sin hora no hay promesa', () => {
    expect(citaPrometida('Te la cambio al lunes 3, dime qué hora te viene.', DOS_LUNES)).toBe(null)
  })

  it('con varias horas tampoco: eso es enseñar opciones, no prometer', () => {
    expect(citaPrometida('El lunes 3 tengo 09:00 y 12:00.', DOS_LUNES)).toBe(null)
  })

  it('sin decir de qué día habla, no se toca nada', () => {
    expect(citaPrometida('Te la dejo a las 12:00.', DOS_LUNES)).toBe(null)
  })

  it('una hora que no tiene ese día no se promete', () => {
    expect(citaPrometida('Te la cambio al lunes 3 a las 17:00.', DOS_LUNES)).toBe(null)
  })
})

describe('la ficha dice qué día es hoy', () => {
  it('lo pone delante, que es lo que faltaba para entender "este lunes"', () => {
    const s = construirSistema(DOS_LUNES)
    expect(s).toContain('Hoy es domingo, 2 de agosto')
    expect(s).toContain('mañana, este lunes 3 de agosto')
    expect(s).toContain('el lunes que viene, 10 de agosto')
  })

  it('con la cita cerrada, mover no es confirmar', () => {
    expect(construirSistema(DOS_LUNES)).toContain('es reprogramar, NO confirmarle que sigue en pie')
  })
})
