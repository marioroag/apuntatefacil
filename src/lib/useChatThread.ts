import { useEffect, useRef, useState } from 'react'

/**
 * Carga perezosa de un hilo (mensajes o eventos), con su estado de carga.
 *
 * El esqueleto solo se ve la PRIMERA vez: el estado arranca en `true` y el
 * efecto lo apaga al llegar los datos, pero no vuelve a encenderlo. Las recargas
 * posteriores (el ping de realtime cuando escribe un compañero) sustituyen la
 * lista en silencio; encender el esqueleto ahí haría parpadear la conversación
 * entera cada vez que alguien teclea al otro lado.
 *
 * Cambiar de candidato NO es una recarga: el componente se remonta por `key`, y
 * entonces el estado inicial vuelve a ser `true` por sí solo.
 */
export function useChatThread<T>(load: () => Promise<T[]>, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  // Por ref: `load` es una lambda nueva en cada render del padre y el efecto no
  // debe reejecutarse por eso (recargaría el hilo en bucle). La ref se actualiza
  // en su propio efecto, declarado ANTES que el de carga para que este ya vea la
  // versión nueva; escribirla durante el render sería tocar una ref en render.
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let vivo = true
    void loadRef.current().then((list) => {
      if (!vivo) return
      setItems(list)
      setLoading(false)
    })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { items, setItems, loading }
}
