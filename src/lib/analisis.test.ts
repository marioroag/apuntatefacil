import { describe, expect, it } from 'vitest'

/**
 * EL GUARDIÁN DEL DISPARO DEL TRIAJE.
 *
 * Hasta sep 2026, el análisis de una candidatura nueva lo lanzaba EL NAVEGADOR
 * DEL CANDIDATO: el formulario público llamaba a `analyze-candidate` sin
 * esperar la respuesta. Lo que no sale del navegador no pasa, y ahí no salía
 * nada si se cerraba la pestaña al enviar, si la red iba mal, si el móvil
 * suspendía la página o si había un bloqueador de por medio. Esa candidatura se
 * quedaba sin analizar PARA SIEMPRE, sin cola, sin reintento y sin barrido, y
 * el fallo era silencioso y del lado del candidato, que es quien no puede
 * arreglarlo.
 *
 * Ahora el disparo lo pone un trigger de la base (`20260907120000`) y lo
 * ejecuta la cola con sus reintentos. Estas dos pruebas vigilan los dos extremos
 * de esa cadena, porque las dos formas de romperla son SILENCIOSAS: devolver la
 * llamada al cliente deja dos caminos para lo mismo (y el segundo sin
 * reintentos), y quitarle el ejecutor al tick apagaría el triaje entero
 * cancelando los trabajos como "obsoletos" sin que nadie lo notara.
 */

const FUENTE = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

const MIGRACIONES = import.meta.glob('../../supabase/migrations/*.sql', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

const TICK = import.meta.glob('../../supabase/functions/interview-tick/index.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

describe('el disparo del triaje de Meridian', () => {
  it('no vuelve al navegador: nadie en src/ lo llama en automático', () => {
    // El botón de la ficha SÍ puede invocar la función (es una persona
    // pidiéndolo, y ahí no hay nada que reintentar: si falla, lo ve y lo vuelve
    // a pulsar). Lo que no puede volver es el disparo AUTOMÁTICO, que es el que
    // se reconoce por `auto`.
    const culpables = Object.entries(FUENTE)
      .filter(([ruta]) => !ruta.endsWith('analisis.test.ts'))
      .filter(([, texto]) => /analyze-candidate[\s\S]{0,240}\bauto\b\s*:/.test(texto))
      .map(([ruta]) => ruta)

    expect(
      culpables,
      `${culpables.join(', ')} dispara el análisis automático desde el cliente. Eso ya se ` +
      'retiró: lo encola un trigger al entrar la candidatura y lo ejecuta la cola ' +
      '(`analizar_candidato` en interview-tick), que es lo único que lo reintenta si falla. ' +
      'Una llamada desde el navegador se pierde en cuanto se cierra la pestaña.',
    ).toEqual([])
  })

  it('la cadena está entera: se encola en la base y el tick sabe ejecutarlo', () => {
    const encola = Object.entries(MIGRACIONES).some(([, t]) => /'analizar_candidato'/.test(t))
    expect(encola, 'ninguna migración encola `analizar_candidato`: nada dispara el triaje').toBe(true)

    const tick = Object.values(TICK)[0] ?? ''
    expect(tick, 'no se encuentra interview-tick/index.ts').not.toEqual('')
    expect(
      tick.includes("'analizar_candidato'"),
      'el tick no sabe ejecutar `analizar_candidato`: los trabajos caerían en su `default` y se ' +
      'cancelarían como obsoletos, o sea que el triaje se apagaría entero sin un solo error.',
    ).toBe(true)
  })
})
