import { useId, useState } from 'react'
import { initials, memberAvatarTone, siluetaHue } from '../../lib/format'

/**
 * La cara de una persona. Foto si la tiene; si no, una de las dos caras
 * generadas, las dos con el mismo tono estable derivado de la semilla (email o
 * id), para que la misma persona tenga siempre el mismo color en la barra, en el
 * chat y en la lista de miembros. La paleta de tonos NUNCA usa el ultramarine de
 * marca: ese color es acción, no decoración.
 *
 * Una sola primitiva para toda la app: antes cada pantalla repintaba su círculo
 * con iniciales a mano y ninguna sabía de fotos.
 *
 * **DOS CARAS GENERADAS, Y LA DIFERENCIA ES A QUIÉN SE CONOCE** (Mario, sep
 * 2026). La INICIAL es para tu EQUIPO: son cinco personas cuyos nombres te sabes,
 * la letra las distingue de un vistazo y en la agenda esas caras son además la
 * leyenda de los bloques de colores. La SILUETA es para los CANDIDATOS: son
 * desconocidos que llegan a cientos, y una letra no dice de ellos más de lo que
 * dice el nombre escrito al lado. Lo que se gana ahí es que la lista deje de
 * parecer una hoja de cálculo con las iniciales de un CRM.
 *
 * **Lo que cuesta, declarado**: la silueta es la MISMA para todos y solo cambia
 * de tono, así que diez filas seguidas se distinguen por color y no por forma. Se
 * acepta porque el nombre va SIEMPRE escrito al lado (la cara es `aria-hidden`,
 * nunca ha sido el portador de nada) y porque en esa tabla lo que se barre con la
 * vista es la columna de nombres. Si algún día molesta, la salida es devolver la
 * inicial a los candidatos, no inventar diez siluetas.
 */
export function Avatar({
  name,
  seed,
  src,
  size = 28,
  silueta = false,
  className = '',
}: {
  /** Nombre ya resuelto (real o derivado del email). De aquí salen las iniciales. */
  name: string
  /** Semilla del color: el email o el id. Estable entre pantallas. */
  seed?: string | null
  src?: string | null
  size?: number
  /** La cara con volumen en vez de la inicial. Para candidatos, no para el equipo. */
  silueta?: boolean
  className?: string
}) {
  // Una foto que no carga (borrada del bucket, red caída) cae a las iniciales en
  // vez de dejar el icono roto del navegador.
  const [failed, setFailed] = useState(false)
  // Los degradados de la silueta se referencian por id dentro del SVG, así que
  // dos caras en la misma página con el mismo id se pintarían del color de la
  // primera. Va arriba del todo, con el resto de hooks: por debajo del `return`
  // de la foto no caben (es la regla de React que ya cazó `hooks.test.ts`).
  // `useId` trae dos puntos o comillas angulares según la versión de React, y un
  // id de SVG se referencia desde un atributo: se limpia para no depender de eso.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const px = `${size}px`

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: px, height: px }}
        className={`shrink-0 rounded-full object-cover ring-1 ring-slate-900/10 ${className}`}
      />
    )
  }

  if (silueta) return <Silueta hue={siluetaHue(seed ?? name)} size={size} uid={uid} className={className} />

  // El tamaño de letra sigue al del círculo. El 44% (antes 40) es porque desde
  // ago 2026 la inicial es UNA: dos letras tenían que caber a lo ancho y por eso
  // se quedaban pequeñas; una sola puede ocupar lo que le corresponde. El suelo de
  // 9px se mantiene para los avatares de 20px del hilo.
  const fontSize = Math.max(9, Math.round(size * 0.44))
  const tone = memberAvatarTone(seed ?? name)
  return (
    <span
      aria-hidden
      style={{ width: px, height: px, fontSize: `${fontSize}px` }}
      className={`grid shrink-0 place-items-center rounded-full font-bold leading-none ${tone.bg} ${tone.text} ${className}`}
    >
      {initials(name)}
    </span>
  )
}

/**
 * LA CARA CON VOLUMEN. Cabeza y hombros sobre un disco del mismo tono, más claro.
 *
 * **MANDA LA CABEZA, Y EL CUERPO ES UN DOMO BAJO** (Mario, sep 2026: "menos
 * cuerpo y más cabeza... son demasiado altos"). Las proporciones salieron de
 * medir la referencia, y la primera lectura se quedó corta en las dos cosas: una
 * cabeza de ø29 con el cuerpo arrancando en el 54 del lienzo daba una figura
 * ALTA, o sea un tronco largo con una cabeza pequeña encima, que se lee como un
 * bolo y no como una persona. Ahora son cuatro medidas que van juntas, sobre un
 * lienzo de 100: cabeza de **ø36** centrada en el 37, cuerpo de **58 de ancho**
 * (1,6 veces la cabeza, no 1,9) que **arranca en el 64** y un hueco de 9 entre
 * los dos. Lo que se busca es que el conjunto quepa BAJO dentro del disco, con
 * aire arriba, en vez de llenarlo de arriba abajo.
 *
 * El cuerpo NO es medio círculo: es un domo de hombros elípticos y LADOS RECTOS,
 * que es lo que le da silueta de tronco en vez de silueta de seta. Y el arco es
 * más ancho que alto (rx 29, ry 20) precisamente porque tiene que quedar bajo:
 * con un arco de radios iguales, los hombros suben y devuelven la altura que
 * este ajuste vino a quitar.
 *
 * **LA LUZ ES RADIAL Y NO DIAGONAL**, y esa es la diferencia entre una esfera y
 * un disco con un degradado encima. El foco cae en el 36% de las dos coordenadas
 * (arriba a la izquierda del centro, no en el borde), así que el tono más claro
 * está DENTRO de la forma y el más oscuro le da la vuelta entera: eso es un
 * objeto iluminado de frente. Con un degradado lineal de esquina a esquina, la
 * cabeza se lee como una moneda.
 *
 * **CUARTA EXCEPCIÓN DECLARADA A "SIN GRADIENTES"**, tras el barrido del
 * skeleton, el desvanecido del scroll y el velo de las fotos de puesto, y con el
 * mismo argumento que aquellas: aquí el degradado no decora una superficie del
 * producto, ES el objeto. Un avatar generado es una ilustración, y una
 * ilustración de una esfera sin volumen no es una esfera. La regla sigue
 * prohibiendo lo que vino a prohibir, que es teñir una tarjeta o un botón.
 *
 * **El cuerpo se recorta contra el disco** (`clipPath`) porque baja hasta el filo
 * y se sale: es lo que hace que los hombros mueran en el borde en vez de flotar
 * dentro con un margen por abajo.
 */
function Silueta({
  hue,
  size,
  uid,
  className,
}: {
  hue: number
  size: number
  uid: string
  className: string
}) {
  const cara = `cara-${uid}`
  const cuerpo = `cuerpo-${uid}`
  const recorte = `recorte-${uid}`
  // MÁS RECORRIDO QUE LA REFERENCIA, y por dos motivos que apuntan al mismo
  // sitio (el segundo lo pidió Mario, sep 2026: "que se note un poco más la
  // sombra"). Uno, la imagen de la que se midió esto es un objeto grande y aquí
  // la cara se pinta a 28px en una columna de tabla, donde un tono claro se lava
  // contra el disco. Y dos, el volumen de una esfera lo hace la CAÍDA hacia el
  // borde: con poco recorrido entre el centro y el rim, la cabeza se lee como un
  // disco liso con una mancha clara encima.
  //
  // Las tres luminosidades son OKLCH y por eso son NÚMEROS FIJOS para los 79
  // tonos de la rueda: en esa escala la L es perceptual, así que 0,79 pesa igual
  // en un amarillo que en un azul. En HSL habría que corregir tono a tono, que es
  // justo la mano que nadie mantiene. El cuerpo va un peldaño por debajo de la
  // cabeza (0,76/0,49 contra 0,79/0,53) porque le da menos luz de frente.
  const luz = (L: number, C: number) => `oklch(${L} ${C} ${hue})`
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`shrink-0 ${className}`}
    >
      <defs>
        <clipPath id={recorte}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        <radialGradient id={cara} cx="0.36" cy="0.36" r="0.78">
          <stop offset="0" stopColor={luz(0.79, 0.13)} />
          <stop offset="1" stopColor={luz(0.53, 0.15)} />
        </radialGradient>
        <radialGradient id={cuerpo} cx="0.36" cy="0.34" r="0.8">
          <stop offset="0" stopColor={luz(0.76, 0.14)} />
          <stop offset="1" stopColor={luz(0.49, 0.15)} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={luz(0.955, 0.03)} />
      <g clipPath={`url(#${recorte})`}>
        <path d="M21 100V84.2A29 20.2 0 0 1 79 84.2V100Z" fill={`url(#${cuerpo})`} />
      </g>
      <circle cx="50" cy="37" r="18" fill={`url(#${cara})`} />
    </svg>
  )
}
