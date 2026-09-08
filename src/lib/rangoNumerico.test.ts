import { describe, it, expect } from 'vitest'
import { MINIMO_NUMERICO, rangoNumerico, textoRango } from './rangoNumerico'

// EL GUARDIÁN DEL CARRIL NUMÉRICO.
//
// Vigila algo que NO se ve fallar: un carril mal medido no rompe nada, no lanza y
// no pinta un error. Solo deja un slider que no se puede arrastrar, y eso se
// descubre cuando un cliente intenta filtrar y no puede, que fue exactamente cómo
// salió esto (Solera Canarias, "años de experiencia en obra", de -1 a 642943969).
//
// El caso de verdad está el primero, con sus números reales, porque una prueba de
// un fallo que ya ocurrió vale más que diez inventadas.

/** El puesto de Albañilería tal como estaba: 214 respuestas sensatas y dos que no. */
function comoAlbanileria(): unknown[] {
  const vals: unknown[] = []
  for (let i = 0; i < 214; i++) vals.push(String(i % 41)) // 0-40 años, como texto (viene de un jsonb)
  vals.push('642943969') // un móvil escrito donde iban los años
  vals.push('-1')
  return vals
}

describe('rangoNumerico', () => {
  it('no deja que un móvil escrito por error se lleve el carril entero', () => {
    const r = rangoNumerico(comoAlbanileria())
    expect(r).not.toBeNull()
    const [lo, hi] = r!
    // Lo que se pedía: un carril que se pueda arrastrar. Sin el recorte esto era
    // [-1, 642943969] y los 214 candidatos reales no llegaban a un píxel.
    expect(hi).toBeLessThan(100)
    expect(lo).toBeGreaterThanOrEqual(MINIMO_NUMERICO)
  })

  it('con datos limpios NO recorta: el carril sigue siendo el real', () => {
    // Es la mitad que se olvida. Un recorte que se aplica siempre estrecha el
    // carril de todos los puestos sanos para arreglar el de uno enfermo.
    const vals = Array.from({ length: 215 }, (_, i) => String(i % 41))
    expect(rangoNumerico(vals)).toEqual([0, 40])
  })

  it('una cola larga legítima no se lleva el carril, pero tampoco se recorta a lo tonto', () => {
    // Salario deseado: casi todos entre 18.000 y 30.000, uno pide 200.000.
    const vals: unknown[] = []
    for (let i = 0; i < 200; i++) vals.push(18000 + (i % 120) * 100) // 18.000 - 29.900
    vals.push(200000)
    const [lo, hi] = rangoNumerico(vals)!
    expect(lo).toBe(18000)
    expect(hi).toBeLessThan(40000) // el carril sirve para el grueso...
    // ...y el de 200.000 no se pierde: entra por el tope, que se guarda sin
    // límite. Eso lo comprueba la prueba de `textoRango` de más abajo.
  })

  it('descarta lo que no es una cantidad, y un negativo es de eso', () => {
    const vals = ['5', '7', 'no lo sé', null, undefined, '', '-3', Infinity, '9', {}, '12']
    expect(rangoNumerico(vals)).toEqual([5, 12])
  })

  it('sin carril que pintar devuelve null en vez de un slider de un punto', () => {
    expect(rangoNumerico([])).toBeNull()
    expect(rangoNumerico(['7'])).toBeNull()
    expect(rangoNumerico(['7', '7', '7'])).toBeNull()
    expect(rangoNumerico(['hola', 'qué tal'])).toBeNull()
    expect(rangoNumerico(['-2', '-5'])).toBeNull() // todo negativo: no queda nada
  })

  it('con el cuerpo plano no se inventa un recorte', () => {
    // Quince "5 años" y un "12": el 12 no es absurdo, es el candidato con más
    // experiencia. Sin anchura con la que medir, el carril es el real.
    const vals = [...Array(15).fill('5'), '12']
    expect(rangoNumerico(vals)).toEqual([5, 12])
  })

  it('con muestra pequeña no recorta, y eso es a propósito', () => {
    // Por debajo de 20 valores un percentil no significa nada. Se declara aquí
    // para que quien lo lea sepa que es una decisión y no un descuido: con doce
    // candidatos no se filtra por rango, se leen las doce filas.
    const vals = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '642943969']
    expect(rangoNumerico(vals)).toEqual([1, 642943969])
  })

  it('el recorte por abajo también funciona, cuando de verdad toca', () => {
    // Cuerpo apretado (1000-1009) y alguien que se deja un dígito. Es el único
    // caso en que el lado bajo actúa: con el suelo del campo en cero, un valor
    // bajo nunca puede caer tan lejos del cuerpo como puede caer uno alto.
    const vals: unknown[] = Array.from({ length: 100 }, (_, i) => String(1000 + (i % 10)))
    vals.push('0')
    expect(rangoNumerico(vals)).toEqual([1000, 1009])
  })

  it('una respuesta en blanco no es un cero', () => {
    // `Number('')` vale 0, así que sin la guarda cada pregunta opcional sin
    // contestar metía un 0 en el carril y lo estiraba ella sola.
    const vals = [...Array(40).fill('').map((_, i) => (i < 20 ? '' : '   ')), '30', '35', '40']
    expect(rangoNumerico(vals)).toEqual([30, 40])
  })
})

describe('textoRango', () => {
  it('dice lo que el filtro HACE, no dónde están los mangos', () => {
    // Con el carril recortado, un mango en su tope no es "hasta 38": es "de 38 en
    // adelante". Escribir el número dejaría creer que el de 45 años queda fuera.
    expect(textoRango(0, 40, 0, 40)).toBe('Cualquiera')
    expect(textoRango(5, 40, 0, 40)).toBe('Desde 5')
    expect(textoRango(0, 20, 0, 40)).toBe('Hasta 20')
    expect(textoRango(5, 20, 0, 40)).toBe('5 – 20')
  })
})
