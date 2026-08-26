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
 * · **El contador va INLINE, al lado del título y en tinta de apoyo** ("Bandeja
 *   274"), no en una línea aparte ni dentro de una chapa. Es el tamaño de la
 *   pantalla, no una alarma.
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
  cuenta,
  cuentaLabel,
  sub,
  acciones,
  className = '',
}: {
  titulo: React.ReactNode
  /** El tamaño de lo que hay en la pantalla. Ausente = no se pinta. */
  cuenta?: number
  /** Qué cuenta, para quien no ve el número. Sin repetirlo. */
  cuentaLabel?: string
  sub?: React.ReactNode
  /** Acciones de la pantalla, a la derecha de la línea del título. */
  acciones?: React.ReactNode
  className?: string
}) {
  return (
    // `pt-3`: el mismo aire de arriba que la cabecera del panel del puesto, que es
    // donde se afinó a ojo. El contenedor de las pantallas pone 24 (16 en móvil) y
    // el panel añadía 12 por su cuenta, así que al ir del panel a Bandeja o a
    // Entrevistas el título saltaba 12px hacia arriba. El aire vive en la pieza y
    // no en cada pantalla, que es lo que impide que vuelvan a separarse.
    <header className={`mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pt-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="flex items-baseline gap-2 text-2xl font-bold leading-tight tracking-[-0.012em] text-slate-900">
          <span className="min-w-0 truncate">{titulo}</span>
          {cuenta !== undefined && (
            // `slate-500` y no `slate-400`: es texto con significado y el 400 se
            // queda en 2,6:1 sobre blanco. En peso normal, que es lo que lo deja
            // por debajo del título sin tener que encogerlo.
            <span className="num shrink-0 font-normal text-slate-500">
              {cuenta}
              {cuentaLabel && <span className="sr-only"> {cuentaLabel}</span>}
            </span>
          )}
        </h1>
        {sub && <p className="mt-1 text-sm font-medium text-slate-500">{sub}</p>}
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </header>
  )
}
