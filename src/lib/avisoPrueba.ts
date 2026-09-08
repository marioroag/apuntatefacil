// -----------------------------------------------------------------------------
// EL AVISO EN PANTALLA DE QUE LA PRUEBA SE ACABA (Mario, sep 2026).
//
// La prueba ya avisaba por CORREO (tres días antes y al terminar), y un correo
// se lee cuando se lee: el momento en que el aviso vale de verdad es cuando la
// persona está DENTRO, viendo entrar candidaturas, que es cuando el producto
// está demostrando lo que hace. Este es ese canal.
//
// LO QUE LO SEPARA DE UN NAG, que es lo único que hay que cuidar aquí:
//  * UNA VEZ POR UMBRAL. No "cada vez que entras": se apunta cuál se ha
//    enseñado ya y no se repite. Un pop-up que sale dos veces por la misma
//    noticia deja de leerse a la tercera, y encima enseña a cerrar sin mirar.
//  * SOLO CUANDO DE VERDAD SE ACABA. Los umbrales son 3 días, el último día y
//    el fin; a mitad de prueba no hay nada que recordar y un aviso ahí sería
//    publicidad, no información. Añadir o quitar uno es una entrada en
//    `UMBRALES_PRUEBA` y nada más.
//  * DICE QUÉ PASA, no "date prisa". Qué ocurre con las candidaturas al
//    terminar (siguen llegando y quedan en espera, no se pierde ninguna) y que
//    activar el pago ahora NO quema los días que queden. Sin esa segunda frase
//    el aviso solo mete prisa; con ella, quita el motivo para esperar, que es
//    de lo que va todo esto (ver `finDePrueba` en `pricing.ts`).
//
// LO QUE SE PAGA, DECLARADO: la marca de visto vive en `localStorage`, como
// `seen`, `boardSeen` y `candidatosSeen`, así que quien use dos ordenadores
// puede ver el mismo aviso una vez en cada uno. Es el patrón que esta casa ya
// usa para todos los "visto", y el precio es como mucho un aviso repetido en
// quince días; llevarlo a la cuenta costaría una columna y una escritura al
// servidor para algo que no es la mesa de trabajo.
// -----------------------------------------------------------------------------

/**
 * Los días que quedan en los que se avisa, **de más urgente a menos**: ese
 * orden ES el algoritmo (se coge el primero que encaje, o sea el más urgente),
 * así que no se puede reordenar por gusto. `0` es "ya ha terminado".
 *
 * Tres momentos en quince días, y los tres son "se está acabando": quedan tres
 * días, termina mañana, ha terminado. Un cuarto a mitad de prueba no cabe en
 * esa frase.
 */
export const UMBRALES_PRUEBA = [0, 1, 3] as const

/**
 * Qué umbral toca con los días que quedan, o `null` si todavía no hay nada que
 * avisar. Devuelve el MÁS URGENTE que encaje: con un día quedan también "menos
 * de tres", y lo que hay que enseñar es el de un día.
 */
export function umbralPrueba(dias: number | null | undefined): number | null {
  if (dias === null || dias === undefined) return null
  return UMBRALES_PRUEBA.find((u) => dias <= u) ?? null
}

/**
 * ¿Se enseña este umbral? Solo si es MÁS urgente que el último que se enseñó a
 * esta empresa. Con la comparación así, quien ya vio el de tres días no vuelve
 * a verlo al llegar a dos, y sí ve el de mañana y el del final. De regalo, un
 * umbral nuevo intercalado (pongamos 2) se le enseña a quien ya vio el 3, sin
 * tener que tocar nada más.
 */
export function tocaAvisar(umbral: number | null, visto: number | undefined): boolean {
  return umbral !== null && umbral < (visto ?? Infinity)
}

const CLAVE = 'apuntatefacil.aviso-prueba.v1'

/** Último umbral enseñado, por empresa. */
export function leerAvisosPrueba(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLAVE) ?? 'null')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export function guardarAvisoPrueba(companyId: string, umbral: number): Record<string, number> {
  const siguiente = { ...leerAvisosPrueba(), [companyId]: umbral }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(siguiente))
  } catch { /* cuota llena: el aviso se repetirá, que es el fallo benigno */ }
  return siguiente
}
