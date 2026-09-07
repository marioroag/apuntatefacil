import { describe, expect, it } from 'vitest'

/**
 * EL GUARDIÁN DEL AVISO DE CANDIDATURA NUEVA.
 *
 * Hasta sep 2026, el correo que le dice a la empresa que acaba de apuntarse
 * alguien lo lanzaba EL NAVEGADOR DEL CANDIDATO: el formulario público llamaba a
 * `notify-new-candidate` con `.catch(() => {})` y sin esperar la respuesta. Lo
 * que no sale del navegador no pasa, y ahí no salía nada si se cerraba la
 * pestaña al enviar, si la red iba mal, si el móvil suspendía la página o si
 * había un bloqueador de por medio. Esa empresa se quedaba sin enterarse, sin
 * cola, sin reintento y sin barrido, y el fallo era silencioso y del lado del
 * candidato, que es quien no puede arreglarlo. Aquí duele además doble, porque
 * el aviso es lo que hace que alguien entre a mirar: perdido, la candidatura se
 * queda esperando en un panel que nadie abre.
 *
 * Ahora el disparo lo pone un trigger de la base (`20260907130000`) y lo ejecuta
 * la cola con sus reintentos. Estas pruebas vigilan los dos extremos de esa
 * cadena, porque las dos formas de romperla son SILENCIOSAS: devolver la llamada
 * al cliente deja dos caminos para lo mismo (y el segundo sin reintentos), y
 * quitarle el ejecutor al tick apagaría los avisos enteros cancelando los
 * trabajos como "obsoletos" sin que nadie lo notara.
 *
 * Es hermano de `analisis.test.ts` y vigila la misma regla sobre el otro
 * inquilino que tuvo aquella línea del formulario. Se quedan separados a
 * propósito: son dos cadenas distintas (dos triggers, dos tipos de trabajo, dos
 * edge functions) y cada una tiene que poder fallar diciendo lo suyo.
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

const FUNCION = import.meta.glob('../../supabase/functions/notify-new-candidate/index.ts', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

describe('el disparo del aviso de candidatura nueva', () => {
  it('no vuelve al navegador: nadie en src/ invoca la función', () => {
    // Aquí no hay la excepción que sí tiene el triaje (su botón de "volver a
    // analizar" es una persona pidiéndolo). Este correo no lo pide nadie a mano
    // desde ninguna pantalla: lo dispara la LLEGADA de la candidatura, así que
    // cualquier invocación desde el cliente es la que se acaba de retirar.
    const culpables = Object.entries(FUENTE)
      .filter(([ruta]) => !ruta.endsWith('aviso.test.ts'))
      .filter(([, texto]) => texto.includes('notify-new-candidate'))
      .map(([ruta]) => ruta)

    expect(
      culpables,
      `${culpables.join(', ')} llama a notify-new-candidate desde el cliente. Eso ya se ` +
      'retiró: lo encola un trigger al entrar la candidatura y lo ejecuta la cola ' +
      '(`avisar_candidatura` en interview-tick), que es lo único que lo reintenta si falla. ' +
      'Una llamada desde el navegador se pierde en cuanto se cierra la pestaña.',
    ).toEqual([])
  })

  it('la cadena está entera: se encola en la base y el tick sabe ejecutarlo', () => {
    const encola = Object.entries(MIGRACIONES).some(([, t]) => /'avisar_candidatura'/.test(t))
    expect(encola, 'ninguna migración encola `avisar_candidatura`: nada dispara el aviso').toBe(true)

    const tick = Object.values(TICK)[0] ?? ''
    expect(tick, 'no se encuentra interview-tick/index.ts').not.toEqual('')
    expect(
      tick.includes("'avisar_candidatura'"),
      'el tick no sabe ejecutar `avisar_candidatura`: los trabajos caerían en su `default` y se ' +
      'cancelarían como obsoletos, o sea que los avisos se apagarían enteros sin un solo error.',
    ).toBe(true)
    expect(
      tick.includes("invoke('notify-new-candidate'"),
      'el ejecutor no invoca notify-new-candidate: esa función es la ÚNICA puerta de salida de ' +
      'este correo (mira los dos interruptores y reclama para no duplicarlo). Ningún trabajo de ' +
      'la cola redacta ni envía nada por su cuenta.',
    ).toBe(true)
  })

  it('toda salida que no envía dice por qué', () => {
    // Es lo que deja al ejecutor decidir entre cancelar y reintentar. Una salida
    // muda (`{ ok: true, sent: false }` a secas) hace indistinguibles dos casos
    // que no se parecen en nada: "no procede" (permanente, se cancela) y "ha
    // fallado el proveedor" (pasajero, se reintenta). Tratándola como lo primero
    // se pierde el aviso para siempre; como lo segundo, se gastan seis intentos
    // contra algo que nunca va a cambiar.
    const fn = Object.values(FUNCION)[0] ?? ''
    expect(fn, 'no se encuentra notify-new-candidate/index.ts').not.toEqual('')

    const mudas = [...fn.matchAll(/return json\(\{[^}]*\}/g)]
      .map((m) => m[0])
      .filter((r) => /sent:\s*false/.test(r))
      .filter((r) => !/skipped:/.test(r) && !/error:/.test(r))

    expect(
      mudas,
      `notify-new-candidate tiene ${mudas.length} salida(s) sin motivo: ${mudas.join(' | ')}. ` +
      'La cola no puede saber si cancelar o reintentar. Toda respuesta que no envía lleva ' +
      '`skipped` (no procede: se cancela con ese motivo) o `error` (ha fallado: se reintenta).',
    ).toEqual([])
  })

  it('un envío que falla suelta el reclamo, o el aviso se pierde para siempre', () => {
    // `notified_at` se reclama ANTES de llamar a Resend, que es lo que impide el
    // correo duplicado. Si Resend rechaza y el reclamo se queda puesto, el
    // reintento de la cola se encuentra "ya notificado", cancela el trabajo y esa
    // empresa no se entera nunca, con un motivo escrito que además es falso.
    const fn = Object.values(FUNCION)[0] ?? ''
    expect(
      /notified_at:\s*null/.test(fn),
      'notify-new-candidate ya no suelta el reclamo (`notified_at: null`) cuando el envío falla. ' +
      'Con el reclamo puesto y sin correo enviado, el reintento de la cola se encontrará ' +
      '"ya notificado" y cancelará el trabajo: un fallo pasajero del proveedor deja a esa ' +
      'empresa sin enterarse PARA SIEMPRE.',
    ).toBe(true)
  })
})
