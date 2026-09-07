// Lo que el candidato acepta al enviar su candidatura, con versión.
//
// Existe como módulo aparte, y no como texto suelto dentro del formulario,
// porque hay que poder DEMOSTRARLO: en `candidates` se guarda la fecha y el id
// de versión, y el id no sirve de nada si no se puede recuperar qué decía esa
// versión. De ahí que esto sea un registro y no una constante.
//
// REGLA: este registro es de solo añadir. Nunca se edita el texto de una versión
// ya publicada, porque habría candidatos con su id apuntando a algo que no leyeron.
// Si cambia el texto, se añade una versión nueva y `CONSENT_VERSION` pasa a ella.

/**
 * El trozo del texto que va enlazado a /privacidad. Tiene que aparecer literal
 * dentro de cada versión: el formulario parte la frase por aquí para colgar el
 * enlace, en vez de escribir el texto por su cuenta.
 */
export const ENLACE_PRIVACIDAD = 'política de privacidad'

export interface VersionConsentimiento {
  /** Lo que se guarda en `candidates.consent_version`. Fecha de publicación. */
  id: string
  /** El texto tal cual, con {empresa} donde va el nombre del cliente. */
  texto: string
}

export const CONSENT_VERSIONS: VersionConsentimiento[] = [
  {
    id: '2026-08-02',
    texto:
      'He leído y acepto la política de privacidad y que {empresa} trate mis datos ' +
      'para este proceso de selección, incluido escribirme por WhatsApp si dejo mi teléfono.',
  },
  // Retirado el asistente de WhatsApp (sep 2026), la app no le escribe a nadie
  // por ese canal, así que pedir permiso para hacerlo sería pedir permiso para
  // algo que no pasa. Versión NUEVA y no una edición de la anterior: quien se
  // apuntó antes leyó aquel texto y su id tiene que seguir resolviendo a lo que
  // leyó. Los candidatos que aceptaron la 2026-08-02 conservan su permiso; lo
  // que ya no existe es el canal.
  {
    id: '2026-09-07',
    texto:
      'He leído y acepto la política de privacidad y que {empresa} trate mis datos ' +
      'para este proceso de selección.',
  },
]

/** La vigente. Es la que se guarda con cada candidatura nueva. */
export const CONSENT_VERSION = CONSENT_VERSIONS[CONSENT_VERSIONS.length - 1].id

/**
 * El texto de una versión, con el nombre de la empresa puesto. Sin versión
 * conocida devuelve null: preferimos no enseñar nada a enseñar un texto que no
 * es el que esa persona aceptó.
 */
export function textoConsentimiento(versionId: string, empresa: string): string | null {
  const v = CONSENT_VERSIONS.find((x) => x.id === versionId)
  return v ? v.texto.replace('{empresa}', empresa) : null
}

/** El vigente, para pintarlo en el formulario. */
export function consentimientoVigente(empresa: string): string {
  return textoConsentimiento(CONSENT_VERSION, empresa)!
}
