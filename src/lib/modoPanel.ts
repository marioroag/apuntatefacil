import { useCallback, useState } from 'react'

/**
 * CÓMO SE PRESENTA LA LISTA DEL PUESTO: tabla o tablero (Mario, ago 2026, con
 * una referencia de CRM delante).
 *
 * Es una preferencia de PRESENTACIÓN, no un filtro: las mismas personas, los
 * mismos filtros y la misma ficha; lo que cambia es la pregunta que la pantalla
 * contesta de un vistazo (comparar campos contra ver el proceso por fases).
 *
 * Se guarda en `localStorage` y es UNA para todos los puestos, no una por
 * puesto: cómo te gusta trabajar la lista es un hábito tuyo, no un atributo del
 * proceso, y quien tría en tablero lo hace en todos. Mismo razonamiento que la
 * preferencia del lateral contraído; el `try/catch`, por lo de siempre (una
 * ventana privada tira `localStorage`).
 */
const CLAVE = 'apuntatefacil.panel.modo'

export type ModoPanel = 'tabla' | 'tablero'

export function useModoPanel(): [ModoPanel, (m: ModoPanel) => void] {
  const [modo, setModo] = useState<ModoPanel>(() => {
    try { return localStorage.getItem(CLAVE) === 'tablero' ? 'tablero' : 'tabla' } catch { return 'tabla' }
  })
  const cambiar = useCallback((m: ModoPanel) => {
    setModo(m)
    try { localStorage.setItem(CLAVE, m) } catch { /* sin persistencia, la sesión manda */ }
  }, [])
  return [modo, cambiar]
}
