import { describe, expect, it } from 'vitest'
import { crc32, crearZip, nombreSeguro, nombreUnico } from './zip'

/* ---------------------------------------------------------------------------
   EL GUARDIÁN DEL ZIP.
   ---------------------------------------------------------------------------
   Un escritor de formato binario no se verifica abriendo el navegador: si un
   desplazamiento está mal, el fichero se abre en una máquina y en otra no, y no
   hay pantalla que lo enseñe. Aquí se comprueba lo que un descompresor lee de
   verdad: las firmas, los tamaños, el CRC y, sobre todo, que el directorio
   central APUNTE a donde empieza cada cabecera local, que es el fallo clásico y
   el que deja un zip que "pesa bien" y no se abre.
--------------------------------------------------------------------------- */

/** Lee el Blob como bytes. `arrayBuffer()` existe en el jsdom de vitest. */
async function bytes(b: Blob) {
  return new Uint8Array(await b.arrayBuffer())
}
const u32 = (d: DataView, o: number) => d.getUint32(o, true)
const u16 = (d: DataView, o: number) => d.getUint16(o, true)

const FECHA = new Date(2026, 7, 27, 10, 30, 0)

describe('crc32', () => {
  // Vectores conocidos del estándar: si la tabla o el polinomio se tuercen, esto
  // cambia. Comprobarlo contra "lo que salga" no vigilaría nada.
  it('coincide con los valores de referencia', () => {
    const enc = new TextEncoder()
    expect(crc32(enc.encode(''))).toBe(0)
    expect(crc32(enc.encode('a'))).toBe(0xe8b7be43)
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(enc.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339)
  })
})

describe('crearZip', () => {
  it('escribe un zip que un descompresor puede recorrer', async () => {
    const enc = new TextEncoder()
    const a = { nombre: 'uno.txt', datos: enc.encode('hola') }
    const b = { nombre: 'dos.txt', datos: enc.encode('que tal') }
    const d = new DataView((await bytes(crearZip([a, b], FECHA))).buffer)

    // 1. Arranca por la cabecera local del primero, sin comprimir y en UTF-8.
    expect(u32(d, 0)).toBe(0x04034b50)
    expect(u16(d, 8)).toBe(0) // método: guardado tal cual
    expect(u16(d, 6) & 0x0800).toBe(0x0800) // bit del nombre en UTF-8
    expect(u32(d, 14)).toBe(crc32(a.datos))
    expect(u32(d, 18)).toBe(a.datos.length)
    expect(u32(d, 22)).toBe(a.datos.length)

    // 2. El final del fichero dice cuántas entradas hay y dónde está el
    //    directorio central. Es lo primero que lee un descompresor.
    const fin = d.byteLength - 22
    expect(u32(d, fin)).toBe(0x06054b50)
    expect(u16(d, fin + 8)).toBe(2)
    const inicioCentral = u32(d, fin + 16)
    expect(u32(d, fin + 12)).toBe(fin - inicioCentral) // tamaño del directorio

    // 3. Y CADA entrada del directorio apunta a su cabecera local. Este es el
    //    fallo que deja un zip que pesa bien y no abre.
    let p = inicioCentral
    for (const e of [a, b]) {
      expect(u32(d, p)).toBe(0x02014b50)
      const local = u32(d, p + 42)
      expect(u32(d, local)).toBe(0x04034b50)
      const nombreLen = u16(d, local + 26)
      const nombre = new TextDecoder().decode(new Uint8Array(d.buffer, local + 30, nombreLen))
      expect(nombre).toBe(e.nombre)
      const datos = new Uint8Array(d.buffer, local + 30 + nombreLen, e.datos.length)
      expect(new TextDecoder().decode(datos)).toBe(new TextDecoder().decode(e.datos))
      p += 46 + u16(d, p + 28)
    }
  })

  it('pesa lo que suman sus partes, porque no comprime', async () => {
    const datos = new Uint8Array(5000).fill(65)
    const z = await bytes(crearZip([{ nombre: 'x.bin', datos }], FECHA))
    // 30 de cabecera local + 46 de directorio + 22 de cierre + el nombre dos veces.
    expect(z.length).toBe(datos.length + 30 + 46 + 22 + 'x.bin'.length * 2)
  })

  it('un zip vacío sigue siendo un zip válido', async () => {
    const z = await bytes(crearZip([], FECHA))
    expect(z.length).toBe(22)
    expect(u32(new DataView(z.buffer), 0)).toBe(0x06054b50)
  })
})

describe('nombres', () => {
  it('quita lo que Windows no admite y no deja nombres vacíos', () => {
    expect(nombreSeguro('María / Núñez: CV?')).toBe('María - Núñez- CV-')
    expect(nombreSeguro('   ')).toBe('sin-nombre')
    expect(nombreSeguro('acaba en punto...')).toBe('acaba en punto')
  })

  it('NUNCA deja que dos candidatos con el mismo nombre se pisen', () => {
    const usados = new Set<string>()
    expect(nombreUnico('Juan Garcia', '.pdf', usados)).toBe('Juan Garcia.pdf')
    expect(nombreUnico('Juan Garcia', '.pdf', usados)).toBe('Juan Garcia (2).pdf')
    expect(nombreUnico('Juan Garcia', '.pdf', usados)).toBe('Juan Garcia (3).pdf')
    // Y cuenta SIN distinguir mayúsculas, porque Windows y macOS tampoco las
    // distinguen: dos ficheros que solo cambien de caja se pisan al
    // descomprimir. Por eso este es el CUARTO con ese nombre, no el segundo.
    expect(nombreUnico('JUAN GARCIA', '.pdf', usados)).toBe('JUAN GARCIA (4).pdf')
  })
})
