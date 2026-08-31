// Qué dice el evento que se pone en el calendario del anfitrión, y qué cuenta
// como ocupado. Dominio PURO: sin red, sin base de datos y sin Deno, para que
// lo puedan cargar los dos runtimes y probarlo entero desde vitest (misma
// partición que _shared/schedule, y por el mismo motivo).

/** Lo que hace falta saber de una entrevista para escribirla en un calendario. */
export interface DatosEntrevista {
  candidato: string
  puesto: string
  inicio: string // ISO
  fin: string
  timezone: string
  modo: 'presencial' | 'videollamada'
  lugar: string
  /** El enlace de videollamada que ya tenga puesto la entrevista, si lo tiene. */
  meetingUrl: string | null
  /** Enlace a la ficha del candidato en el panel. */
  fichaUrl: string
}

export interface EventoEntrevista {
  titulo: string
  descripcion: string
  inicio: string
  fin: string
  timezone: string
  lugar: string
  conMeet: boolean
}

/**
 * EL TÍTULO EMPIEZA POR EL NOMBRE DE LA PERSONA, no por la palabra "Entrevista".
 * En la rejilla de un calendario un evento se lee por sus primeros caracteres, y
 * una semana con cinco citas que empiezan todas igual obliga a leerlas enteras
 * para saber cuál es cuál. Lo que distingue a una entrevista de otra es a quién
 * ves. Que ES una entrevista lo dice la segunda mitad, y ahí ya no compite.
 */
export function construirEvento(d: DatosEntrevista): EventoEntrevista {
  const titulo = d.puesto
    ? `${d.candidato} · Entrevista ${d.puesto}`
    : `${d.candidato} · Entrevista`

  const lineas = [
    `Entrevista con ${d.candidato}.`,
    d.puesto ? `Puesto: ${d.puesto}` : '',
    d.modo === 'videollamada' ? 'Videollamada' : d.lugar ? `Dónde: ${d.lugar}` : '',
    '',
    d.fichaUrl ? `Su ficha: ${d.fichaUrl}` : '',
    'Creado por Apúntate Fácil. Si mueves o borras este evento aquí, el cambio NO vuelve al panel.',
  ]

  return {
    titulo,
    descripcion: lineas.filter((l) => l !== '').join('\n'),
    inicio: d.inicio,
    fin: d.fin,
    timezone: d.timezone,
    // En videollamada no hay dirección que poner, y escribir la de la oficina
    // haría que alguien se presentara allí.
    lugar: d.modo === 'videollamada' ? (d.meetingUrl ?? '') : d.lugar,
    // Meet SOLO si es videollamada y no hay ya un enlace puesto. Con uno propio
    // (Zoom, Teams, o un Meet que ya se mandó al candidato), crear otro deja dos
    // salas para una cita y la mitad de la gente en la vacía.
    conMeet: d.modo === 'videollamada' && !d.meetingUrl,
  }
}

/**
 * El cuerpo que se le manda a Google.
 *
 * EL CANDIDATO NO VA COMO INVITADO (Mario, ago 2026), y por eso `attendees` no
 * aparece: añadirlo hace que GOOGLE le mande un correo en nombre del
 * empresario, con un texto que no hemos escrito y que nadie ha aprobado, y
 * cualquier cambio de hora dispara otro. Lo que el candidato recibe sale por su
 * canal, que es donde queda escrito lo que se le dijo. Tiene guardián.
 */
export function cuerpoEvento(ev: EventoEntrevista): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {
    summary: ev.titulo,
    description: ev.descripcion,
    start: { dateTime: ev.inicio, timeZone: ev.timezone },
    end: { dateTime: ev.fin, timeZone: ev.timezone },
  }
  if (ev.lugar) cuerpo.location = ev.lugar
  if (ev.conMeet) {
    cuerpo.conferenceData = {
      createRequest: {
        // Identificador de la PETICIÓN, no del evento: es lo que evita que un
        // reintento cree una segunda sala.
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }
  return cuerpo
}

/** El enlace de la videollamada dentro de la respuesta de Google. */
export function enlaceMeet(data: Record<string, unknown>): string | null {
  const directo = data.hangoutLink
  if (typeof directo === 'string' && directo) return directo
  const conf = (data.conferenceData ?? {}) as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> }
  const video = conf.entryPoints?.find((p) => p.entryPointType === 'video')?.uri
  return typeof video === 'string' && video ? video : null
}

