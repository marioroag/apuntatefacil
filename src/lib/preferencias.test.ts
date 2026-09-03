import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { _reiniciar, guardarSeccion, leerSeccion, recortar, sincronizar, LIMITE_PREFS } from './preferencias'

/* ---------------------------------------------------------------------------
   EL GUARDIÁN DE LAS PREFERENCIAS DE LA PERSONA
   ---------------------------------------------------------------------------
   Lo que vigila no se ve en pantalla y se rompe callado: quién gana cuando el
   servidor dice una cosa y este navegador otra. Si se equivoca, el síntoma es
   que alguien pierde la mesa que acababa de colocar, y eso no se descubre hasta
   que ya ha pasado y sin forma de reproducirlo.
--------------------------------------------------------------------------- */

beforeEach(() => {
  _reiniciar()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

/** Un escritor de mentira que apunta lo que le mandan y contesta lo que se le diga. */
function escritor(ok = true) {
  const subidas: unknown[] = []
  return {
    subidas,
    fn: async (datos: unknown) => {
      subidas.push(JSON.parse(JSON.stringify(datos)))
      return ok
    },
  }
}

describe('lo que se guarda', () => {
  it('una sección se lee tal cual, y borrarla la quita del cajón', () => {
    guardarSeccion('columnas', { puesto: { estado: 200 } })
    expect(leerSeccion('columnas')).toEqual({ puesto: { estado: 200 } })
    guardarSeccion('columnas', undefined)
    expect(leerSeccion('columnas')).toBeUndefined()
  })

  it('sube a la cuenta con retardo, y una sola vez por ráfaga', async () => {
    const e = escritor()
    sincronizar('u1', null, e.fn)
    guardarSeccion('columnas', { puesto: { estado: 200 } })
    guardarSeccion('columnas', { puesto: { estado: 240 } })
    expect(e.subidas).toHaveLength(0)
    await vi.runAllTimersAsync()
    expect(e.subidas).toEqual([{ columnas: { puesto: { estado: 240 } } }])
  })
})

describe('quién manda al sincronizar', () => {
  it('manda el servidor cuando aquí no hay nada sin subir', () => {
    _reiniciar({ datos: { columnas: { puesto: { estado: 200 } } }, uid: 'u1' })
    sincronizar('u1', { columnas: { puesto: { estado: 320 } } }, escritor().fn)
    expect(leerSeccion('columnas')).toEqual({ puesto: { estado: 320 } })
  })

  it('NO manda el servidor si aquí hay un cambio sin subir: se sube lo de aquí', async () => {
    const e = escritor()
    _reiniciar({ datos: { columnas: { puesto: { estado: 200 } } }, uid: 'u1', pendiente: true })
    sincronizar('u1', { columnas: { puesto: { estado: 320 } } }, e.fn)
    expect(leerSeccion('columnas')).toEqual({ puesto: { estado: 200 } })
    await vi.runAllTimersAsync()
    expect(e.subidas).toEqual([{ columnas: { puesto: { estado: 200 } } }])
  })

  it('lo que hay en el navegador se adopta si la cuenta no tiene nada', async () => {
    const e = escritor()
    _reiniciar({ datos: { columnas: { puesto: { estado: 200 } } }, deLegado: true })
    sincronizar('u1', null, e.fn)
    await vi.runAllTimersAsync()
    expect(e.subidas).toEqual([{ columnas: { puesto: { estado: 200 } } }])
  })

  it('pero NO pisa a la cuenta que ya tenía algo guardado', () => {
    _reiniciar({ datos: { columnas: { puesto: { estado: 200 } } }, deLegado: true })
    sincronizar('u1', { columnas: { puesto: { estado: 320 } } }, escritor().fn)
    expect(leerSeccion('columnas')).toEqual({ puesto: { estado: 320 } })
  })

  it('otra persona en el mismo navegador no hereda la mesa de la anterior', () => {
    _reiniciar({ datos: { columnas: { puesto: { estado: 200 } } }, uid: 'u1' })
    sincronizar('u2', null, escritor().fn)
    expect(leerSeccion('columnas')).toBeUndefined()
  })

  it('un fallo al subir deja el cambio pendiente, y el siguiente lo reintenta', async () => {
    const malo = escritor(false)
    sincronizar('u1', null, malo.fn)
    guardarSeccion('columnas', { puesto: { estado: 200 } })
    await vi.runAllTimersAsync()
    expect(malo.subidas).toHaveLength(1)
    // La cuenta tiene otra cosa, pero lo de aquí sigue sin confirmar: no se pisa.
    const bueno = escritor()
    sincronizar('u1', { columnas: { puesto: { estado: 320 } } }, bueno.fn)
    expect(leerSeccion('columnas')).toEqual({ puesto: { estado: 200 } })
    await vi.runAllTimersAsync()
    expect(bueno.subidas).toEqual([{ columnas: { puesto: { estado: 200 } } }])
  })

  it('sin sesión no se sube nada', async () => {
    const e = escritor()
    sincronizar(null, null, null)
    guardarSeccion('columnas', { puesto: { estado: 200 } })
    await vi.runAllTimersAsync()
    expect(e.subidas).toHaveLength(0)
    expect(leerSeccion('columnas')).toEqual({ puesto: { estado: 200 } })
  })
})

describe('el tope de tamaño', () => {
  /** Un cajón como el de una ETT con muchos procesos: listas larguísimas. */
  const enorme = () => ({
    columnas: { puesto: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`campo:${'x'.repeat(20)}${i}`, 120])) },
    vistaTabla: {
      puesto: { cambiadas: Array.from({ length: 900 }, (_, i) => `campo:${'y'.repeat(24)}${i}`), orden: ['candidato'] },
    },
    panelModo: 'tablero',
  })

  it('recorta por debajo del tope que declara la columna en SQL', () => {
    const antes = enorme()
    expect(JSON.stringify(antes).length).toBeGreaterThan(LIMITE_PREFS)
    const despues = recortar(antes)
    expect(JSON.stringify(despues).length).toBeLessThanOrEqual(LIMITE_PREFS)
  })

  it('tira lo más antiguo y conserva lo último que tocaste', () => {
    const despues = recortar(enorme()) as { vistaTabla: { puesto: { cambiadas: string[] } } }
    const cambiadas = despues.vistaTabla.puesto.cambiadas
    expect(cambiadas.length).toBeGreaterThan(0)
    // Lo último de la lista es lo último que se marcó: eso no se puede perder.
    expect(cambiadas[cambiadas.length - 1]).toBe(`campo:${'y'.repeat(24)}899`)
  })

  it('lo que ya cabe no se toca', () => {
    const chico = { columnas: { puesto: { estado: 200 } } }
    expect(recortar(chico)).toBe(chico)
  })

  it('guardar recorta antes de escribir, así que el cajón nunca crece de más', () => {
    guardarSeccion('vistaTabla', enorme().vistaTabla)
    guardarSeccion('columnas', enorme().columnas)
    expect(JSON.stringify({ columnas: leerSeccion('columnas'), vistaTabla: leerSeccion('vistaTabla') }).length)
      .toBeLessThanOrEqual(LIMITE_PREFS)
  })
})
