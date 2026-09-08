import { useOutletContext } from 'react-router-dom'

/**
 * Lo que el SHELL (`AppLayout`) presta a las pantallas que monta. Hoy, una sola
 * cosa: abrir el asistente de crear puesto, cuyo estado vive en el shell porque
 * se abre desde el lateral, desde el buscador y desde la torre de primeros
 * pasos. Va por el contexto del `Outlet` (tipado, sin provider nuevo) y no
 * buscando la acción `nuevo-puesto` por su id en el registro del buscador: si
 * alguien la renombrara, el botón principal de la guía no haría nada y nadie
 * se enteraría.
 */
export interface ContextoShell {
  abrirAsistente: () => void
}

export function useShell(): ContextoShell | undefined {
  return useOutletContext<ContextoShell | undefined>()
}
