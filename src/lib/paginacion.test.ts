import { describe, expect, it } from 'vitest'

/**
 * EL GUARDIÁN DE LA PAGINACIÓN (auditoría de seguridad, sep 2026).
 *
 * PostgREST recorta a `max_rows` (1000) cualquier consulta que no pagine, y lo
 * hace en silencio: ni error ni aviso, solo faltan filas. Una lista de
 * candidatos que no pase por `todasLasFilas` es una lista que un día se queda
 * corta sin que nadie lo vea. Probado rompiéndolo: quitando el `range` de una
 * de las dos consultas, falla.
 */
const FUENTE = import.meta.glob('./store.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('las listas de candidatos se paginan', () => {
  it("toda consulta from('candidates').select('*') pasa por todasLasFilas y lleva range", () => {
    const codigo = Object.values(FUENTE)[0]
    const listas = [...codigo.matchAll(/from\('candidates'\)\s*\.select\('\*'\)/g)]
    expect(listas.length).toBeGreaterThan(0)
    for (const m of listas) {
      const antes = codigo.slice(Math.max(0, m.index! - 120), m.index!)
      const despues = codigo.slice(m.index!, m.index! + 260)
      expect(antes, `consulta sin todasLasFilas en ...${antes.slice(-60)}`).toMatch(/todasLasFilas\(/)
      expect(despues, 'consulta sin .range(desde, hasta)').toMatch(/\.range\(desde, hasta\)/)
    }
  })
})
