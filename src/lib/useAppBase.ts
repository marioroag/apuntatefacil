import { useLocation } from 'react-router-dom'

/** Base de rutas del producto: '/demo' en la demo pública, '/app' con sesión. */
export function useAppBase(): '/app' | '/demo' {
  return useLocation().pathname.startsWith('/demo') ? '/demo' : '/app'
}
