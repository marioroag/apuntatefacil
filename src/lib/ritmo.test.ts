import { describe, it, expect } from 'vitest'
// `ritmo.ts` no importa nada, así que lo carga vitest igual que schedule/ y
// guion/. Ver la cabecera de schedule.test.ts.
//
// Lo que se prueba es la decisión que hace que la conversación fluya o no:
// cuánto callamos antes de contestar. Corto de más parte frases por la mitad;
// largo de más deja al candidato mirando una pantalla quieta.
import { ARRANQUE, CERRADO, NORMAL, esperaSegundos } from '../../supabase/functions/_shared/interviews/ritmo'

describe('esperaSegundos: lo que viene con continuación', () => {
  // El caso más común de todos: nadie escribe "hola" y se calla.
  it('un saludo suelto espera de más a propósito', () => {
    for (const t of ['hola', 'Hola', 'Buenas', 'buenas tardes', 'hey', 'Holaa', '¿qué tal?']) {
      expect(esperaSegundos(t)).toBe(ARRANQUE)
    }
  })

  it('una frase a medias espera', () => {
    for (const t of ['es que el martes no puedo y', 'mira, lo que pasa es que', 'quería preguntar si']) {
      expect(esperaSegundos(t)).toBe(ARRANQUE)
    }
  })

  it('los puntos suspensivos son literalmente "sigo"', () => {
    expect(esperaSegundos('a ver déjame que mire...')).toBe(ARRANQUE)
  })

  it('un trozo corto sin cerrar espera', () => {
    expect(esperaSegundos('oye')).toBe(ARRANQUE)
    expect(esperaSegundos('una cosa')).toBe(ARRANQUE)
  })
})

describe('esperaSegundos: lo que ya está dicho', () => {
  // Es lo que arregla la sensación de lentitud: la mayoría de los mensajes
  // llegan enteros y no hay nada que esperar.
  it('una pregunta entera se contesta pronto', () => {
    expect(esperaSegundos('¿qué horas tienes el jueves?')).toBe(CERRADO)
    expect(esperaSegundos('puedes el viernes por la tarde?')).toBe(CERRADO)
  })

  // Sin esto, un "vale" caería en la regla de "muy corto" y esperaría 18
  // segundos, que es justo la sensación de que no hay nadie al otro lado.
  it('una respuesta corta pero completa no espera de más', () => {
    for (const t of ['si', 'sí', 'no', 'vale', 'ok', 'perfecto', 'gracias']) {
      expect(esperaSegundos(t)).toBe(NORMAL)
    }
  })

  it('una frase normal usa la espera normal', () => {
    expect(esperaSegundos('me viene bien el martes por la tarde')).toBe(NORMAL)
    expect(esperaSegundos('El jueves me va bien.')).toBe(NORMAL)
  })
})

describe('esperaSegundos: forma', () => {
  it('un mensaje vacío no rompe nada', () => {
    expect(esperaSegundos('')).toBe(NORMAL)
    expect(esperaSegundos('   ')).toBe(NORMAL)
    expect(esperaSegundos('!!!')).toBe(NORMAL)
  })

  it('los acentos y las mayúsculas dan igual', () => {
    expect(esperaSegundos('HOLA')).toBe(ARRANQUE)
    expect(esperaSegundos('Sí')).toBe(NORMAL)
  })

  // La garantía que importa por arriba: nunca se espera más de lo que se ha
  // decidido, pase lo que pase con el texto.
  it('siempre está entre el mínimo y el máximo', () => {
    const casos = ['hola', 'si', '¿me lo repites?', 'a'.repeat(500), '🙂', '2026-08-04']
    for (const t of casos) {
      const e = esperaSegundos(t)
      expect(e).toBeGreaterThanOrEqual(CERRADO)
      expect(e).toBeLessThanOrEqual(ARRANQUE)
    }
  })
})
