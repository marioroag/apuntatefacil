import { useCallback, useState } from 'react'

/**
 * EL LATERAL SE CONTRAE A ICONOS, y esa elección es del usuario y de su pantalla.
 *
 * Se guarda en `localStorage` y no en el perfil por el mismo motivo que los anchos
 * de columna de la tabla: lo cómodo depende del monitor que tienes delante, no de
 * quién eres. En un portátil de 13" el raíl estrecho devuelve 192px de trabajo; en
 * un monitor grande no hace falta y sería esconder los nombres por nada.
 *
 * Vive en un módulo propio porque lo necesitan dos sitios que no se hablan: el
 * `<aside>` del shell (que es quien tiene el ancho) y el propio lateral (que es
 * quien pinta el botón). Escrito en los dos, se desincronizan.
 *
 * SOLO EXISTE EN ESCRITORIO, y eso no se resuelve aquí sino en quien lo monta: el
 * cajón de móvil recibe `contraido={false}` a secas. Preguntarlo con una media
 * query dentro del hook sería inventarse un segundo mecanismo para una decisión
 * que el shell ya tiene tomada (el raíl solo se pinta a partir de `lg`).
 *
 * El `try/catch` no es paranoia: en una ventana privada `localStorage` LANZA al
 * leerlo, y una excepción aquí dejaría la aplicación entera sin montar.
 */
const CLAVE = 'apuntatefacil.lateral.contraido'

export function useLateralContraido(): [boolean, () => void] {
  const [contraido, setContraido] = useState(() => {
    try {
      return localStorage.getItem(CLAVE) === '1'
    } catch {
      return false
    }
  })

  const alternar = useCallback(() => {
    setContraido((c) => {
      try {
        localStorage.setItem(CLAVE, c ? '0' : '1')
      } catch {
        // Ventana privada o cookies bloqueadas: se pierde la preferencia entre
        // sesiones, que es mucho mejor que no poder contraer el menú.
      }
      return !c
    })
  }, [])

  return [contraido, alternar]
}
