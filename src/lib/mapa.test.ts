import { describe, it, expect } from 'vitest'
// `mapa.ts` no importa nada, así que lo carga vitest igual que ritmo/ y guion/.
// Ver la cabecera de schedule.test.ts.
//
// Aquí se prueban dos cosas de distinta naturaleza y las dos importan:
//   * que sepamos leer lo que de verdad pega la gente (troceo de URLs);
//   * que la lista blanca no deje pasar nada raro, porque esa lista es lo único
//     que separa esta función de un SSRF: pide URLs desde nuestro servidor.
import {
  coordenadasSueltas, hostPermitido, nombreDe, puntoDe, puntoValido,
} from '../../supabase/functions/_shared/interviews/mapa'

describe('puntoDe', () => {
  // El marcador real del sitio. Es el que hay que preferir.
  it('prefiere el marcador (!3d!4d) a la posición de la cámara (@)', () => {
    const url = 'https://www.google.com/maps/place/Nave/@28.0900000,-15.4000000,17z/data=!4m6!3m5!1s0x0!8m2!3d28.1234567!4d-15.4302100'
    expect(puntoDe(url)).toEqual({ lat: 28.1234567, lng: -15.43021 })
  })

  it('lee el enlace largo de la barra de direcciones', () => {
    const url = 'https://www.google.com/maps/place/Calle+Marina+32/@40.4168000,-3.7038000,17z'
    expect(puntoDe(url)).toEqual({ lat: 40.4168, lng: -3.7038 })
  })

  it('lee el enlace de "cómo llegar" y el de búsqueda por coordenadas', () => {
    expect(puntoDe('https://www.google.com/maps/search/?api=1&query=40.4168,-3.7038'))
      .toEqual({ lat: 40.4168, lng: -3.7038 })
    expect(puntoDe('https://maps.google.com/?daddr=28.1234,-15.4302'))
      .toEqual({ lat: 28.1234, lng: -15.4302 })
  })

  // La coma se escapa cuando el enlace viaja dentro de otro parámetro.
  it('entiende la coma escapada como %2C', () => {
    expect(puntoDe('https://www.google.com/maps?q=40.4168%2C-3.7038'))
      .toEqual({ lat: 40.4168, lng: -3.7038 })
  })

  it('lee el de Apple Maps', () => {
    expect(puntoDe('https://maps.apple.com/?ll=28.1234,-15.4302&q=Nave'))
      .toEqual({ lat: 28.1234, lng: -15.4302 })
  })

  it('un enlace corto todavía no tiene punto: hay que resolverlo antes', () => {
    expect(puntoDe('https://maps.app.goo.gl/aBcDeFgHiJk')).toBeNull()
  })

  it('no se inventa un punto donde no lo hay', () => {
    expect(puntoDe('https://www.google.com/maps')).toBeNull()
    expect(puntoDe('')).toBeNull()
  })
})

describe('puntoValido', () => {
  it('rechaza el Golfo de Guinea, que siempre es un parámetro vacío', () => {
    expect(puntoValido(0, 0)).toBe(false)
  })

  it('rechaza lo que se sale del planeta', () => {
    expect(puntoValido(91, 0)).toBe(false)
    expect(puntoValido(0, 181)).toBe(false)
    expect(puntoValido(NaN, 2)).toBe(false)
  })

  it('acepta España, que es donde están los clientes', () => {
    expect(puntoValido(40.4168, -3.7038)).toBe(true)   // Madrid
    expect(puntoValido(28.1235, -15.4363)).toBe(true)  // Las Palmas
  })
})

describe('coordenadasSueltas', () => {
  it('acepta el par escrito a mano, con espacios o sin ellos', () => {
    expect(coordenadasSueltas('28.1235, -15.4302')).toEqual({ lat: 28.1235, lng: -15.4302 })
    expect(coordenadasSueltas('  40.4168,-3.7038  ')).toEqual({ lat: 40.4168, lng: -3.7038 })
  })

  it('no confunde una URL con un par de números', () => {
    expect(coordenadasSueltas('https://www.google.com/maps?q=40.1,-3.2')).toBeNull()
  })

  it('un par fuera del planeta no cuela', () => {
    expect(coordenadasSueltas('999, 999')).toBeNull()
  })
})

// Esta lista es lo único que impide que la función se convierta en un peón para
// pedir cosas desde nuestro servidor. Cada caso de aquí es un ataque real.
describe('hostPermitido', () => {
  it('deja pasar los mapas de verdad', () => {
    for (const u of [
      'https://maps.app.goo.gl/x', 'https://www.google.com/maps/place/x',
      'https://maps.google.com/?q=1', 'https://maps.apple.com/?ll=1,1',
    ]) expect(hostPermitido(u)).toBe(true)
  })

  it('no sigue a un host cualquiera', () => {
    expect(hostPermitido('https://ejemplo.com/maps')).toBe(false)
  })

  it('no cae con un subdominio que TERMINA en uno permitido', () => {
    expect(hostPermitido('https://maps.app.goo.gl.malo.com/x')).toBe(false)
    expect(hostPermitido('https://www.google.com.malo.com/maps')).toBe(false)
  })

  it('no cae con el host metido en el usuario de la URL', () => {
    expect(hostPermitido('https://www.google.com@malo.com/maps')).toBe(false)
  })

  it('no sale de https: ni red interna ni ficheros', () => {
    expect(hostPermitido('http://www.google.com/maps')).toBe(false)
    expect(hostPermitido('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(hostPermitido('file:///etc/passwd')).toBe(false)
  })

  it('lo que no es una URL no es un host permitido', () => {
    expect(hostPermitido('maps.google.com')).toBe(false)
    expect(hostPermitido('')).toBe(false)
  })
})

describe('nombreDe', () => {
  it('saca el nombre del sitio y le quita los signos de la URL', () => {
    expect(nombreDe('https://www.google.com/maps/place/Nave+4+Marina/@28.1,-15.4,17z'))
      .toBe('Nave 4 Marina')
  })

  it('devuelve los acentos, que van escapados', () => {
    expect(nombreDe('https://www.google.com/maps/place/Almac%C3%A9n+Sur/@28.1,-15.4,17z'))
      .toBe('Almacén Sur')
  })

  it('sin nombre, o con uno ilegible, se va sin él', () => {
    expect(nombreDe('https://www.google.com/maps/@28.1,-15.4,17z')).toBeNull()
    expect(nombreDe('https://www.google.com/maps/place/%ZZ/@28.1,-15.4,17z')).toBeNull()
  })
})
