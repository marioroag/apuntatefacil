import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useAppBase } from '../lib/useAppBase'
import { useToast } from '../components/ui/Toast'
import { SwitchTrack } from '../components/ui/Switch'
import { PageHeader } from '../components/ui/PageHeader'
import {
  gruposVisibles,
  seccionesVisibles,
  useAjustesCtx,
  type AjustesCtx,
  type Ajuste,
  type AjusteInterruptor,
  type AjusteTexto,
  type GrupoAjustes,
  type SeccionAjustes,
} from '../lib/settings'

/**
 * Ajustes. Esta pantalla NO conoce ningún ajuste: pinta lo que declare
 * `src/lib/settings.tsx`. Añadir uno no se toca aquí.
 *
 * Forma: menú propio a la izquierda y contenido a la derecha, dentro del shell
 * de siempre. No sustituye al menú lateral de la app (eso convertiría los
 * ajustes en un modo aparte del que hay que "salir"); es una pantalla más, con
 * su navegación de segundo nivel. Por debajo de lg el menú se tumba en una fila
 * de pestañas, que es lo que cabe.
 *
 * Se guarda al instante, sin botón de guardar: cada interruptor es una decisión
 * independiente y reversible. Si el guardado falla, el interruptor vuelve solo a
 * su sitio y el error se dice en un toast, nunca en silencio.
 */
export function Ajustes() {
  const base = useAppBase()
  const { seccion: slug } = useParams()
  const ctx = useAjustesCtx()
  // Salto a un interruptor concreto (?ajuste=<id>), como el ?candidato=<id> del
  // panel. Lo usa el buscador de la barra: encontrar un ajuste tiene que dejarte
  // EN SU FILA, no en la sección y a buscarlo con los ojos. La clave de la
  // navegación viaja con él para que buscar dos veces lo mismo vuelva a saltar.
  const [searchParams] = useSearchParams()
  const { key: navKey } = useLocation()
  const objetivo = searchParams.get('ajuste')

  const secciones = seccionesVisibles(ctx)
  const actual = secciones.find((s) => s.id === slug)

  // Sin sección en la URL (o con una que no existe o que este plan no tiene),
  // a la primera disponible. Nunca una pantalla en blanco.
  if (!actual) {
    const primera = secciones[0]
    if (!primera) return <SinAjustes />
    return <Navigate to={`${base}/ajustes/${primera.id}`} replace />
  }

  return (
    <div className="mx-auto max-w-trabajo px-4 py-6 max-sm:pt-4 sm:px-6 lg:px-8">
      {/* Sin subtítulo: "Ajustes" ya se explica solo, y una línea gris debajo
          repitiéndolo sería la segunda cosa que se lee en la pantalla. */}
      <PageHeader titulo="Ajustes" />

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <Menu secciones={secciones} base={base} />
        <Seccion seccion={actual} ctx={ctx} salto={objetivo ? { id: objetivo, key: navKey } : null} />
      </div>
    </div>
  )
}

function Menu({ secciones, base }: { secciones: SeccionAjustes[]; base: string }) {
  return (
    <nav
      aria-label="Secciones de ajustes"
      // Tumbado en móvil: una fila que se desplaza, con el filo inferior de la
      // barra haciendo de raíl. En escritorio, columna pegada al scroll.
      className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pb-px sm:-mx-6 sm:px-6 lg:sticky lg:top-6 lg:mx-0 lg:mb-0 lg:block lg:space-y-0.5 lg:self-start lg:overflow-visible lg:border-0 lg:px-0 lg:pb-0"
    >
      {secciones.map((s) => (
        <NavLink
          key={s.id}
          to={`${base}/ajustes/${s.id}`}
          // EL PESO SE DECLARA UNA VEZ, en la base, y ningún estado lo toca:
          // misma regla que `FILA` en `filaLateral.ts`. Iba de `font-medium` a
          // `font-semibold` al activarse, y una etiqueta que engorda ensancha su
          // botón y empuja a las vecinas, así que la fila entera tiembla cada vez
          // que cambias de sección. El activo ya se dice con la tinta, el relleno
          // de la píldora (escritorio) y el subrayado (móvil): tres señales, sin
          // mover un píxel de nadie.
          className={({ isActive }) =>
            `relative flex shrink-0 items-center gap-2 whitespace-nowrap px-2.5 py-2 text-sm font-medium transition-colors lg:h-9 lg:w-full lg:rounded-xl lg:py-0 ${
              isActive
                ? 'text-slate-900 lg:bg-indigo-50'
                : 'text-slate-600 hover:text-slate-900 lg:hover:bg-slate-100'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <s.icon className={`size-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} aria-hidden />
              <span className="min-w-0 truncate">{s.label}</span>
              {/* En móvil el activo se marca con el subrayado de la fila; en
                  escritorio, con el relleno de la píldora. */}
              {isActive && <span className="absolute inset-x-1 -bottom-px h-0.5 bg-indigo-600 lg:hidden" aria-hidden />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** Un ajuste al que hay que saltar, y la navegación que lo pidió (para que pedir lo
 *  mismo dos veces vuelva a saltar). */
type Salto = { id: string; key: string } | null

function Seccion({ seccion, ctx, salto }: { seccion: SeccionAjustes; ctx: AjustesCtx; salto: Salto }) {
  const grupos = gruposVisibles(seccion, ctx)
  return (
    <div className="min-w-0">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{seccion.titulo}</h2>
        <p className="mt-0.5 max-w-[62ch] text-[13px] leading-5 text-slate-500">{seccion.descripcion}</p>
      </header>

      {/* TEMPORAL (ago 2026). No todo lo configurable es un interruptor: la
          agenda de entrevistas son días, tramos, duración, descanso y
          dirección, y eso no cabe en un `get`/`set` booleano. Hasta rehacerlo,
          una sección puede traerse su propia pantalla. Es la ÚNICA excepción a
          "esta pantalla no conoce ningún ajuste", y sigue sin conocerlo: pinta
          lo que le den, no sabe qué es. */}
      {seccion.componente ? (
        seccion.componente
      ) : grupos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-[13px] text-slate-500">
          Esta sección todavía no tiene nada que ajustar.
        </p>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <Grupo key={g.id} grupo={g} ctx={ctx} salto={salto} />
          ))}
        </div>
      )}

      {seccion.nota && <Nota>{seccion.nota}</Nota>}
    </div>
  )
}

function Grupo({ grupo, ctx, salto }: { grupo: GrupoAjustes; ctx: AjustesCtx; salto: Salto }) {
  return (
    <section className="rounded-xl filo bg-white p-4 shadow-card sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900">{grupo.titulo}</h3>
      {grupo.descripcion && <p className="mt-0.5 text-[12px] text-slate-500">{grupo.descripcion}</p>}
      <ul className="mt-2 divide-y divide-slate-100">
        {grupo.ajustes.map((a) => (
          <li key={a.id}>
            <Fila ajuste={a} ctx={ctx} salto={salto?.id === a.id ? salto.key : null} />
          </li>
        ))}
      </ul>
      {grupo.nota && <p className="mt-3 text-[12px] leading-5 text-slate-500">{grupo.nota}</p>}
    </section>
  )
}

/**
 * Un renglón de ajuste. La FILA ENTERA es el interruptor: el objetivo de pulsado
 * es todo el renglón (dedo gordo, móvil) y no hay un botón dentro de otra cosa
 * pulsable. El nombre accesible sale de la etiqueta y la explicación se anuncia
 * como descripción, no como parte del nombre.
 */
function Fila({ ajuste, ctx, salto }: { ajuste: Ajuste; ctx: AjustesCtx; salto: string | null }) {
  if (ajuste.tipo === 'texto') return <FilaTexto ajuste={ajuste} ctx={ctx} salto={salto} />
  return <FilaInterruptor ajuste={ajuste} ctx={ctx} salto={salto} />
}

/**
 * UN AJUSTE QUE SE ESCRIBE. Aquí la fila entera NO puede ser el control (lo es
 * el `textarea`), así que el rótulo va encima como en cualquier campo del
 * producto y la explicación debajo de él, antes de la caja: se lee lo que hay
 * que escribir ANTES de tener el cursor dentro.
 *
 * Se guarda AL SALIR DEL CAMPO y solo si ha cambiado: un párrafo son cientos de
 * pulsaciones y no puede haber una escritura por letra. Mismo trato que el
 * nombre de la marca en el constructor.
 */
function FilaTexto({ ajuste, ctx, salto }: { ajuste: AjusteTexto; ctx: AjustesCtx; salto: string | null }) {
  const toast = useToast()
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  const guardado = ajuste.get(ctx)
  const [borrador, setBorrador] = useState(guardado)
  const motivo = ajuste.bloqueado?.(ctx) ?? null
  const bloqueado = motivo !== null
  const hint = motivo ?? ajuste.hint
  // Si el valor llega de fuera (acaban de cargar los datos, o se cambia de
  // equipo), manda el guardado: el borrador no puede sobrevivir a su empresa.
  //
  // Con `useState` y no con un `useRef`: leer un ref DURANTE el render es lo que
  // React desaconseja (y el linter caza), porque en un render descartado deja el
  // ref ya movido y la resincronización no vuelve a ocurrir. Ajustar estado en el
  // render sí está soportado: React repite el render antes de pintar.
  const [ultimoGuardado, setUltimoGuardado] = useState(guardado)
  if (ultimoGuardado !== guardado) {
    setUltimoGuardado(guardado)
    setBorrador(guardado)
  }

  useSaltoAAjuste(salto, ref)

  return (
    <div className="-mx-2 px-2 py-3">
      <label htmlFor={`${id}-c`} className="block text-[13px] font-medium text-slate-800">
        {ajuste.label}
      </label>
      {hint && (
        <p id={`${id}-h`} className="mt-0.5 max-w-[62ch] text-[12px] leading-5 text-slate-500">
          {hint}
        </p>
      )}
      <textarea
        ref={ref}
        id={`${id}-c`}
        value={borrador}
        disabled={bloqueado}
        rows={ajuste.filas ?? 4}
        maxLength={ajuste.maxLength}
        placeholder={ajuste.placeholder}
        aria-describedby={hint ? `${id}-h` : undefined}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={async () => {
          if (borrador === guardado) return
          const res = await ajuste.set(ctx, borrador)
          if (res.error) toast.error(res.error)
        }}
        className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none transition-colors duration-[var(--duration-control)] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:bg-slate-50 disabled:text-slate-500 pointer-coarse:text-base"
      />
    </div>
  )
}

/**
 * Llegar por enlace directo: la fila se pone a la vista, coge el foco (así el
 * lector de pantalla también anuncia dónde has aterrizado) y se marca un
 * instante. Lo comparten las dos formas de fila, que es de donde salió.
 */
function useSaltoAAjuste(salto: string | null, ref: React.RefObject<HTMLElement | null>, alResaltar?: (v: boolean) => void) {
  useEffect(() => {
    const el = ref.current
    if (!salto || !el) return
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
    alResaltar?.(true)
    const t = setTimeout(() => alResaltar?.(false), 1600)
    return () => {
      clearTimeout(t)
      alResaltar?.(false)
    }
    // `alResaltar` se recrea en cada render de quien lo monta y no decide nada:
    // lo que dispara el salto es haber llegado con un ajuste en la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salto])
}

function FilaInterruptor({ ajuste, ctx, salto }: { ajuste: AjusteInterruptor; ctx: AjustesCtx; salto: string | null }) {
  const toast = useToast()
  const id = useId()
  const ref = useRef<HTMLButtonElement>(null)
  const [resaltado, setResaltado] = useState(false)
  const motivo = ajuste.bloqueado?.(ctx) ?? null
  const valor = ajuste.get(ctx)

  // El anillo del salto es ultramarine porque esto es selección, no estado.
  useSaltoAAjuste(salto, ref, setResaltado)
  // Si está bloqueado, el motivo SUSTITUYE a la explicación: es lo que hace
  // falta saber, y dos textos grises seguidos no los lee nadie.
  const hint = motivo ?? ajuste.hint
  const bloqueado = motivo !== null

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={valor}
      aria-labelledby={`${id}-l`}
      aria-describedby={hint ? `${id}-h` : undefined}
      disabled={bloqueado}
      onClick={async () => {
        const res = await ajuste.set(ctx, !valor)
        if (res.error) toast.error(res.error)
      }}
      className={`group -mx-2 flex w-full items-start justify-between gap-4 rounded-lg px-2 py-3 text-left transition-[background-color,box-shadow] duration-[var(--duration-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 enabled:hover:bg-slate-50 disabled:cursor-not-allowed ${
        resaltado ? 'ring-2 ring-inset ring-indigo-500/40' : ''
      }`}
    >
      <span className="min-w-0">
        <span id={`${id}-l`} className={`block text-[13px] font-medium ${bloqueado ? 'text-slate-500' : 'text-slate-800'}`}>
          {ajuste.label}
        </span>
        {hint && (
          <span id={`${id}-h`} className="mt-0.5 block max-w-[62ch] text-[12px] leading-5 text-slate-500">
            {hint}
          </span>
        )}
      </span>
      <span className="mt-0.5">
        <SwitchTrack checked={valor} disabled={bloqueado} />
      </span>
    </button>
  )
}

function Nota({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-[62ch] text-[12px] leading-5 text-slate-500">{children}</p>
}

function SinAjustes() {
  return (
    <div className="mx-auto max-w-trabajo px-4 py-6 max-sm:pt-4 sm:px-6 lg:px-8">
      <PageHeader titulo="Ajustes" sub="Tu plan todavía no tiene nada que ajustar aquí." />
    </div>
  )
}
