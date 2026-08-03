import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useAppBase } from '../lib/useAppBase'
import { useToast } from '../components/ui/Toast'
import { SwitchTrack } from '../components/ui/Switch'
import {
  gruposVisibles,
  seccionesVisibles,
  useAjustesCtx,
  type AjustesCtx,
  type Ajuste,
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
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Ajustes</h1>
      </header>

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
          className={({ isActive }) =>
            `relative flex shrink-0 items-center gap-2 whitespace-nowrap px-2.5 py-2 text-sm transition-colors lg:h-9 lg:w-full lg:rounded-xl lg:py-0 ${
              isActive
                ? 'font-semibold text-slate-900 lg:bg-indigo-50'
                : 'font-medium text-slate-600 hover:text-slate-900 lg:hover:bg-slate-100'
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
          agenda del asistente de WhatsApp son días, tramos, duración, descanso
          y dirección, y eso no cabe en un `get`/`set` booleano. Hasta rehacerlo,
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
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
  const toast = useToast()
  const id = useId()
  const ref = useRef<HTMLButtonElement>(null)
  const [resaltado, setResaltado] = useState(false)
  const motivo = ajuste.bloqueado?.(ctx) ?? null
  const valor = ajuste.get(ctx)

  // Llegar por enlace directo: la fila se pone a la vista, coge el foco (así el
  // lector de pantalla también anuncia dónde has aterrizado) y se marca un
  // instante. El anillo es ultramarine porque esto es selección, no estado.
  useEffect(() => {
    const el = ref.current
    if (!salto || !el) return
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
    setResaltado(true)
    const t = setTimeout(() => setResaltado(false), 1600)
    return () => {
      clearTimeout(t)
      setResaltado(false)
    }
  }, [salto])
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
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold text-slate-900">Ajustes</h1>
      <p className="mt-1 text-sm text-slate-500">Tu plan todavía no tiene nada que ajustar aquí.</p>
    </div>
  )
}
