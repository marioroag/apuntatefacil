/* ---------------------------------------------------------------------------
   UN ZIP, SIN COMPRIMIR Y SIN DEPENDENCIA.
   ---------------------------------------------------------------------------
   Lo pide una sola cosa: bajarse los CV de una selección en un solo fichero.
   Y para ESO comprimir no sirve de nada: un PDF y un JPG ya vienen comprimidos,
   así que un zip "deflate" sobre ellos gana un 1-2% a cambio de meter una
   librería de 100 KB en el bundle. Con el método 0 (`store`, guardar tal cual) el
   fichero pesa lo mismo que la suma de sus partes y el formato cabe en este
   módulo.

   Es un formato binario, o sea del tipo de código que NO se verifica mirando la
   pantalla: si el offset de una tabla está mal, el zip se abre en una máquina y
   en otra no. Por eso viene con su guardián (`zip.test.ts`), que comprueba las
   firmas, los tamaños, los desplazamientos y el CRC contra valores conocidos.

   Solo se implementa lo que hace falta: sin carpetas, sin ZIP64 (el tope son 4 GB
   y un CV pesa kilobytes), sin fecha real (se escribe la del momento). Si algún
   día hace falta más, es mejor traer una librería que estirar esto.
--------------------------------------------------------------------------- */

/**
 * CRC-32 (el polinomio de PKZIP). Se calcula la tabla una vez y se reutiliza:
 * hacerla por fichero era el 90% del coste con adjuntos pequeños.
 */
const TABLA = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

export function crc32(datos: Uint8Array<ArrayBuffer>): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** La hora en formato MS-DOS, que es lo que el zip guarda (segundos de dos en dos). */
function fechaDos(d: Date) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { hora, fecha }
}

type Entrada = { nombre: string; datos: Uint8Array<ArrayBuffer> }

/**
 * Devuelve el zip como `Blob`.
 *
 * @param entradas Nombre de fichero (sin carpetas) y contenido.
 * @param ahora    La marca de tiempo, inyectable para que el guardián pueda
 *                 comprobar bytes fijos en vez de perseguir el reloj.
 */
export function crearZip(entradas: Entrada[], ahora = new Date()): Blob {
  const { hora, fecha } = fechaDos(ahora)
  const codificador = new TextEncoder()
  const trozos: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let desplazamiento = 0

  for (const e of entradas) {
    const nombre = codificador.encode(e.nombre)
    const crc = crc32(e.datos)
    const tam = e.datos.length

    // Cabecera local (30 bytes + nombre). Método 0 = guardado tal cual.
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true) // firma
    local.setUint16(4, 20, true) // versión necesaria
    local.setUint16(6, 0x0800, true) // bit 11: el nombre va en UTF-8
    local.setUint16(8, 0, true) // método: sin comprimir
    local.setUint16(10, hora, true)
    local.setUint16(12, fecha, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, tam, true) // comprimido
    local.setUint32(22, tam, true) // sin comprimir
    local.setUint16(26, nombre.length, true)
    local.setUint16(28, 0, true) // sin campo extra

    trozos.push(new Uint8Array(local.buffer), nombre, e.datos)

    // Su entrada en el directorio central (46 bytes + nombre), que es lo que de
    // verdad lee un descompresor: apunta a dónde empieza la cabecera local.
    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(4, 20, true) // versión con la que se creó
    dir.setUint16(6, 20, true) // versión necesaria
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, 0, true)
    dir.setUint16(12, hora, true)
    dir.setUint16(14, fecha, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, tam, true)
    dir.setUint32(24, tam, true)
    dir.setUint16(28, nombre.length, true)
    dir.setUint16(30, 0, true) // extra
    dir.setUint16(32, 0, true) // comentario
    dir.setUint16(34, 0, true) // disco
    dir.setUint16(36, 0, true) // atributos internos
    dir.setUint32(38, 0, true) // atributos externos
    dir.setUint32(42, desplazamiento, true)
    central.push(new Uint8Array(dir.buffer), nombre)

    desplazamiento += 30 + nombre.length + tam
  }

  const tamCentral = central.reduce((t, x) => t + x.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(4, 0, true) // disco
  fin.setUint16(6, 0, true) // disco del directorio
  fin.setUint16(8, entradas.length, true)
  fin.setUint16(10, entradas.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, desplazamiento, true)
  fin.setUint16(20, 0, true) // sin comentario

  return new Blob([...trozos, ...central, new Uint8Array(fin.buffer)], { type: 'application/zip' })
}

/**
 * Un nombre de fichero que sobreviva a Windows, macOS y a un zip: sin los
 * caracteres que Windows prohíbe, sin barras (aquí no hay carpetas) y sin puntos
 * al final. **Dos candidatos que se llamen igual no pueden pisarse**, así que
 * quien lo use tiene que numerar los repetidos: eso lo hace `nombreUnico`.
 */
export function nombreSeguro(texto: string): string {
  return texto
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '')
    .slice(0, 80) || 'sin-nombre'
}

/**
 * Añade " (2)", " (3)"... al que ya exista. Sin esto, dos "Juan Garcia.pdf" se
 * quedarían en uno solo y el zip tendría menos ficheros que candidatos, que es la
 * clase de pérdida que nadie nota hasta que busca a alguien.
 */
export function nombreUnico(base: string, ext: string, usados: Set<string>): string {
  let n = 1
  let candidato = `${base}${ext}`
  while (usados.has(candidato.toLowerCase())) candidato = `${base} (${++n})${ext}`
  usados.add(candidato.toLowerCase())
  return candidato
}
