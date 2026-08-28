import { describe, expect, it } from 'vitest'

/**
 * EL GUARDIÁN DEL ACABADO.
 *
 * El problema que resuelve: la doctrina de acabado estaba bien escrita desde el
 * principio y aun así el código derivó en silencio. Cuando se auditó (ago 2026)
 * había CINCO opacidades distintas para la misma sombra de reposo, tres copias a
 * mano del botón secundario sin `ring-inset` (el bug de 2px que su propio fichero
 * documenta y prohíbe en un comentario de nueve líneas), un `scale` en un press,
 * y una animación de 500ms cuando el techo declarado eran 240.
 *
 * Nadie fue descuidado. Simplemente, una regla que solo vive en un documento se
 * cumple mientras alguien la recuerda, y en una pantalla nueva a las once de la
 * noche no la recuerda nadie. Por eso esto no es una nota: es una prueba que
 * FALLA cuando el acabado se sale del vocabulario.
 *
 * Qué vigila, en una frase: que las decisiones de acabado tengan NOMBRE. El
 * pecado no es tener seis sombras, es tener una sombra anónima escrita a mano en
 * una pantalla, porque esa es la que nadie vuelve a tocar cuando el sistema cambia.
 *
 * LO QUE ESTO NO PUEDE VIGILAR, y conviene tenerlo claro para no confundirlo con
 * una garantía: si la alineación óptica está bien, si el contraste real cumple,
 * si la jerarquía se lee, o si una animación se SIENTE bien. Eso sigue siendo
 * abrir el navegador y mirarlo.
 *
 * Cuando falle, hay exactamente dos salidas honestas:
 *   1. Usar el token que ya existe (el mensaje del fallo te dice cuál).
 *   2. Apuntar el caso en la lista de excepciones de abajo CON SU MOTIVO escrito.
 *      Una excepción sin motivo es un olvido con permiso.
 */

// Los ficheros se leen con los globs de Vite y no con `node:fs`: el tsconfig de
// la app no tiene los tipos de node (y meterlos solo para una prueba sería una
// dependencia nueva por nada). `?raw` los trae como texto. Esto no entra en el
// bundle: la prueba no la importa la app.
const FUENTES = import.meta.glob('../**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// El CSS entra por import directo con `?raw` y NO por `import.meta.glob`: con el
// glob, vitest devuelve cadena vacía para un .css y los detectores de coherencia
// de abajo pasaban siempre sin comprobar nada (se descubrió rompiéndolos a
// propósito). Necesita además `css: true` en el bloque test de vite.config.ts,
// que lleva su comentario explicando justo esto.
import css from '../index.css?raw'

// --- El vocabulario, leído del CSS y no copiado aquí ---------------------------
// Si mañana se añade `--shadow-loquesea` al @theme, esta lista crece sola y el
// guardián deja de quejarse de él. Copiarla a mano sería un sitio más donde la
// verdad puede desincronizarse.
//
// Se mira el CSS SIN COMENTARIOS: los de index.css explican las reglas citándolas,
// y un detector que lea prosa acaba acusándose a sí mismo (pasó de verdad: el
// comentario que advierte de no declarar sombras a mano hacía fallar justo al
// detector que lo comprueba).
const reglas = css.replace(/\/\*[\s\S]*?\*\//g, '')

const SOMBRAS = [...reglas.matchAll(/--shadow-([a-z]+):/g)].map((m) => m[1])
const DURACIONES = [...reglas.matchAll(/--duration-([a-z]+):/g)].map((m) => m[1])

// --- Excepciones, con su motivo -------------------------------------------------

/**
 * Sombras escritas a mano que NO son una elevación y por eso no salen del
 * vocabulario. Clave: el fichero. Valor: por qué.
 */
const SOMBRAS_SIN_TOKEN: Record<string, string> = {
  'screens/AppLayout.tsx':
    'Filo de luz sobre el fondo teñido del nav activo, no una elevación. Va al 72% ' +
    'porque el 16% del botón primario se pierde sobre indigo-50; un token no puede ' +
    'servir a las dos opacidades porque dependen del fondo de debajo.',
}

/** SVG propios con trazo a mano, y por qué no siguen a `--stroke-icon`. */
const TRAZOS_A_MANO: Record<string, string> = {
  'components/CuentaMenu.tsx':
    'Anillo de progreso del onboarding: es un MEDIDOR, no line art. Su grosor ' +
    'codifica el ancho de la pista, así que no se empareja con los iconos vecinos. ' +
    '(Venía de components/TopBar.tsx, retirada con el reskin de ago 2026, y viaja ' +
    'con el menú de cuenta, que es donde vive el aviso de la guía.)',
  'components/Meridian.tsx':
    'Anillo de ajuste alrededor del avatar: mismo caso, es un medidor y además su ' +
    'grosor es variable según el tamaño que le pida quien lo usa.',
  'screens/Resumen.tsx': 'Gráfico de línea semanal. Es data-viz, no un icono.',
  'components/OnboardingGuide.tsx':
    'Check de celebración, más gordo a propósito. Ya va expresado RELATIVO al ' +
    'token con calc(), así que no puede descolgarse.',
}

/**
 * Superficies que conservan `border` a secas en vez de `filo`, con su motivo. La
 * segunda mano es un `outline` y el outline se pinta ENCIMA del borde, así que un
 * elemento cuyo borde cambia de color al enfocarlo o al pasar por encima tiene que
 * mover las dos manos a la vez (`focus:filo-*`, `hover:filo-*`) o quedarse con una.
 */
const MARCO_SIN_FILO: Record<string, string> = {
  'components/GlobalSearch.tsx':
    'Es un campo, no una superficie: su borde pasa a indigo-500 con el foco y la ' +
    'segunda mano, que se pinta encima, taparía justo ese cambio. Los campos se ' +
    'quedan con una sola mano hasta que el foco pase por `filo-*`.',
}

/** Elementos que pintan borde y anillo a la vez, y por qué no es un doble trazo. */
const DOBLE_TRAZO_OK: Record<string, string> = {}

// --- Utilidades -----------------------------------------------------------------

/** Ficheros de la app, con su ruta corta para los mensajes de error. */
function fuentes(): { ruta: string; codigo: string }[] {
  return Object.entries(FUENTES)
    .map(([ruta, codigo]) => ({ ruta: ruta.replace(/^\.\.\//, ''), codigo }))
    .filter((f) => !f.ruta.endsWith('.test.tsx'))
}

/** Un fallo por cada infracción, con su sitio, para que el mensaje sea accionable. */
type Fallo = { ruta: string; linea: number; texto: string }

function buscar(re: RegExp, filtro?: (f: { ruta: string; codigo: string }) => boolean): Fallo[] {
  const out: Fallo[] = []
  for (const f of fuentes()) {
    if (filtro && !filtro(f)) continue
    f.codigo.split('\n').forEach((l, i) => {
      // Las líneas de comentario explican la regla, no la violan.
      const limpia = l.trim()
      if (limpia.startsWith('//') || limpia.startsWith('*')) return
      for (const m of l.matchAll(re)) out.push({ ruta: f.ruta, linea: i + 1, texto: m[0].slice(0, 80) })
    })
  }
  return out
}

const lista = (fallos: Fallo[]) => fallos.map((f) => `  · ${f.ruta}:${f.linea}  ${f.texto}`).join('\n')

// --- Los detectores ---------------------------------------------------------------

describe('las decisiones de acabado tienen nombre', () => {
  it('ninguna sombra se escribe a mano', () => {
    const fallos = buscar(/shadow-\[(?!var\()[^\]]+\]/g, (f) => !(f.ruta in SOMBRAS_SIN_TOKEN))

    expect(
      fallos,
      `Sombras escritas a mano en vez de usar el vocabulario:\n${lista(fallos)}\n\n` +
        `El vocabulario cerrado es: ${SOMBRAS.map((s) => `shadow-${s}`).join(', ')}.\n` +
        `Usa la que corresponda, o añade la tuya al @theme de src/index.css si de ` +
        `verdad falta un nivel. Si NO es una elevación (por ejemplo un filo de luz ` +
        `sobre un fondo teñido), apúntala en SOMBRAS_SIN_TOKEN con el motivo.`,
    ).toEqual([])
  })

  it('no se usan las sombras de Tailwind, que no son las nuestras', () => {
    const fallos = buscar(/(?<![\w-])shadow-(sm|md|lg|xl|2xl|inner)(?![\w-])/g)

    expect(
      fallos,
      `Escala de sombras de Tailwind, que no pertenece al sistema:\n${lista(fallos)}\n\n` +
        `Cámbialas por la pieza del vocabulario que toque: ${SOMBRAS.map((s) => `shadow-${s}`).join(', ')}. ` +
        `Un control en reposo es shadow-control; una tarjeta, shadow-card.`,
    ).toEqual([])
  })

  it('el press hunde el control, nunca lo encoge', () => {
    const fallos = buscar(/active:scale-[\w.[\]]+|group-active:scale-[\w.[\]]+/g)

    expect(
      fallos,
      `El press está encogiendo el elemento:\n${lista(fallos)}\n\n` +
        `Un botón físico se hunde, no se encoge: usa \`active:translate-y-px\`. ` +
        `El \`scale\` es lenguaje de dibujo animado y desentona contra los botones ` +
        `del sistema, que están todos en lib/buttons.ts.`,
    ).toEqual([])
  })

  it('el hairline de un control se pinta DENTRO de su caja', () => {
    // No todo anillo tiene que ir dentro, y confundirlo sería gritar sin motivo:
    //
    //   · El anillo que hace de CANTO del elemento (un botón, un campo, un grupo
    //     segmentado) va DENTRO. Sin `ring-inset` es un box-shadow que se pinta
    //     fuera, el control se ve 2px más grande de lo que mide, y se descuadra
    //     contra cualquier vecino que pinte su borde dentro. Ese es el bug que ya
    //     se cometió tres veces.
    //   · El anillo que es un HALO, es decir el que separa el elemento de lo que
    //     tiene detrás (el aro blanco de un avatar apilado, la chapa del contador
    //     sobre el timbre, la selección de un swatch con `ring-offset`), va FUERA
    //     a propósito: metido dentro se comería el borde de la foto o del color.
    //
    // Lo que distingue a uno de otro sin adivinar: el primero tiene ALTURA FIJA,
    // porque su razón de ser es alinearse en una fila con otros controles.
    const ALTURA_DE_CONTROL = /(?<![\w-])h-(8|9|10|11|12)(?![\w-])/
    const fallos: Fallo[] = []
    for (const f of fuentes()) {
      f.codigo.split('\n').forEach((l, i) => {
        const limpia = l.trim()
        if (limpia.startsWith('//') || limpia.startsWith('*')) return
        for (const m of l.matchAll(/(?<![\w:-])ring-([12])(?![\w-])/g)) {
          const trozo = l.slice(Math.max(0, m.index - 200), m.index + 200)
          if (trozo.includes('ring-inset')) continue
          if (trozo.includes('ring-offset')) continue // halo por construcción
          if (/(focus|focus-visible|group-focus)[-:]ring/.test(trozo)) continue
          if (!ALTURA_DE_CONTROL.test(l)) continue // no es un control de una fila
          fallos.push({ ruta: f.ruta, linea: i + 1, texto: m[0] })
        }
      })
    }

    expect(
      fallos,
      `Controles de altura fija con el anillo pintado fuera:\n${lista(fallos)}\n\n` +
        `Añade \`ring-inset\`. Sin él el ring es un box-shadow que se pinta FUERA de la ` +
        `caja: un control de 36px se ve de 38 y se descuadra contra cualquier input, que ` +
        `pinta su borde dentro. Pasó con tres copias a mano de BTN_SECONDARY y con el ` +
        `buscador del panel. Ojo al comprobarlo a mano: getBoundingClientRect() NO ve la ` +
        `diferencia (el ring no ocupa layout), hay que mirar el spread del box-shadow ` +
        `computado. Y antes de tocar nada: si lo que quieres es un botón, cógelo de ` +
        `src/lib/buttons.ts en vez de escribirlo a mano.`,
    ).toEqual([])
  })

  it('el marco de una superficie se pinta a dos manos', () => {
    // Un hairline de 1px solo es nítido mientras cae en la rejilla de píxeles, y
    // en el arco de una esquina no puede: cada píxel recibe cobertura parcial y
    // el filo pierde hasta un 23% de su pico justo en la curva (medido píxel a
    // píxel sobre el CSS real). `filo` añade una segunda mano superpuesta que no
    // cambia nada donde la cobertura ya es entera y recupera el arco donde no lo
    // es. Por eso el marco no se escribe a mano: escrito a mano es media pieza.
    const fallos = buscar(
      /(?<![\w:-])border\s+border-(?:slate|indigo|amber|green|red)-200(?![\w-])/g,
      (f) => !(f.ruta in MARCO_SIN_FILO),
    )

    expect(
      fallos,
      `Marcos pintados a una sola mano:\n${lista(fallos)}\n\n` +
        `Usa \`filo\` (o \`filo-<color>\`) en vez de \`border border-<color>-200\`. Es la ` +
        `misma caja y el mismo píxel de layout: mantiene el borde y le suma un ` +
        `outline del mismo color a -1px, o sea pintado ENCIMA, no al lado. Donde la ` +
        `cobertura del rasterizador ya es entera (los tramos rectos) no cambia nada; en ` +
        `las esquinas recupera lo que se lleva el antialias. Si esta superficie de verdad ` +
        `necesita una sola mano, apúntala en MARCO_SIN_FILO con el motivo escrito.`,
    ).toEqual([])
  })

  it('una superficie con radio no deja que su contenido llegue al filo', () => {
    // El borde de una tarjeta es de 1px y sus hijos son cajas CUADRADAS que
    // arrancan justo dentro. En los tramos rectos no se tocan, pero en el arco de
    // la esquina el cuadrado se mete en el anillo del borde y pinta su fondo
    // ENCIMA: el filo de la esquina se ve de otro color. Pasó en la tabla del
    // puesto con la banda de la cabecera (`bg-slate-50/60`) y se vio a simple
    // vista. `overflow-hidden` lo arregla pero convierte la tarjeta en contenedor
    // de scroll y deja sin efecto cualquier `sticky` de dentro; `overflow-clip`
    // recorta con el mismo radio SIN crear contenedor de scroll, que es lo que
    // permite tener las dos cosas.
    const fallos: Fallo[] = []
    for (const f of fuentes()) {
      f.codigo.split('\n').forEach((l, i) => {
        const limpia = l.trim()
        if (limpia.startsWith('//') || limpia.startsWith('*')) return
        if (!/(?<![\w-])(?:[a-z]+:)?overflow-visible(?![\w-])/.test(l)) return
        if (!/(?<![\w-])rounded-/.test(l)) return
        if (!/(?<![\w:-])(?:filo|border)(?![\w-])/.test(l)) return
        fallos.push({ ruta: f.ruta, linea: i + 1, texto: 'overflow-visible en una superficie con radio y filo' })
      })
    }

    expect(
      fallos,
      `Superficies con radio que no recortan lo que llevan dentro:\n${lista(fallos)}\n\n` +
        `Cambia \`overflow-visible\` por \`overflow-clip\`. Con \`visible\`, el fondo de ` +
        `cualquier hijo que llegue al filo se pinta encima del borde JUSTO en la curva y la ` +
        `esquina se ve de otro color. Con \`hidden\` se arregla el color y se rompe el ` +
        `\`sticky\` de dentro, porque la tarjeta pasa a ser contenedor de scroll. \`clip\` ` +
        `hace lo uno sin lo otro. Y si algo de dentro TIENE que salirse, sácalo por un ` +
        `portal con posición fija, como el menú de estado.`,
    ).toEqual([])
  })

  it('nada dura más que el techo, ni se sale de la escala', () => {
    const permitidas = DURACIONES.map((d) => `duration-[var(--duration-${d})]`)
    const fallos = buscar(/(?<![\w-])duration-(?!\[var\()[\w.[\]]+/g)

    expect(
      fallos,
      `Duraciones fuera de la escala:\n${lista(fallos)}\n\n` +
        `La escala es ${permitidas.join(' · ')}. Nada de números sueltos: ` +
        `así fue como se coló un duration-500 en una barra del panel. Elige por lo que ` +
        `hace la animación, no por lo que te parezca: control (responde al dedo), ` +
        `enter (algo aparece) o max (el techo, 240ms).`,
    ).toEqual([])
  })

  it('toda transición declara qué anima', () => {
    // `transition` a secas anima TODAS las propiedades, incluidas las de layout, y
    // eso produce los arrastres de un pixel al pasar el ratón.
    //
    // Los dos descartes son de JAVASCRIPT, no de clases, y son precisos a
    // propósito: dnd-kit devuelve una variable llamada `transition` y se pasa tal
    // cual al `style` (`{ transform, transition }`), o sea que aparece seguida de
    // una coma al desestructurarla y de una llave al colocarla. Una clase de
    // verdad nunca acaba así: cierra con comilla o con acento grave. Esto lo tapaba una
    // excepción por FICHERO (`!ruta.includes('Builder')`), que silenciaba el
    // fichero entero: un `transition` desnudo de verdad ahí dentro no lo habría
    // visto nadie. Con el descarte pegado a la forma, el guardián vuelve a mirar
    // el Builder y cubre a la vez al panel de ajustes de la vista, que usa la
    // misma librería.
    const fallos = buscar(/(?<![\w-])transition(?![-\w])(?!\s*[:=,}])/g)

    expect(
      fallos,
      `Transiciones sin lista de propiedades:\n${lista(fallos)}\n\n` +
        `Un \`transition\` desnudo anima todo, incluido el layout. Di qué animas: ` +
        `\`transition-colors\`, \`transition-opacity\` o una lista explícita como la de ` +
        `lib/buttons.ts. La doctrina es solo transform y opacity siempre que se pueda.`,
    ).toEqual([])
  })

  it('el grosor de icono sale del token', () => {
    const fallos = buscar(/strokeWidth\s*=|stroke-width=(?!%221\.75%22)/g, (f) => !(f.ruta in TRAZOS_A_MANO))

    expect(
      fallos,
      `Trazo de icono escrito a mano:\n${lista(fallos)}\n\n` +
        `Los iconos de lucide ya cogen \`--stroke-icon\` por la regla \`.lucide\` de ` +
        `index.css, así que la prop \`strokeWidth\` NO pinta (el CSS gana a los atributos ` +
        `de presentación del SVG) y solo confunde a quien la lea. Si necesitas otro grosor ` +
        `a propósito, escribe stroke-width como propiedad arbitraria (entre corchetes), mejor todavía ` +
        `relativa al token con calc(). Si es un medidor o data-viz y no un icono, ` +
        `apúntalo en TRAZOS_A_MANO con el motivo.`,
    ).toEqual([])
  })

  it('las mayúsculas van separadas', () => {
    const fallos: Fallo[] = []
    for (const f of fuentes()) {
      f.codigo.split('\n').forEach((l, i) => {
        for (const m of l.matchAll(/(?<![\w-])uppercase(?![\w-])/g)) {
          const trozo = l.slice(Math.max(0, m.index - 200), m.index + 200)
          if (/tracking-(wide|wider|widest|\[)/.test(trozo)) continue
          fallos.push({ ruta: f.ruta, linea: i + 1, texto: 'uppercase sin tracking' })
        }
      })
    }

    expect(
      fallos,
      `Mayúsculas sin tracking positivo:\n${lista(fallos)}\n\n` +
        `Las mayúsculas juntas se emplastan: piden lo contrario que los titulares. ` +
        `Añade \`tracking-[var(--tracking-overline)]\`.`,
    ).toEqual([])
  })

  it('las cifras usan un solo mecanismo', () => {
    const fallos = buscar(/(?<![\w-])(tabular-nums|tnum)(?![\w-])/g)

    expect(
      fallos,
      `Cifras tabulares por una vía que no es la del sistema:\n${lista(fallos)}\n\n` +
        `El mecanismo único es la clase \`.num\`. Llegó a haber cuatro a la vez ` +
        `(\`.num\`, la utilidad \`tabular-nums\`, una clase \`tnum\` y un \`[data-num]\` ` +
        `que no usaba nadie), y con cuatro nombres para lo mismo nadie sabe cuál toca.`,
    ).toEqual([])
  })
})

describe('el vocabulario se mantiene coherente', () => {
  it('las sombras NO se declaran a mano como utilidad', () => {
    // El fallo más caro de todos, y el más silencioso. Tailwind ya genera
    // `shadow-<nombre>` a partir de cada `--shadow-<nombre>` del @theme, y lo hace
    // alimentando `--tw-shadow`, que se compone con el anillo dentro de un ÚNICO
    // box-shadow. Declararla a mano parece inofensivo:
    //     .shadow-card { box-shadow: var(--shadow-card); }
    // y lo que hace es PISAR esa cadena con un box-shadow plano, borrando el
    // `ring` del elemento. Todo lo que llevara `ring-1 shadow-card` se quedaba sin
    // borde, fundido con el fondo, sin que fallara nada. Estuvo así en main hasta
    // que se pasaron los botones a los tokens y saltó a la vista.
    const aMano = [...reglas.matchAll(/\.shadow-([a-z]+)\s*\{\s*box-shadow:/g)].map((m) => m[1])

    expect(
      aMano,
      `Sombras declaradas a mano en src/index.css:\n` +
        aMano.map((s) => `  · .shadow-${s}`).join('\n') +
        `\n\nBórralas. Tailwind las genera solo desde \`--shadow-${aMano[0] ?? 'x'}\` en el ` +
        `@theme, y las suyas SÍ se componen con el anillo. Las tuyas lo borran, y no lo ` +
        `notarás hasta que alguien mire por qué un botón no tiene borde.`,
    ).toEqual([])
  })

  it('ningún token de duración se queda muerto', () => {
    const codigo = fuentes().map((f) => f.codigo).join('\n')
    const muertos = DURACIONES.filter((d) => !codigo.includes(`--duration-${d}`))

    expect(
      muertos,
      `Tokens de duración que no usa nadie:\n` +
        muertos.map((d) => `  · --duration-${d}`).join('\n') +
        `\n\nO se usan o se borran. Un token que no gobierna nada es la misma promesa ` +
        `falsa que un ajuste que no apaga nada: en index.css había dos curvas ` +
        `declaradas que llevaban meses sin que las leyera ni una pantalla.`,
    ).toEqual([])
  })

  it('la hoja sobre la foto se declara UNA vez', () => {
    // El anuncio y el formulario son la misma página en dos momentos: la foto a
    // sangre y la hoja subiendo sobre ella tienen que ser idénticas o pulsar
    // "Apúntate ahora" se lee como cambiar de web (pasó: el formulario metía su
    // banner dentro de una tarjeta de 480 sobre gris).
    //
    // El radio (32) y el solape (28) son un PAR que se toca a la vez: con poco
    // solape, un radio grande deja las esquinas de la foto asomando como dos
    // cuernos. Escritos en dos ficheros, el día que se afine uno el otro se
    // queda con la mitad del gesto, y eso no lo ve nadie hasta que las dos
    // pantallas están una al lado de la otra.
    const fuera = buscar(/rounded-t-\[32px\]|-mt-7\b/g, (f) => !f.ruta.endsWith('HojaPublica.tsx'))

    expect(
      fuera.map((f) => `${f.ruta}:${f.linea}`),
      `El gesto de la hoja sobre la foto, escrito fuera de su pieza:\n` +
        fuera.map((f) => `  · ${f.ruta}:${f.linea}  ${f.texto.trim().slice(0, 70)}`).join('\n') +
        `\n\nUsa <HojaPublica>. El radio y el solape son un par y viven juntos.`,
    ).toEqual([])
  })

  it('cada excepción trae su motivo escrito', () => {
    const vacias = [
      ...Object.entries(SOMBRAS_SIN_TOKEN),
      ...Object.entries(TRAZOS_A_MANO),
      ...Object.entries(DOBLE_TRAZO_OK),
      ...Object.entries(MARCO_SIN_FILO),
    ]
      .filter(([, motivo]) => motivo.trim().length < 25)
      .map(([clave]) => clave)

    expect(
      vacias,
      `Estas excepciones no explican por qué existen:\n` +
        vacias.map((v) => `  · ${v}`).join('\n') +
        `\n\nEscribe el motivo. Una excepción sin motivo es un olvido con permiso, y ` +
        `dentro de seis meses nadie sabrá si se puede quitar.`,
    ).toEqual([])
  })
})
