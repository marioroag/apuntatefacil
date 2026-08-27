import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useDesvanecido } from '../../lib/desvanecido'

/**
 * Pestañas del sistema. Una sola gramática en toda la app: subrayado a 2px en el
 * activo (ultramarine = nav activo, uso permitido del acento), peso y tinta para
 * la jerarquía, gris con subrayado al pasar por encima en los demás.
 *
 * Dos reglas de acabado que se ganaron a pulso (ago 2026), y que son la razón de
 * que aquí haya medición y no solo clases:
 *
 * 1. **Una pestaña mide siempre lo mismo, activa o no.** Desde ago 2026 eso sale
 *    gratis: el PESO ya no cambia (Mario), así que el ancho tampoco. La jerarquía
 *    la dan la tinta y el subrayado, que ya son dos señales; engordar además la
 *    etiqueta la hacía leerse más grande y dejaba la fila en escalera.
 *    Antes había aquí un pseudo-elemento fantasma en negrita que reservaba el
 *    ancho de la variante gruesa, porque sin él activar una pestaña la ensanchaba
 *    un par de píxeles y empujaba a todas sus vecinas. Se retiró con el peso
 *    variable: el problema desapareció en vez de seguir compensándose. Si algún
 *    día vuelve a cambiar el peso, vuelve el fantasma.
 * 2. **El subrayado es UNO SOLO y se desliza.** Es un objeto que se mueve de una
 *    pestaña a la siguiente, no dos rayas que se encienden y se apagan; el
 *    movimiento es lo que ata visualmente lo que pulsaste con lo que va a
 *    cambiar debajo. Se anima con `transform` (`translateX` + `scaleX` sobre una
 *    barra de 1px), nunca con `left`/`width`, que son layout.
 *
 * Semántica completa (`tablist`/`tab`/`tabpanel`) y navegación con flechas, que
 * es lo que se olvida al copiar el patrón a mano: con el foco en una pestaña,
 * ← → cambian de pestaña y Inicio/Fin saltan a los extremos. Solo la activa
 * entra en el orden de tabulación; desde ella, un Tab lleva al panel.
 *
 * El panel va con <TabPanel> y el mismo `idPrefix`: así los ids que atan pestaña
 * y contenido los pone el componente, no cada pantalla.
 */
export type TabItem<T extends string> = {
  value: T
  label: string
  /** Recuento a la derecha. Solo cuando el número informa (mensajes, sí; campos, no). */
  count?: number
}

const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`
const panelId = (prefix: string, value: string) => `${prefix}-panel-${value}`

/**
 * Lo que el subrayado sobresale a cada lado de su pestaña (era el `-inset-x-1.5`
 * de cuando cada botón pintaba el suyo). Una etiqueta corta ("CV") pide más marca
 * que su propio ancho, y así se consigue sin separar las pestañas entre sí.
 */
const SANGRADO = 6

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  idPrefix,
  label,
  className = '',
  variante = 'subrayado',
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  /** Prefijo de los ids; debe ser único por grupo de pestañas de la pantalla. */
  idPrefix: string
  /** Nombre del grupo para lectores de pantalla ("Secciones del candidato"). */
  label: string
  className?: string
  /**
   * `subrayado` es LA pestaña: la que dice en qué parte de la pantalla estás, con
   * su filo abajo y su barra deslizante.
   *
   * `pastilla` es un grupo SECUNDARIO dentro del contenido: tres vistas de una
   * misma cosa (las respuestas de un candidato, sus documentos y lo que opina
   * Meridian, en la ficha de móvil). Existe porque **dos grupos con la misma
   * pinta en la misma pantalla se leen como un solo sistema**, y entonces el de
   * dentro parece una cuarta pestaña de la página. La forma sale de la
   * referencia de JOIN (ago 2026) y la pintura, de nuestros tokens.
   *
   * Aquí NO hay barra deslizante, y no es un olvido: `scaleX` sobre un
   * rectángulo redondeado le estira el radio, así que la pastilla se deformaría
   * al viajar. El precedente es nuestro, el conmutador Activos/Rechazados, que
   * tampoco desliza: en un control segmentado la señal es el relleno.
   */
  variante?: 'subrayado' | 'pastilla'
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const barraRef = useRef<HTMLSpanElement>(null)
  // Si la tira de pastillas puede deslizarse, y hacia qué lado. De aquí cuelga
  // el desvanecido de los filos: ver `mascara`.
  // Si la barra ya está puesta, el siguiente movimiento se anima; si no (primer
  // pintado, o el grupo venía de un `display:none`), aparece ya en su sitio.
  const puesta = useRef(false)

  // Firma estable del contenido: las pantallas pasan el array en línea, así que
  // `items` es nuevo en cada render y como dependencia mediría en todos.
  //
  // Con `JSON.stringify` y no concatenando a mano: la versión anterior separaba
  // los campos con un BYTE NULO, y un fichero fuente con un `\x00` dentro deja
  // de ser texto para git, que lo trata como binario y se queda sin diff y sin
  // blame. En este proyecto, donde la doctrina vive en los comentarios, eso es
  // caro. Y de paso no hay separador que se pueda colar dentro de una etiqueta.
  const firma = JSON.stringify(items.map((t) => [t.value, t.label, t.count ?? null]))

  // El desvanecido de los filos: ver `lib/desvanecido.ts`. Es lo que anuncia que
  // la tira continúa, y solo por el lado que de verdad tiene algo más.
  const mascara = useDesvanecido(listRef, 'x', { activo: variante === 'pastilla', senal: firma })

  useLayoutEffect(() => {
    const lista = listRef.current
    const barra = barraRef.current
    if (!lista || !barra) return

    const colocar = () => {
      const activo = lista.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      // Sin ancho no hay nada que medir: el grupo está oculto (el aside de la
      // ficha por debajo de lg). Medir ahí dejaría la barra clavada en el 0 y
      // luego la veríamos venir desde el borde al aparecer.
      if (!activo || !activo.offsetWidth) {
        barra.style.opacity = '0'
        puesta.current = false
        return
      }
      if (!puesta.current) barra.setAttribute('data-quieta', '')
      barra.style.opacity = '1'
      barra.style.transform =
        `translateX(${activo.offsetLeft - SANGRADO}px) scaleX(${activo.offsetWidth + SANGRADO * 2})`
      if (!puesta.current) {
        void barra.offsetWidth // fuerza el reflow ANTES de devolverle la transición
        barra.removeAttribute('data-quieta')
        puesta.current = true
      }
    }

    colocar()
    // Se recoloca cuando cambia el ancho de la fila (ventana, panel, columna) y
    // cuando termina de cargar Geist: con la fuente de reserva las etiquetas
    // miden otra cosa y la barra se quedaría sobrando o corta.
    const ro = new ResizeObserver(colocar)
    ro.observe(lista)
    let vivo = true
    document.fonts?.ready.then(() => { if (vivo) colocar() })
    return () => {
      vivo = false
      ro.disconnect()
    }
  }, [value, firma])

  // LA PASTILLA ACTIVA SE TRAE A LA VISTA. Es la mitad del aviso de que la tira
  // se desliza: al elegir la última, la tira se mueve, y ese movimiento enseña
  // que hay más de lo que se ve. `inline: 'nearest'` mueve lo mínimo y no toca
  // el scroll vertical de la columna que la contiene.
  useLayoutEffect(() => {
    if (variante !== 'pastilla') return
    listRef.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [variante, value])

  const move = (dir: -1 | 1 | 'first' | 'last') => {
    const i = items.findIndex((t) => t.value === value)
    const next =
      dir === 'first' ? 0
      : dir === 'last' ? items.length - 1
      : (i + dir + items.length) % items.length
    const target = items[next]
    if (!target) return
    onChange(target.value)
    // El foco sigue a la selección (activación automática, patrón estándar).
    window.requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(idPrefix, target.value))}`)?.focus()
    })
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      /**
       * EL DESPLAZAMIENTO LO PONE LA PIEZA, Y SOLO LA PASTILLA.
       *
       * El subrayado NO puede ser contenedor de scroll, y esto se midió: la
       * barra activa vive en `bottom: -1px` (y los botones llevan `-mb-px`) para
       * TAPAR el filo del `tablist`, así que sobresale 1px por debajo de la
       * caja. En cuanto alguien le pone `overflow-x-auto`, el navegador computa
       * también `overflow-y: auto` y ese píxel se convierte en **1px de scroll
       * vertical** (44 de alto contra 43 de caja), que en un trackpad se nota
       * como un temblor. Y no se arregla recortando: `hidden` o `clip` se comen
       * justo la mitad del subrayado.
       *
       * No hace falta, además: un grupo de subrayado son dos o tres destinos
       * cortos que caben. El que sí desborda de verdad es el de pastillas, que
       * lleva cinco y vive en 375px, y ahí no hay nada que sobresalga (ni barra
       * ni margen negativo). Por eso el scroll se declara aquí, atado a la
       * variante que lo necesita, en vez de dejarlo en manos de quien la monta.
       */
      className={`relative flex items-center ${
        variante === 'pastilla'
          ? 'gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'gap-5 border-b border-slate-200'
      } ${className}`}
      style={mascara ? { maskImage: mascara, WebkitMaskImage: mascara } : undefined}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
        else if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
        else if (e.key === 'Home') { e.preventDefault(); move('first') }
        else if (e.key === 'End') { e.preventDefault(); move('last') }
      }}
    >
      {items.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            id={tabId(idPrefix, t.value)}
            aria-selected={active}
            aria-controls={panelId(idPrefix, t.value)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            // El PESO no cambia entre activa e inactiva (Mario, ago 2026): la
            // jerarquía la dan la tinta y el subrayado, que ya son dos señales.
            // Engordar además la etiqueta la hacía leerse más grande y convertía
            // la fila en una escalera donde la activa sobresalía del renglón.
            // El PESO tampoco cambia en la pastilla, por lo mismo: la señal es
            // el relleno y la tinta, y engordar la etiqueta ensancharía su caja.
            className={
              variante === 'pastilla'
                ? `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                : `relative -mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent pb-2.5 pt-3 text-sm font-medium transition-colors ${
                    active ? 'text-slate-900' : 'text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`
            }
          >
            {/* Aquí vivía un fantasma en negrita (`after:content-[attr(data-label)]`)
                que reservaba el ancho de la variante gruesa, para que activar una
                pestaña no ensanchara su botón y empujara a las vecinas. Con el peso
                fijo, ese ancho ya no cambia: el problema desapareció en vez de
                seguir compensándose. */}
            <span>{t.label}</span>
            {t.count != null && (
              <span
                className={`num rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  active ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
      {/* El subrayado: una barra de 1px estirada con scaleX desde su borde
          izquierdo. Empieza invisible porque hasta el primer useLayoutEffect no
          sabe dónde va, y ese primer salto no se anima (`data-quieta`).
          Va a `--duration-max`, que es el token declarado para "barras que
          recorren distancia": con los 150ms de control, la curva exponencial se
          come el recorrido en 60ms y el resultado se lee como un salto, que es
          justo lo que la barra deslizante viene a quitar. */}
      {variante === 'subrayado' && (
        <span
          ref={barraRef}
          aria-hidden
          className="pointer-events-none absolute bottom-[-1px] left-0 h-0.5 w-px origin-left bg-indigo-600 opacity-0 transition-[transform,opacity] duration-[var(--duration-max)] ease-[var(--ease-out)] [&[data-quieta]]:transition-none motion-reduce:transition-none"
        />
      )}
    </div>
  )
}

/** Contenido de la pestaña activa. `tabIndex=0` para poder scrollearlo con el teclado. */
export function TabPanel({
  idPrefix,
  value,
  className = '',
  children,
}: {
  idPrefix: string
  value: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, value)}
      aria-labelledby={tabId(idPrefix, value)}
      tabIndex={0}
      className={`focus-visible:outline-none ${className}`}
    >
      {children}
    </div>
  )
}
