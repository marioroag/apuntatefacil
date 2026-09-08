import { describe, expect, it } from 'vitest'
import {
  PASOS,
  aplicarMarcas,
  estadoDe,
  estadoDeLaTorre,
  leerMarcas,
  pasosDeducidos,
  type Deducido,
} from './primerosPasos'

/**
 * EL GUARDIÁN DE LA TORRE DE PRIMEROS PASOS.
 *
 * Lo que vigila no se ve en pantalla hasta que alguien lo sufre: que un paso
 * hecho vuelva a pendiente al borrar la candidatura de prueba, que "Omitir"
 * valga en un paso obligatorio, que el anillo del menú cuente con un total
 * distinto del de la torre. Cada prueba deja escrito el fallo que previene.
 */

const NADA: Deducido = { hayPuesto: false, hayCandidatura: false, hayCandidaturaReal: false, hayEquipo: false, hayLogo: false }
const TODO: Deducido = { hayPuesto: true, hayCandidatura: true, hayCandidaturaReal: true, hayEquipo: true, hayLogo: true }

const FUENTES = import.meta.glob(['../components/CuentaMenu.tsx', '../components/Sidebar.tsx', '../screens/AppLayout.tsx'], {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>

describe('la lista de pasos', () => {
  it('va en este orden, y el orden ES el algoritmo (el actual es el primero sin resolver)', () => {
    expect(PASOS.map((p) => p.id)).toEqual(['puesto', 'preguntas', 'probar', 'enlace', 'equipo', 'logo'])
  })

  it('no repite ids', () => {
    expect(new Set(PASOS.map((p) => p.id)).size).toBe(PASOS.length)
  })

  it('su copy respeta las reglas de la casa: sin guion largo y sin "formulario"', () => {
    const textos = PASOS.flatMap((p) => [p.titulo, p.texto, p.accion])
    expect(textos.filter((t) => t.includes('—'))).toEqual([])
    expect(textos.filter((t) => /formulario/i.test(t))).toEqual([])
  })
})

describe('qué se deduce de los datos', () => {
  it('"preguntas" no sale nunca de los datos: solo existe como marca', () => {
    expect(pasosDeducidos(TODO)).not.toContain('preguntas')
    expect(estadoDe(estadoDeLaTorre({}, TODO), 'preguntas')).toBe('actual')
  })

  it('una candidatura de prueba resuelve "probar" pero no "enlace"', () => {
    const d = { ...NADA, hayPuesto: true, hayCandidatura: true }
    expect(pasosDeducidos(d)).toEqual(['puesto', 'probar'])
  })
})

describe('un paso hecho no retrocede', () => {
  it('borrar el puesto no reabre "Crea tu puesto": la marca manda sobre el dato', () => {
    const t = estadoDeLaTorre({ puesto: 'hecho' }, NADA)
    expect(estadoDe(t, 'puesto')).toBe('hecho')
    expect(t.actual).toBe('preguntas')
  })

  it('un "hecho" no baja a "omitido" ni con un patch que lo pida', () => {
    expect(aplicarMarcas({ logo: 'hecho' }, { logo: 'omitido' })).toEqual({ logo: 'hecho' })
  })
})

describe('omitir', () => {
  it('solo vale en los opcionales: un paso obligatorio no se puede saltar', () => {
    expect(aplicarMarcas({}, { preguntas: 'omitido' })).toEqual({})
    expect(aplicarMarcas({}, { logo: 'omitido' })).toEqual({ logo: 'omitido' })
  })

  it('un omitido cuenta como resuelto para cerrar la guía, pero se pinta como omitido', () => {
    const t = estadoDeLaTorre({ preguntas: 'hecho', enlace: 'hecho', equipo: 'omitido', logo: 'omitido' }, { ...NADA, hayPuesto: true, hayCandidatura: true })
    expect(t.completa).toBe(true)
    expect(t.actual).toBeNull()
    expect(t.hechos).toBe(t.total)
    expect(estadoDe(t, 'equipo')).toBe('omitido')
  })

  it('un omitido que los datos luego dan por hecho pasa a hecho', () => {
    expect(estadoDe(estadoDeLaTorre({ logo: 'omitido' }, { ...NADA, hayLogo: true }), 'logo')).toBe('hecho')
  })
})

describe('el jsonb que llega del servidor', () => {
  it('se filtra al leer: claves y valores desconocidos se tiran, no rompen', () => {
    expect(leerMarcas({ puesto: 'hecho', inventado: 'hecho', logo: 'casi', probar: 'omitido' })).toEqual({ puesto: 'hecho', probar: 'omitido' })
    expect(leerMarcas(null)).toEqual({})
    expect(leerMarcas(['hecho'])).toEqual({})
  })
})

describe('una sola cuenta del progreso', () => {
  it('el total del anillo y del "N de M" sale de la lista, no de un número escrito en el menú', () => {
    // Existió `ONBOARDING_TOTAL = 4` en CuentaMenu: con la torre de seis, el
    // menú habría seguido diciendo "de 4". Dos cuentas del mismo avance se
    // desincronizan siempre.
    for (const [ruta, src] of Object.entries(FUENTES)) {
      const limpio = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      expect(limpio, `${ruta} escribe el total de la guía a mano; tiene que llegar de estadoDeLaTorre().total`)
        .not.toMatch(/ONBOARDING_TOTAL|\btotal\s*[:=]\s*\d|\bde 4\b|\/\s*4\b/)
    }
    expect(estadoDeLaTorre({}, NADA).total).toBe(PASOS.length)
  })
})
