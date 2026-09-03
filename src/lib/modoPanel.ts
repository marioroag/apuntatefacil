import { useCallback } from 'react'
import { guardarSeccion, usePreferencia } from './preferencias'

/**
 * CÓMO SE PRESENTA LA LISTA DEL PUESTO: tabla o tablero (Mario, ago 2026, con
 * una referencia de CRM delante).
 *
 * Es una preferencia de PRESENTACIÓN, no un filtro: las mismas personas, los
 * mismos filtros y la misma ficha; lo que cambia es la pregunta que la pantalla
 * contesta de un vistazo (comparar campos contra ver el proceso por fases).
 *
 * Es UNA para todos los puestos, no una por puesto: cómo te gusta trabajar la
 * lista es un hábito tuyo, no un atributo del proceso, y quien tría en tablero
 * lo hace en todos. Por eso mismo viaja con TU CUENTA desde sep 2026 y no con el
 * navegador (`preferencias.ts`): es la primera pregunta del panel de la vista,
 * así que se guarda donde se guardan las otras dos. El lateral contraído, que
 * era el otro ejemplo de esta misma familia, se queda en local a propósito: ese
 * sí depende del monitor que tengas delante.
 */
const SECCION = 'panelModo'

export type ModoPanel = 'tabla' | 'tablero'

export function useModoPanel(): [ModoPanel, (m: ModoPanel) => void] {
  const modo: ModoPanel = usePreferencia<ModoPanel>(SECCION) === 'tablero' ? 'tablero' : 'tabla'
  const cambiar = useCallback((m: ModoPanel) => {
    // 'tabla' es el valor de fábrica, así que no se guarda: la sección
    // desaparece y el cajón queda como el de quien nunca lo ha tocado.
    guardarSeccion(SECCION, m === 'tablero' ? m : undefined)
  }, [])
  return [modo, cambiar]
}
