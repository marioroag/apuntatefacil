import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Settings2, Tag as TagIcon, Trash2, X } from 'lucide-react'
import type { Tag } from '../lib/types'
import { useStore, normalizeTagName } from '../lib/store'
import { colocarFlotante } from '../lib/flotante'
import { useEsMovil, useEsTactil } from '../lib/media'
import { useToast } from './ui/Toast'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { BottomSheet } from './ui/BottomSheet'
import { Checkbox } from './ui/Checkbox'
import { BTN_PRIMARY_SM, BTN_SECONDARY, botonIcono } from '../lib/buttons'

// ---------------------------------------------------------------------------
// Etiquetas: clasificación libre del empresario. El candidato nunca las ve.
//
// **VUELVEN AL GRIS, como el chip de documento** (Mario, sep 2026: "las etiquetas
// que vuelvan a ser grises como los documentos"). Tuvieron color desde ago 2026,
// con un argumento que era bueno para lo que había: en gris hay que LEER cada una
// para saber cómo está clasificada una persona, y con color se reconocían de un
// vistazo. Lo que cambió debajo es la letra de la fila: al pasar el chip de 11 a
// 13px (ver `TEXTO_FILA`), la misma columna dejó de ser una tira de marcas
// pequeñas y pasó a ser una pila de cápsulas teñidas del tamaño del texto, o sea
// la parte más ruidosa de una pantalla cuya doctrina es sobria y de un solo
// acento. Con la etiqueta grande, el nombre ya se lee de un vistazo y el color
// dejó de comprar lo que costaba.
//
// El gris es el del chip de DOCUMENTO de la propia fila, un peldaño más marcado:
// relleno `--color-etiqueta-fondo` y texto `slate-700` (Mario, sep 2026: "más
// grises", después "el texto un poco más oscuro" y por último "el fondo un poco
// menos gris"). El
// peldaño no es un gusto, es la medida que este proyecto ya se ha encontrado dos
// veces: `slate-100` sobre el blanco de la fila da **1,09:1**, y por debajo de ahí
// una cápsula deja de leerse como FORMA (es lo que subió la cápsula de estado del
// puesto del 50 al 200 y la pastilla de la tabla del 50 al 100). Con el 200 la
// cápsula existe (1,15:1) y el nombre encima se lee en 9,0:1. Lo APAGADO es el
// relleno, no la letra: es lo que hace que la columna se lea como una tira de
// marcas y no como seis colores, mientras el nombre, que es el dato, se lee sin
// esfuerzo. Por abajo hay suelo y está cerca: `slate-500` sobre ese mismo relleno
// da 3,9:1, por debajo del mínimo de la casa para texto con significado.
// El chip de documento se queda donde está a propósito: dice si HAY o no hay un
// fichero, aparece una vez por fila y no tiene hermanos al lado con los que
// formar una columna de cápsulas.
//
// LO QUE SE PIERDE, DICHO: dos etiquetas ya no se distinguen sin leerlas, que era
// justo lo que el color compraba. Si vuelve a hacer falta, el reparto de tonos
// sigue escrito y probado (`tagTone` y `repartirTonos` en `lib/format.ts`, con su
// guardián en `etiquetas.test.ts`): hoy se queda SIN CONSUMIDOR a propósito, para
// no tener que reescribir la parte difícil, que es repartir sin repetir.
// ---------------------------------------------------------------------------

export const TAG_LIMIT_PER_CANDIDATE = 25 // límite blando por candidato

// Alto que reserva el desplegable para decidir si abre hacia arriba: su tope
// (max-h-60 = 240px) más el hueco de 4px. Si cambia la clase, cambia esto.

// Microcopy (es-ES), en un solo sitio.
const COPY = {
  title: 'Etiquetas',
  add: 'Añadir etiqueta',
  create: (text: string) => `Crear «${text}»`,
  manage: 'Gestionar etiquetas',
  rename: 'Renombrar',
  remove: 'Eliminar',
  removeFromSel: 'Quitar etiqueta',
  addToSel: 'Añadir etiqueta',
}

/**
 * LA PIEL DE UN CHIP, declarada una vez (sep 2026). La comparten la etiqueta y el
 * "+N" de la celda: Mario los quiso iguales ("el +x tiene que tener el mismo estilo
 * que las etiquetas"), y con la clase escrita dos veces se separan al primer retoque,
 * que es lo que este proyecto lleva media doctrina evitando.
 *
 * El PESO sí lo declara el chip (y no lo hereda como el tamaño): dentro de una fila
 * coincide con el suyo, y fuera de ella (la ficha, la tarjeta del tablero) es lo que
 * impide que la misma etiqueta se lea en un grosor distinto según en qué pantalla
 * estés. Se cazó en el tablero, donde la línea de una tarjeta va en normal y los
 * chips se quedaron en normal con ella.
 */
const PIEL_CHIP = 'inline-flex min-w-0 items-center gap-1 rounded-sm bg-etiqueta-fondo font-medium text-slate-700'
/** El relleno de un chip dentro de una fila: más apretado que el del chip suelto. */
const PAD_CHIP_FILA = 'py-0.5 pl-1.5 pr-1.5'

/**
 * Chip de etiqueta: relleno gris, texto grafito, **rectángulo de 4px** y sin borde.
 *
 * El radio es la parte que hay que respetar aunque la doctrina general diga
 * "pills/chips 999px": es lo que separa una etiqueta de una pastilla de ESTADO,
 * que es redonda. Ahora que la etiqueta no lleva color, esa forma es LO ÚNICO que
 * las separa en la misma fila, así que no se toca.
 *
 * Sin `ring`: relleno limpio, y un hairline sobre un relleno tan claro solo ensucia
 * el filo.
 */
// `id` y `vocabulario` siguen en la firma y NO se leen: eran la semilla del color y
// la lista con la que se repartían los tonos sin repetir. Se quedan porque los pasa
// ya todo el que pinta un chip, así que devolver el color es volver a leerlos aquí y
// no recorrer media app; y porque una prop que desaparece y vuelve es una migración
// de ida y otra de vuelta por una decisión que este proyecto ya ha cambiado dos veces.
export function TagChip({
  name,
  onRemove,
  glyph = false,
  size = 'sm',
  entera = false,
}: {
  /** Semilla del color, cuando lo había. Es el id y no el nombre: renombrar no repinta. */
  id?: string
  name: string
  /**
   * Todas las etiquetas de la empresa, para repartir los tonos sin repetir. Va por
   * prop y no por `useStore()` a propósito: hay cientos de chips en la tabla del
   * puesto y suscribir cada uno al store lo repintaría todo con cada cambio, justo
   * en la pantalla cuya doctrina más cuida los repintados.
   */
  vocabulario?: readonly { id: string }[]
  onRemove?: () => void
  glyph?: boolean
  size?: 'fila' | 'sm'
  /**
   * No recortes el nombre ni dejes que el chip encoja. Es lo que pide una tira que
   * se desplaza (la celda de la tabla): ahí el sitio lo da el scroll, no el recorte.
   * En un contenedor que envuelve, el recorte sigue siendo lo correcto.
   */
  entera?: boolean
}) {
  // LA TALLA `fila` NO DICE DE QUÉ TAMAÑO VA, y eso es el punto (Mario, sep 2026).
  // Dentro de una fila de la rejilla (y de una línea de una tarjeta del tablero, que
  // es su hermana) el cuerpo lo declara la fila una sola vez, así que un chip que
  // escriba el suyo vuelve a abrir el abanico de tamaños que aquello vino a cerrar.
  // Lo que sí es suyo es el RELLENO, que sigue siendo más apretado que el del chip
  // suelto: ahí el chip vive en una tira que se desplaza y cada píxel de más son
  // etiquetas que dejan de verse.
  const pad = size === 'fila' ? PAD_CHIP_FILA : 'py-1 pl-2 pr-2 text-[12px]'
  return (
    <span
      className={`${PIEL_CHIP} ${
        entera ? 'shrink-0' : 'max-w-full'
      } ${onRemove ? (size === 'fila' ? 'pr-0.5' : 'pr-1') : ''} ${pad}`}
    >
      {glyph && <TagIcon className="size-3 shrink-0 opacity-70" aria-hidden />}
      {/* title: donde el chip sí se recorta (contenedores que envuelven), sin esto no
          había forma de leer la etiqueta entera sin abrir la ficha. */}
      <span className={entera ? 'whitespace-nowrap' : 'truncate'} title={name}>{name}</span>
      {onRemove && (
        // El aspa hereda la tinta del chip (`currentColor`) en vez de ir en gris:
        // un gris neutro dentro de un relleno de color se lee como suciedad.
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar etiqueta ${name}`}
          className="grid size-4 shrink-0 place-items-center rounded-full opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

/**
 * Celda de etiquetas: las que CABEN, enteras, y un "+N" con las que no (Mario, sep
 * 2026: "en vez de permitir overflow en etiquetas, que se ponga un +x y al pulsarlo
 * saque el menú de las etiquetas").
 *
 * Esto devuelve un "+N" que esta casa había retirado en ago 2026, así que conviene
 * saber qué ha cambiado para que ahora sí valga. **Aquel escondía información en un
 * callejón**: enseñaba dos etiquetas recortadas y un número, y para saber cuáles
 * eran había que pulsar fila por fila un desplegable que solo listaba nombres. Este
 * no esconde nada nuevo: la celda ENTERA ya abre la lista de etiquetas desde ago
 * 2026, y esa lista enseña el vocabulario completo con lo que esta persona tiene
 * marcado, o sea la respuesta entera y no un trozo. El "+N" solo dice cuántas no
 * caben; el clic que las enseña es el que ya había.
 *
 * Lo que se gana frente a la tira que se desplazaba: **el desplazamiento horizontal
 * dentro de una celda no se ve**. No hay barra (en una tira de 20px sería una trama
 * de rayas en 142 filas), en táctil no hay hover que lo insinúe, y el gesto se
 * peleaba con el desplazamiento de la propia tabla, que también es horizontal. Un
 * chip cortado por el filo de la columna decía "hay más" solo si te fijabas; "+3"
 * lo dice contando.
 *
 * Sigue en pie lo que aquella decisión protegía: **una etiqueta o se lee entera o no
 * sirve** ("Documentación OK" y "Documentación pendiente" empiezan igual), así que
 * las que caben van enteras y nunca recortadas, y **nunca en dos líneas**, porque la
 * fila de una rejilla tiene alto fijo.
 *
 * CÓMO SE DECIDE CUÁNTAS CABEN, y por qué así: se miden los chips UNA vez (con la
 * lista pintada entera, en un efecto de layout, o sea antes de que se pinte nada) y
 * el ancho se guarda. A partir de ahí, cambiar el ancho de la columna solo LEE el
 * ancho de la celda y recalcula la cuenta: ni una escritura en el DOM ni una
 * remedida. Es deliberado, porque el ancho de una columna se ajusta arrastrando y
 * ahí no puede haber trabajo de layout por fotograma y por fila (es la misma razón
 * por la que el arrastre escribe el ancho directo en el `<th>` y no re-renderiza).
 */
export function TagCell({ tagIds, tags }: { tagIds: string[]; tags: Tag[] }) {
  const resolved = useMemo(
    () => tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t),
    [tagIds, tags],
  )
  const caja = useRef<HTMLDivElement>(null)
  /** Lo medido: ancho de cada chip, ancho del "+N" y el hueco entre ellos. */
  const medidas = useRef<{ chips: number[]; mas: number; hueco: number } | null>(null)
  /** Cuántas se pintan y si la primera va apretada. `null` = sin medir (todo). */
  const [caben, setCaben] = useState<{ n: number; apretado: boolean } | null>(null)

  // Si cambia la lista, lo medido ya no vale: se vuelve a pintar entera y se mide.
  // Se ajusta DURANTE EL RENDER y no en un efecto, que es el patrón que esta casa ya
  // usa para resincronizar (el `AjusteTexto` de Ajustes): en un efecto sería un
  // render de más con la cuenta vieja pintada, y el linter lo caza.
  // Lo medido NO se borra aquí: un ref no se toca durante el render (lo caza el
  // linter, y con razón: un render descartado lo dejaría ya borrado). Basta con
  // volver a `null`, que hace que se pinte la lista entera y que el pase de medida
  // lo sobrescriba en el mismo commit.
  const [medida, setMedida] = useState(resolved)
  if (medida !== resolved) {
    setMedida(resolved)
    setCaben(null)
  }

  // El pase de medida. Solo ocurre con la lista entera pintada.
  useLayoutEffect(() => {
    const el = caja.current
    if (!el || caben !== null || resolved.length === 0) return
    const hijos = Array.from(el.children) as HTMLElement[]
    // Los primeros son los chips y el último el "+N", que se pinta también durante
    // la medida para poder reservarle su sitio.
    medidas.current = {
      chips: hijos.slice(0, resolved.length).map((c) => c.offsetWidth),
      mas: hijos[resolved.length]?.offsetWidth ?? 0,
      hueco: parseFloat(getComputedStyle(el).columnGap) || 0,
    }
    setCaben(cuantasCaben(el.clientWidth, medidas.current))
  }, [caben, resolved])

  // Y al cambiar el ancho de la columna, la cuenta se rehace SIN volver a medir.
  useLayoutEffect(() => {
    const el = caja.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const m = medidas.current
      if (m) setCaben((prev) => {
        const k = cuantasCaben(el.clientWidth, m)
        return prev && prev.n === k.n && prev.apretado === k.apretado ? prev : k
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (resolved.length === 0) return null

  const total = resolved.length
  const midiendo = caben === null
  const n = midiendo ? total : caben.n
  const ocultas = total - n

  return (
    // `w-full` NO es decorativo, es lo que hace que la cuenta funcione: sin él, esta
    // caja es un elemento flex que se encoge hasta su CONTENIDO, así que su
    // `clientWidth` sería el ancho de lo que acabamos de decidir pintar y no el que
    // hay disponible. Con eso, ensanchar la columna no devolvía nunca las etiquetas
    // escondidas: el hueco crecía y la caja seguía midiendo lo mismo.
    <div ref={caja} className="flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-hidden py-1">
      {resolved.slice(0, n).map((t) => (
        // `entera` (no encoge, no recorta) salvo en el caso apretado: ahí la única
        // que se pinta no cabe junto al "+N", y entre recortar el nombre o recortar
        // el número gana el número, que es el que dice que hay más. Un "+2" cortado
        // por el filo no se lee como nada.
        <TagChip
          key={t.id}
          id={t.id}
          name={t.name}
          vocabulario={tags}
          size="fila"
          entera={!(caben?.apretado ?? false)}
        />
      ))}
      {(midiendo || ocultas > 0) && (
        // NO es un botón, y eso es lo que lo deja entrar en una fila: la celda
        // entera ya es el disparador de la lista de etiquetas, así que un botón
        // aquí sería un control dentro de otro (marcado inválido) y una segunda
        // puerta para lo mismo. Durante la medida se pinta con el número más
        // grande posible, que es el más ancho: reservar de más nunca recorta un
        // chip que sí cabía.
        <span data-mas aria-hidden className={`${PIEL_CHIP} ${PAD_CHIP_FILA} num shrink-0`}>
          +{midiendo ? total : ocultas}
        </span>
      )}
      {/* Lo que no se pinta no existe para un lector de pantalla, así que se dice.
          Las que sí se ven ya las lee el chip. */}
      {ocultas > 0 && (
        <span className="sr-only">
          y {ocultas} {ocultas === 1 ? 'etiqueta más' : 'etiquetas más'}: {resolved.slice(n).map((t) => t.name).join(', ')}
        </span>
      )}
    </div>
  )
}

/**
 * Cuántos chips caben en `ancho`, dejando sitio al "+N" si alguno se queda fuera.
 *
 * Siempre se pinta al menos uno: una celda con solo "+3" no dice nada de esa
 * persona. Cuando ni ese primero cabe junto al "+N", devuelve `apretado`, y
 * entonces el chip encoge y se recorta para que el número quepa entero.
 */
function cuantasCaben(ancho: number, m: { chips: number[]; mas: number; hueco: number }) {
  let usado = 0
  for (let i = 0; i < m.chips.length; i++) {
    const pide = m.chips[i] + (i > 0 ? m.hueco : 0)
    // Si quedan más detrás, hay que reservar el sitio del "+N".
    const reserva = i < m.chips.length - 1 ? m.hueco + m.mas : 0
    if (usado + pide + reserva > ancho) return { n: Math.max(1, i), apretado: i === 0 }
    usado += pide
  }
  return { n: m.chips.length, apretado: false }
}

// Combobox "Añadir etiqueta" + chips aplicados. Para la ficha del candidato.
// owner/member pueden crear vocabulario nuevo; el encargado solo aplica existentes.
//
// Una sola forma, la de la ficha: manda el campo, porque si estás aquí vas a
// etiquetar. Hubo una variante `inline` para la cabecera del detalle (chips
// primero y un "+ Etiqueta" discreto) y se retiró en ago 2026 al bajar las
// etiquetas al Resumen a todos los anchos.
/**
 * EL BLOQUE DE ETIQUETAS DE LA FICHA: LA MISMA LISTA QUE LA BARRA DE SELECCIÓN
 * (Mario, ago 2026: "este selector es mucho mejor que el viejo, vamos a
 * reemplazar al viejo con este en el resto de sitios").
 *
 * Había DOS editores de etiquetas en la app y no eran equivalentes: el de la
 * ficha era un combobox que solo sabía AÑADIR (para quitar había que salir a los
 * chips y buscar su equis) y solo enseñaba lo que aún no tenías, así que el
 * vocabulario completo no se veía nunca desde ahí. La lista con casillas hace
 * las dos cosas en el mismo sitio, enseña todo lo que hay y busca y crea con el
 * mismo campo. Con un solo candidato es la "selección de uno" que ya usaba la
 * celda de una fila: la casilla se marca o se desmarca, sin estados a medias.
 *
 * Lo que se conserva del viejo y no se puede perder: el tope blando por
 * candidato (ahora vive en `BulkTagMenu`) y la puerta a administrar el
 * vocabulario, que desde la ficha era la única que había.
 */
/** El `id` del campo de añadir etiqueta de una ficha. Vive aquí y no escrito a
 *  mano en quien enfoca: es el mismo nombre en dos sitios que no se hablan (esta
 *  sección lo pone, el tablero lo pide), y así no se pueden separar. */
export const campoEtiquetaId = (candidateId: string) => `etiqueta-${candidateId}`

export function TagSection({
  candidateId,
  tagIds,
  canManage,
  onOpenManage,
}: {
  candidateId: string
  tagIds: string[]
  canManage: boolean
  onOpenManage: () => void
}) {
  const { tags, removeTag } = useStore()
  const aplicadas = useMemo(
    () => tagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t),
    [tagIds, tags],
  )
  // Estable entre renders: es la prop de un menú que se remonta con cada cambio
  // de candidato, y un array nuevo por render lo recolocaría sin motivo.
  const seleccion = useMemo(() => [candidateId], [candidateId])

  return (
    <div>
      {/* La misma versalita que los demás apartados del raíl, y SIN el icono de
          ayuda que llevaba al lado (Mario, ago 2026). Decía que las etiquetas
          son internas de la empresa y que quien las escribe es responsable de
          lo que anote, que es verdad y no hace falta contarlo aquí: nadie lo
          duda al escribir una, y en una columna donde los otros dos rótulos no
          llevan nada, el único glifo de la columna se lee como si esta caja
          tuviera una advertencia. Si algún día hay que decirlo, su sitio es
          donde se ADMINISTRA el vocabulario, no en cada ficha. */}
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{COPY.title}</h3>
      {/* EL DISPARADOR ES EL CAMPO, y no solo lo parece (Mario, ago 2026). En
          esta columna tiene que verse como hermano del de añadir una nota, así
          que siempre se pintó como un campo; pero era un `<button>`, y al
          pulsarlo salía el panel con SU propio buscador encima: dos cajas de
          texto, y la que acababas de tocar no escribía. Con `campo` hay una
          sola, la que pulsas, y el panel se cuelga de ella con su mismo ancho. */}
      {/* FLOTANTE, obligatorio: este bloque vive en una columna con scroll (el
          raíl de la ficha, o la de Información en móvil), y un panel `absolute`
          ahí dentro lo recorta el propio scroll. Colocado contra la ventana se
          ve entero, y `colocarFlotante` decide solo si tiene que abrirse hacia
          arriba, que es lo que el selector viejo resolvía a mano con
          `limitesVisibles` porque este bloque cae de los últimos de la columna. */}
      <BulkTagMenu
        selectedIds={seleccion}
        canManage={canManage}
        onOpenManage={onOpenManage}
        flotante
        campo
        campoId={campoEtiquetaId(candidateId)}
        // Las mismas medidas de siempre (36 de alto, radio 8, texto de 13: en la
        // ficha los campos son controles pequeños). Lo que cambia respecto al
        // disparador-botón es la TINTA: lo que escribes va en tinta y el gris se
        // queda para el marcador de posición, que antes teñía la etiqueta entera
        // porque nunca llegaba a escribirse nada dentro.
        triggerClass="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-500 hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 pointer-coarse:text-base"
      >
        {COPY.add}
      </BulkTagMenu>
      {/* LOS CHIPS CONSERVAN SU EQUIS, y no es la segunda puerta que la doctrina
          prohíbe: la lista es para BUSCAR y para ver el vocabulario entero, y la
          equis es tocar directamente lo que tienes delante. Quitarla obligaría a
          abrir una lista para desmarcar algo que ya estás mirando. En la barra de
          selección no existe porque allí no hay un chip por persona. */}
      {aplicadas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {aplicadas.map((t) => (
            <TagChip
              key={t.id}
              id={t.id}
              name={t.name}
              vocabulario={tags}
              onRemove={() => removeTag(candidateId, t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * GESTIONAR ETIQUETAS: renombrar y eliminar el vocabulario de la empresa.
 *
 * EN MÓVIL ES UNA HOJA QUE SUBE, no el diálogo centrado (Mario, ago 2026:
 * "gestionar etiquetas en móvil se sale de la pantalla, hazlo con un slide").
 * Y se salía de verdad: al renombrar, la fila pone un campo, "Guardar" y
 * "Cancelar" en línea, y eso mide **377px en una ventana de 375** (medido), así
 * que "Cancelar" acababa fuera. Un diálogo centrado, además, es la peor forma en
 * un teléfono en cuanto hay un campo: al abrirse el teclado, el sistema encoge
 * la ventana visible y lo que estaba centrado se va por arriba.
 *
 * La hoja lo arregla por su forma: nace pegada abajo, o sea justo encima del
 * teclado, y ocupa el ancho entero. Es la misma pieza que ya usan Filtros, el
 * `···` de un puesto y Cambiar estado, así que aquí no se inventa nada.
 *
 * Pero la hoja NO arregla la fila: 375px siguen sin dar para un campo y dos
 * botones. En táctil la edición se parte en dos renglones (el campo entero
 * arriba, los botones debajo). Y las dos acciones de cada etiqueta suben a
 * objetivo de toque: medían 26px, poco más de la mitad del mínimo.
 *
 * `useEsMovil` DECIDE QUÉ SE MONTA, no qué se ve: la hoja atrapa el foco y
 * escucha el Escape en `document`, así que montada y escondida con `sm:hidden`
 * se tragaría el Escape del diálogo de confirmación. Es la misma regla que ya
 * obliga a montar `BottomSheet` solo en móvil en el menú de un puesto.
 */
export function ManageTagsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tags, tagUsage, renameTag, deleteTag, restoreTag, candidates } = useStore()
  const toast = useToast()
  const esMovil = useEsMovil()
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState<Tag | null>(null)

  useEffect(() => {
    if (!open) return
    // Captura el Escape ANTES que capas de debajo (p. ej. la ficha del candidato):
    // así cerrar esto no cierra también la ficha. Cierra de dentro hacia fuera.
    // Y al cortar la propagación aquí, el Escape propio de `BottomSheet` (que
    // escucha en el mismo nodo, en fase de burbuja) no llega a dispararse: no hay
    // dos cierres, solo este.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (confirm) setConfirm(null)
      else if (editId) setEditId(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey, true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prev
    }
  }, [open, onClose, editId, confirm])

  if (!open) return null

  const startEdit = (t: Tag) => {
    setEditId(t.id)
    setDraft(t.name)
  }
  const saveEdit = async () => {
    if (!editId) return
    const ok = await renameTag(editId, draft)
    if (ok) setEditId(null)
  }
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))

  const doDelete = (t: Tag) => {
    const affectedIds = candidates.filter((c) => c.tagIds.includes(t.id)).map((c) => c.id)
    setConfirm(null)
    deleteTag(t.id)
    toast.success('Etiqueta eliminada', {
      action: { label: 'Deshacer', onClick: () => restoreTag(t, affectedIds) },
    })
  }

  // El vocabulario, igual en las dos superficies: lo que cambia es el envoltorio,
  // no la lista. Es lo mismo que hacen el submenú de Sede y el de Exportar, que
  // son páginas en móvil y paneles al lado en escritorio con un solo contenido.
  const lista =
    sorted.length === 0 ? (
      <p className="px-2 py-8 text-center text-sm text-slate-500">
        Aún no tienes etiquetas. Créalas desde la ficha de un candidato.
      </p>
    ) : (
      <ul className="space-y-0.5">
        {sorted.map((t) => {
          const usage = tagUsage(t.id)
          const editing = editId === t.id
          return (
            <li
              key={t.id}
              // `flex-wrap` SOLO en la fila que se está editando, y esto se vio en
              // pantalla: puesto en todas, la fila de "Documentación OK" mandaba su
              // papelera a un segundo renglón en vez de encoger el chip. Sin envolver,
              // el chip hace lo que sabe hacer (encoger y recortar, con el nombre
              // entero en su `title`), que es lo correcto en una fila de alto fijo;
              // envolviendo, una lista de siete etiquetas se lee a saltos.
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 ${
                editing ? 'flex-wrap' : ''
              }`}
            >
              {editing ? (
                <>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setEditId(null)
                      }
                    }}
                    autoFocus
                    maxLength={40}
                    // 16px en táctil no es estética: por debajo de eso iOS hace
                    // zoom al enfocar, y aquí el campo aparece justo encima del
                    // teclado que acaba de abrirse.
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 pointer-coarse:h-11 pointer-coarse:basis-full pointer-coarse:text-base"
                  />
                  {/* `min-h-11` y no otra talla de botón: `BTN_PRIMARY_SM` fija
                      un `h-8`, y en la misma fila "Cancelar" ya sube a 44 en
                      táctil, así que sin esto la pareja quedaba en escalera (32
                      contra 44, medido). El mínimo y el alto son propiedades
                      distintas, así que componen en vez de pelearse. */}
                  <button onClick={saveEdit} className={`${BTN_PRIMARY_SM} shrink-0 pointer-coarse:ml-auto pointer-coarse:min-h-11`}>
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="shrink-0 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100 pointer-coarse:min-h-11"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <TagChip id={t.id} name={t.name} vocabulario={tags} glyph />
                  <span className="ml-auto shrink-0 text-[12px] num text-slate-500">
                    {usage} {usage === 1 ? 'candidato' : 'candidatos'}
                  </span>
                  {/* Los dos verbos salen de `botonIcono`, no de una pintura
                      escrita aquí: medían 26px, poco más de la mitad del objetivo
                      de toque, y en una hoja de móvil eso es fallar el dedo. Son
                      además los mismos dos que corrigen y borran una nota, así
                      que se leen igual. */}
                  <button
                    onClick={() => startEdit(t)}
                    aria-label={`${COPY.rename} ${t.name}`}
                    title={COPY.rename}
                    className={botonIcono('ghost', 'md')}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                  <button
                    onClick={() => setConfirm(t)}
                    aria-label={`${COPY.remove} ${t.name}`}
                    title={COPY.remove}
                    className={botonIcono('ghost', 'md', 'hover:bg-red-50 hover:text-red-600')}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    )

  // La nota del vocabulario común: en el diálogo cabe bajo el título; en la hoja,
  // cuyo título es una sola línea, abre el cuerpo. Es la misma frase en el mismo
  // sitio de lectura, no dos textos.
  const nota = 'El vocabulario es común a toda tu empresa.'

  const confirmar = (
    <ConfirmDialog
      open={!!confirm}
      onClose={() => setConfirm(null)}
      onConfirm={() => confirm && doDelete(confirm)}
      title={`¿Eliminar «${confirm?.name}»?`}
      confirmLabel="Eliminar"
      confirmVariant="danger"
    >
      {confirm && (() => {
        const n = tagUsage(confirm.id)
        return n > 0 ? (
          <>Se quitará de <strong className="font-semibold text-slate-800">{n} {n === 1 ? 'candidato' : 'candidatos'}</strong>. Podrás deshacerlo justo después.</>
        ) : (
          <>No la usa ningún candidato. Podrás deshacerlo justo después.</>
        )
      })()}
    </ConfirmDialog>
  )

  if (esMovil)
    return (
      <>
        {/* `z-[55]` y no el z-50 de fábrica: esto se abre DESDE la ficha del
            candidato, que ya es un modal a 50. Y `inert` mientras el diálogo de
            confirmación está encima, o la hoja le robaría el foco. */}
        <BottomSheet open={open} onClose={onClose} title={COPY.manage} zClass="z-[55]" inert={!!confirm}>
          <p className="px-4 pb-1 pt-3 text-[13px] text-slate-500">{nota}</p>
          <div className="px-2 pb-3 pt-1">{lista}</div>
        </BottomSheet>
        {confirmar}
      </>
    )

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="managetags-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-pop">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="managetags-title" className="text-lg font-semibold text-slate-900">{COPY.manage}</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">{nota}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className={`-mr-1 ${botonIcono('ghost', 'sm')}`}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">{lista}</div>
      </div>

      {confirmar}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   ETIQUETAR UNA SELECCIÓN: UN SOLO BOTÓN (Mario, ago 2026)
   ---------------------------------------------------------------------------
   Eran DOS, "Añadir etiqueta" y "Quitar etiqueta", cada uno con su desplegable.
   Y no era solo un botón de más en la barra: eran dos listas distintas de lo
   mismo (una con el vocabulario entero, otra solo con lo que la selección ya
   tenía), así que para saber cómo está etiquetada la gente que has marcado había
   que abrir el segundo, y para corregirte, cerrar uno y abrir el otro.

   Ahora es UN botón y una sola lista: el vocabulario entero con una casilla por
   etiqueta que dice cómo está la selección respecto a ella. Marcada, la tienen
   todos; en indeterminado, la tienen algunos; vacía, ninguno. Pulsarla lleva a
   todos al mismo sitio.

   DOS CONSECUENCIAS QUE NO SON DETALLES:

   1. **Deja de ser un menú de VERBOS y pasa a ser un editor de ESTADO**, así que
      al pulsar NO se cierra. Es el mismo desempate que separa el `···` del puesto
      (verbos, se cierra) de su menú de estado (eliges y te quedas). Antes había
      que reabrir el menú por cada etiqueta.
   2. **El estado se lee ANTES de tocar nada.** Es lo que la lista de "quitar" no
      podía dar: enseñaba lo que había, pero solo si ibas a quitarlo.

   Se declara con `Checkbox`, que es lo que la doctrina pide para elegir de una
   lista (el interruptor es para lo que está funcionando), y va dentro de un
   `<label>`: un `<input>` no puede vivir dentro de un `<button>`.
--------------------------------------------------------------------------- */
export function BulkTagMenu({
  selectedIds,
  canManage,
  onOpenManage,
  triggerClass,
  placement = 'down',
  flotante = false,
  campo = false,
  campoId,
  children,
  onDone,
}: {
  selectedIds: string[]
  canManage: boolean
  /** Abre el modal de administrar el vocabulario. Sin él, la fila no se pinta:
   *  en la barra de selección no hay dónde volver, y una puerta que no lleva a
   *  ningún sitio es peor que ninguna. */
  onOpenManage?: () => void
  triggerClass?: string
  placement?: 'up' | 'down'
  /**
   * Coloca el panel contra la VENTANA, en un portal, en vez de colgarlo del
   * disparador. Es obligatorio cuando vive dentro de la rejilla: allí lo
   * recortarían el desplazamiento horizontal de la tabla y el `overflow-clip` de
   * la tarjeta. En la barra flotante no hace falta, porque esa barra ya es fija.
   */
  flotante?: boolean
  /**
   * EL DISPARADOR ES EL CAMPO DE BUSCAR, no un botón que abre otro campo
   * (Mario, ago 2026: "debería usar el campo de texto que el usuario acaba de
   * clickear, no hacer aparecer otro").
   *
   * En la ficha, el disparador ya se PINTABA como un campo (para ser hermano del
   * de añadir una nota), pero era un `<button>`: al pulsarlo salía el panel con
   * SU propio buscador encima, así que había dos cajas de texto, una tapando a
   * la otra, y la que acababas de tocar no servía para escribir. Con esta
   * variante hay una sola: la que pulsas es la que filtra.
   *
   * Se lleva por delante el problema del teclado en táctil sin necesidad de
   * `useEsTactil`: el campo se enfoca porque el dedo lo ha tocado, no porque un
   * `autoFocus` se lo robe al abrirse un panel.
   *
   * Y el panel toma el ANCHO del campo en vez de su `w-60` fijo, porque aquí el
   * campo mide lo que mida la columna y un panel más estrecho se lee como una
   * pieza que no es de él.
   */
  campo?: boolean
  /** `id` del campo, para poder llegar a él con el foco desde otra pantalla
   *  (`ui/Modal` acepta `focoInicial`). Solo tiene sentido con `campo`. */
  campoId?: string
  /** Contenido del disparador. Sin él, el icono y la palabra "Etiquetas". */
  children?: ReactNode
  onDone?: () => void
}) {
  const { tags, candidates, applyTagToMany, removeTagFromMany, createTag } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const esTactil = useEsTactil()
  // EN TÁCTIL EL DISPARADOR VUELVE A SER UN BOTÓN, aunque se pinte como el campo
  // (Mario, ago 2026: "al abrir lo de las etiquetas, que no entre solo al campo
  // de texto"). La variante `campo` nació con el argumento de que el teclado no
  // molesta porque el dedo ha tocado el campo a propósito; en el uso real el
  // primer toque significa "enséñame la lista", no "voy a escribir", y el
  // teclado del sistema se levanta tapando justo lo que se ha venido a mirar.
  // Con puntero fino se queda el campo vivo (abres y filtras sin mover el
  // ratón); con el dedo, el toque abre la lista y el buscador vive DENTRO del
  // panel, sin enfocarse solo, que es la regla de siempre de esta casa. Quien
  // quiera buscar lo toca, que está ahí.
  const campoVivo = campo && !esTactil
  const ref = useRef<HTMLDivElement>(null)
  // El ancla es el DISPARADOR (el botón, o el campo en la variante `campo`), no
  // el envoltorio: en modo flotante el envoltorio va en `display: contents` (para
  // que el botón sea el hijo directo de la barra segmentada y estire a lo alto),
  // y un elemento sin caja devuelve un rect a cero, o sea que el panel se
  // colocaría en la esquina de la pantalla.
  const botonRef = useRef<HTMLButtonElement>(null)
  const campoRef = useRef<HTMLInputElement>(null)
  const anclaRef = campoVivo ? campoRef : botonRef
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // Ancho del campo, para que el panel mida lo mismo. Se mide en vez de heredarse
  // por CSS porque el panel vive en un PORTAL colgado del `body`: allí no hay
  // ningún antepasado del que sacar el ancho de la columna.
  const [anchoCampo, setAnchoCampo] = useState<number>()

  // Se coloca contra la ventana y se recoloca con los dos desplazamientos que lo
  // pueden dejar huérfano: el de la página y el de la propia tabla.
  useLayoutEffect(() => {
    if (!open || !flotante) return
    const colocar = () => {
      const ancla = anclaRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!ancla || !panel) return
      // El ancho se fija ANTES de decidir la posición: `colocarFlotante` aprieta
      // contra el filo usando el ancho del panel, así que midiéndolo después el
      // panel se colocaría con una medida que ya no es la suya.
      if (campo) setAnchoCampo(ancla.width)
      const { top, left } = colocarFlotante(
        ancla,
        { width: campo ? ancla.width : panel.width, height: panel.height },
        { width: window.innerWidth, height: window.innerHeight },
        { alinear: 'izquierda' },
      )
      setPos({ top, left })
    }
    colocar()
    window.addEventListener('resize', colocar)
    const main = document.getElementById('contenido')
    main?.addEventListener('scroll', colocar, { passive: true })
    const tabla = anclaRef.current?.closest('.overflow-x-auto')
    tabla?.addEventListener('scroll', colocar, { passive: true })
    return () => {
      window.removeEventListener('resize', colocar)
      main?.removeEventListener('scroll', colocar)
      tabla?.removeEventListener('scroll', colocar)
    }
  }, [open, flotante, campo, anclaRef])

  // Al cerrar se olvida lo buscado. Con el disparador hecho campo no es opcional:
  // el texto se quedaría escrito a la vista, donde debería poner "Añadir
  // etiqueta". Y de paso arregla que al reabrir el panel de un botón la lista
  // saliera ya filtrada por lo que escribiste la vez anterior.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const dentro = (t: Node | null) =>
      (ref.current?.contains(t as Node) ?? false) || (panelRef.current?.contains(t as Node) ?? false)
    const onDoc = (e: MouseEvent) => !dentro(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Corta la propagación: si no, cerraría además la ficha o el diálogo que
      // haya detrás, en vez de solo esta lista.
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    // EN CAPTURA, y no es un detalle: el `stopPropagation` de arriba llevaba
    // tiempo sin cumplir lo que promete su comentario. `ui/Modal` (la ficha)
    // escucha el mismo evento en el MISMO nodo (`document`) y en la misma fase,
    // y se registra ANTES, al montarse, mientras este se registra al abrirse la
    // lista. Dos listeners en el mismo nodo y la misma fase corren en ORDEN DE
    // REGISTRO, así que la ficha se cerraba entera antes de que esto pudiera
    // cortar nada: abrías la lista de etiquetas, pulsabas Escape y perdías el
    // candidato. En fase de captura, `document` es el primer nodo del recorrido,
    // así que esto corre antes que cualquier listener de burbuja y el corte llega
    // a tiempo. Es lo que ya hacían `ManageTagsModal` y el menú `···` de la ficha,
    // que son justamente los dos que sí funcionaban.
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  // Cuántos de los marcados tiene cada etiqueta. De aquí salen los tres estados
  // de la casilla, y se cuenta una sola vez para todo el vocabulario en vez de
  // recorrer la selección por fila.
  const cuantos = useMemo(() => {
    const marcados = new Set(selectedIds)
    const m = new Map<string, number>()
    for (const c of candidates) {
      if (!marcados.has(c.id)) continue
      for (const t of c.tagIds) m.set(t, (m.get(t) ?? 0) + 1)
    }
    return m
  }, [candidates, selectedIds])

  const q = normalizeTagName(query).toLowerCase()
  const list = useMemo(
    () =>
      tags
        .filter((t) => !q || t.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tags, q],
  )
  const exactExists = q.length > 0 && tags.some((t) => t.name.toLowerCase() === q)
  const showCreate = canManage && q.length > 0 && q.length <= 40 && !exactExists

  // La tienen TODOS -> se la quitamos a todos. Si no (ninguno o algunos), se la
  // ponemos a todos: desde "algunos", lo que se espera de una casilla a medias es
  // que al pulsarla se llene, no que se vacíe.
  const alternar = (tagId: string) => {
    if ((cuantos.get(tagId) ?? 0) === selectedIds.length) {
      removeTagFromMany(selectedIds, tagId)
      onDone?.()
      return
    }
    // El tope es BLANDO y se avisa solo cuando no se puede hacer nada: si de diez
    // marcados hay uno lleno, a los otros nueve se les pone igual, porque frenar
    // a los diez por culpa de uno sería castigar a la selección entera. El aviso
    // sale cuando NINGUNO puede recibirla, que es el único caso en el que pulsar
    // no hace nada y sin explicación parecería roto.
    const puede = candidates.some(
      (c) => selectedIds.includes(c.id) && !c.tagIds.includes(tagId) && c.tagIds.length < TAG_LIMIT_PER_CANDIDATE,
    )
    if (!puede) {
      toast.show(`Una candidatura admite hasta ${TAG_LIMIT_PER_CANDIDATE} etiquetas.`)
      return
    }
    applyTagToMany(selectedIds, tagId)
    onDone?.()
  }

  const lista = (
    <>
          {/* El buscador SOLO cuando el disparador es un botón (el de siempre, o
              el de la variante `campo` en táctil). Con el campo VIVO el
              disparador YA es ese mismo campo, así que pintarlo aquí serían dos
              cajas de texto, una encima de la otra, y la que acabas de tocar no
              filtraría nada. */}
          {!campoVivo && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={canManage ? 'Buscar o crear...' : 'Buscar etiqueta...'}
            // En táctil NO se enfoca solo: levantaría el teclado del sistema y
            // taparía la propia lista de etiquetas, que es lo que has venido a
            // mirar. Aquí importa más que en el menú de filtros, porque esta lista
            // se abre desde la celda de una fila, con el pulgar. El campo de
            // RENOMBRAR sí se enfoca, y no es una excepción caprichosa: allí has
            // pulsado "renombrar", o sea que vas a escribir seguro.
            autoFocus={!esTactil}
            maxLength={40}
            className="mb-1 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
          )}
          <ul className="max-h-52 overflow-y-auto">
            {list.length === 0 && !showCreate && (
              <li className="px-2.5 py-2 text-[13px] text-slate-500">
                {tags.length === 0 ? 'Todavía no tienes etiquetas.' : 'Ninguna etiqueta coincide.'}
              </li>
            )}
            {list.map((t) => {
              const n = cuantos.get(t.id) ?? 0
              const todos = n === selectedIds.length
              return (
                <li key={t.id}>
                  {/* Fila entera pulsable, y el nombre va como CHIP: es como se ve
                      esta etiqueta en la tabla y en la ficha, así que aquí se
                      reconoce por lo mismo, el color, en vez de leerse. */}
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-100">
                    <Checkbox
                      checked={todos}
                      indeterminate={!todos && n > 0}
                      onChange={() => alternar(t.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <TagChip id={t.id} name={t.name} vocabulario={tags} />
                    </span>
                  </label>
                </li>
              )
            })}
            {showCreate && (
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    const tag = await createTag(query)
                    if (!tag) return
                    applyTagToMany(selectedIds, tag.id)
                    setQuery('')
                    onDone?.()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{COPY.create(normalizeTagName(query))}</span>
                </button>
              </li>
            )}
          </ul>
          {canManage && onOpenManage && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onOpenManage()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                <Settings2 className="size-3.5 shrink-0" aria-hidden />
                {COPY.manage}
              </button>
            </div>
          )}
    </>
  )

  return (
    <div className={flotante && !campo ? 'contents' : 'relative'} ref={ref}>
      {campoVivo ? (
        // El MISMO campo que pulsas es el que filtra. Se abre al enfocarlo (con
        // el ratón o con el tabulador) y también al escribir, que es lo que hace
        // falta cuando vuelves a él con el panel ya cerrado.
        <input
          ref={campoRef}
          id={campoId}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={typeof children === 'string' ? children : COPY.add}
          maxLength={40}
          aria-expanded={open}
          aria-label={COPY.add}
          className={triggerClass}
        />
      ) : campo ? (
        // El mismo aspecto que el campo (es el hermano del de añadir una nota y
        // tienen que seguir pareciéndolo), pero un BOTÓN: abrirlo no levanta el
        // teclado. La tinta es la del marcador de posición, porque lo que enseña
        // es la invitación, no un valor escrito.
        <button
          ref={botonRef}
          type="button"
          id={campoId}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={COPY.add}
          className={`${triggerClass ?? ''} block text-left`}
        >
          {/* La tinta del marcador va en un HIJO y no pegada al triggerClass:
              este trae su `text-slate-900` y dos colores en el mismo className
              se resuelven por orden de emisión del CSS, no de escritura. */}
          <span className="text-slate-500">{typeof children === 'string' ? children : COPY.add}</span>
        </button>
      ) : (
      <button
        ref={botonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={triggerClass ?? `${BTN_SECONDARY}`}
      >
        {children ?? (
          <>
            <TagIcon className="size-4" aria-hidden />
            {COPY.title}
          </>
        )}
      </button>
      )}
      {open && (flotante
        ? createPortal(
          <div
            ref={panelRef}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? 'visible' : 'hidden',
              // En la variante `campo`, el panel mide lo que mida el campo. Va en
              // `style` y no en una clase porque el ancho es un DATO medido del
              // ancla, no una talla del sistema.
              ...(campo && anchoCampo ? { width: anchoCampo } : null),
            }}
            className={`fixed z-50 overflow-hidden rounded-xl filo bg-white p-1.5 shadow-pop ${campo ? '' : 'w-60'}`}
          >
            {lista}
          </div>,
          document.body,
        )
        : (
        <div ref={panelRef} className={`absolute left-0 z-50 w-60 overflow-hidden rounded-xl filo bg-white p-1.5 shadow-pop ${placement === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {lista}
        </div>
      ))}
    </div>
  )
}
