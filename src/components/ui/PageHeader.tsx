/**
 * LA CABECERA DE UNA PANTALLA. Pieza única.
 *
 * Estaba copiada a mano en cinco pantallas (`h1 text-xl` + un `p text-sm` de
 * apoyo), y como siempre que algo se copia, ya habían empezado a separarse: unas
 * con `mb-4`, otras con `mb-5`, y solo una sabía llevar acciones a la derecha.
 *
 * Su forma sale de MEDIR la referencia (JOIN, ago 2026, escalando su captura por
 * los botones de tráfico de macOS: 12pt, factor 1,33):
 *
 * · **El título manda, y con esta escala el nuestro no mandaba.** Iba a 20px, o
 *   sea POR DEBAJO de los 24px de las cifras de las tarjetas que tiene justo
 *   debajo: la jerarquía estaba invertida y el nombre de la pantalla perdía
 *   contra un número. Ahora 24px. No 30 como la referencia: nuestra columna es
 *   más estrecha y más densa, y la doctrina dice que la jerarquía la dan el peso
 *   y el color antes que el tamaño. Con `-0.012em`, el tracking de titular: a
 *   este cuerpo el espaciado de texto corrido se ve blando.
 * · **Las MEDIDAS SON LAS DEL PANEL DEL PUESTO** (Mario, ago 2026), que es la
 *   pantalla donde se afinaron a ojo: `font-bold` y no `semibold`, y el subtítulo
 *   en `font-medium` y no en peso normal. Esta pieza se había quedado medio
 *   peldaño por debajo en las dos cosas, así que al ir del panel a Bandeja o a
 *   Entrevistas el título adelgazaba sin que nadie lo hubiera decidido. Si el
 *   panel cambia, cambia esto; son la misma cabecera.
 * · **EL CONTADOR NO VIVE AQUÍ, VIVE EN LA LÍNEA DE CONTEXTO** (Mario, ago 2026).
 *   Esta pieza llegó a pintarlo pegado al título, en gris ("Candidatos 608"), y
 *   eso deja un número suelto que hay que deducir: qué cuenta solo lo sabía quien
 *   usa lector, porque el sustantivo iba en un `sr-only`. Su sitio es el subtítulo,
 *   enganchado con un middot, que es como lo resuelve el panel de un puesto
 *   ("Construcción, Valencia · 97 candidaturas"). Lo compone la pantalla, que es
 *   quien sabe qué está contando; aquí no hace falta ninguna prop.
 *   Se fueron con él `cuenta` y `cuentaLabel`: una prop sin consumidor invita a
 *   reintroducir lo que se acaba de quitar.
 * · **Las acciones de pantalla viven en la LÍNEA DEL TÍTULO**, a la derecha. Es
 *   la fila más alta del contenido y la que el ojo barre primero; abajo, se
 *   pierden entre los filtros.
 *
 * El subtítulo es OPCIONAL a propósito. Una pantalla cuyo nombre ya se explica
 * solo (Ajustes, Equipo) no necesita una línea gris debajo repitiéndolo: es la
 * segunda línea que se lee en toda la página y tiene que ganársela.
 */
export function PageHeader({
  titulo,
  sub,
  acciones,
  pegada = false,
  className = '',
}: {
  titulo: React.ReactNode
  sub?: React.ReactNode
  /** Acciones de la pantalla, a la derecha de la línea del título. */
  acciones?: React.ReactNode
  /**
   * LA CABECERA DEL PANEL DE UN PUESTO, para las pantallas cuyo bloque siguiente
   * es una franja de herramientas con su propio `py-4`. Cambia el `mb-6` por el
   * `pb-2` que el panel lleva escrito a mano, y esos 8px más los 16 de la franja
   * dejan el mismo BLANCO que hay por debajo de los chips: la fila de filtros queda
   * centrada en su hueco en vez de colgada del título.
   *
   * Sin esto, Candidatos daba 16px por encima de los chips y 28 por debajo, o sea
   * la misma franja descentrada de una pantalla a otra. (Con el `mb-6` puesto eran
   * 40 y 28, todavía peor.)
   *
   * Y son 8 y no 12 porque los dos huecos no los cierra la misma clase de borde:
   * abajo hay una CAJA, que empieza donde dice su rectángulo; arriba hay TEXTO, y
   * la caja de línea de un 14/20 se acaba un par de píxeles por debajo de la letra.
   * Con 12 la cuenta daba 28 y 28, y el blanco 30 y 28. El razonamiento largo está
   * en la cabecera del panel del puesto, que es donde se midió.
   *
   * ES UNA PROP Y NO UN `mb-0` EN EL `className` PORQUE ESO NO FUNCIONA: `mb-0` y
   * `mb-6` son la MISMA utilidad de Tailwind, y entre dos utilidades del mismo eje
   * gana la que se emita después en el CSS, no la que se escriba al final del
   * `className`. Es el mismo mecanismo que obligó a fabricar los botones de icono
   * con `botonIcono()` en vez de `BTN_* + px-0`: cuando una pieza necesita anular
   * una utilidad de otra, la respuesta es la variante que NO la pone.
   */
  pegada?: boolean
  className?: string
}) {
  return (
    // `pt-3`: el mismo aire de arriba que la cabecera del panel del puesto, que es
    // donde se afinó a ojo. El contenedor de las pantallas pone 24 (16 en móvil) y
    // el panel añadía 12 por su cuenta, así que al ir del panel a Bandeja o a
    // Entrevistas el título saltaba 12px hacia arriba. El aire vive en la pieza y
    // no en cada pantalla, que es lo que impide que vuelvan a separarse.
    <header className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pt-3 ${pegada ? 'pb-2' : 'mb-6'} ${className}`}>
      <div className="min-w-0">
        <h1 className="flex items-baseline gap-2 text-2xl font-bold leading-tight tracking-[-0.012em] text-slate-900">
          <span className="min-w-0 truncate">{titulo}</span>
        </h1>
        {sub && <p className="mt-1 text-sm font-medium text-slate-500">{sub}</p>}
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </header>
  )
}
