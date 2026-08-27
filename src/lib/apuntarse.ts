import type { FormField } from './types'

/**
 * QUÉ CUESTA APUNTARSE. Es lo que esta app puede decir y ningún portal puede.
 *
 * En InfoJobs, en JOIN o en LinkedIn, "Aplicar" es una caja negra: no sabes si
 * son dos campos o veinte minutos con registro, cuenta nueva y un CV que no
 * tienes actualizado. Y ese es justo el momento en que la gente abandona, sobre
 * todo en estos sectores, donde se busca trabajo desde el móvil y con prisa.
 *
 * Nosotros SÍ lo sabemos, porque el formulario es del puesto y lo tenemos
 * delante: cuántas preguntas son, si se pide algún documento y qué se va a
 * preguntar exactamente. No es una promesa de marketing, es un cálculo sobre
 * `campaign.fields`; si mañana la empresa añade cinco preguntas, el anuncio lo
 * dice solo. Por eso la competencia no puede copiarlo sin cambiar su producto.
 *
 * LO QUE NO SE DICE, A PROPÓSITO: cuánto se TARDA. "Dos minutos" no se puede
 * calcular sin inventárselo, y una cifra inventada en la pantalla donde alguien
 * decide si se fía es exactamente el dark pattern que esta casa no hace. Se dan
 * los hechos y el tiempo lo deduce quien lee, que además puede ver las
 * preguntas una por una.
 */
export interface ResumenApuntarse {
  /** Cuántas cosas hay que rellenar. TODAS, también el nombre y el teléfono:
   *  lo que se está diciendo es el esfuerzo, y el esfuerzo las incluye. */
  preguntas: number
  /** ¿Se pide algún documento (CV, carnet, certificado)? */
  pideDocumento: boolean
  /** Las etiquetas, en el orden en que se van a ver. */
  etiquetas: string[]
}

export function resumenApuntarse(fields: FormField[]): ResumenApuntarse {
  const visibles = fields.filter((f) => f.label.trim())
  return {
    preguntas: visibles.length,
    pideDocumento: visibles.some((f) => f.type === 'file'),
    etiquetas: visibles.map((f) => f.label.trim()),
  }
}

/**
 * Las tres señales, ya escritas. En este orden porque es el de las dudas: qué
 * me vas a preguntar, me vas a pedir papeles, y tengo que registrarme.
 *
 * "Sin crear cuenta" es SIEMPRE verdad y por eso se dice siempre: es la
 * diferencia más grande con cualquier portal, y quien viene de uno no da por
 * hecho que aquí no hace falta.
 */
export function senalesApuntarse(r: ResumenApuntarse): string[] {
  return [
    r.preguntas === 1 ? '1 pregunta' : `${r.preguntas} preguntas`,
    r.pideDocumento ? 'Te pedimos un documento' : 'Sin CV',
    'Sin crear cuenta',
  ]
}
