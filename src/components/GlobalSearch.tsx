import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Briefcase, Lock, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useAppBase } from '../lib/useAppBase'
import { useIsSupportStaff } from '../lib/useSupportStaff'
import { useAjustesCtx } from '../lib/settings'
import { useAcciones } from '../lib/acciones'
import { scoreEntrada, searchScore } from '../lib/search'
import {
  TOPES,
  aplanar,
  atajos as atajosDe,
  buscarDestinos,
  limitar,
  ordenarGrupos,
  type DestinosCtx,
  type Fila,
  type GrupoResultados,
} from '../lib/destinos'
import { FEATURE_COPY, PLAN_LABEL, type PlanFeature } from '../lib/pricing'
import { candidateName, initials, miles } from '../lib/format'
import type { Candidate } from '../lib/types'

/**
 * Búsqueda global de la barra: **todo lo que hay en la app**, de una vez. Personas
 * y puestos de todos los puestos (que es lo que no se puede hacer en ninguna otra
 * pantalla: "¿en qué puesto estaba Manuel?"), y también los apartados, los ajustes
 * y las acciones, que es lo que hasta ahora solo encontraba quien ya sabía dónde
 * estaba. Por eso ocupa el centro de la barra.
 *
 * Esta pantalla NO sabe qué hay en la app: pinta lo que declaren `lib/destinos.ts`
 * (sitios), el registro de `lib/settings.tsx` (ajustes, derivados uno a uno) y
 * quien registre una acción (`lib/acciones.tsx`). Añadir algo encontrable no se
 * toca aquí.
 *
 * Sin red: el store ya tiene en memoria los candidatos y los puestos de la empresa,
 * así que la lista se recalcula mientras escribes. La puntuación es la de
 * `lib/search.ts`, una sola para todo: tolera acentos, erratas y teléfono por
 * dígitos, y así "jose" encuentra a "José" y 654 encuentra su número.
 *
 * El orden de los grupos NO es fijo: gana el que mejor coincide. Un nombre real
 * puntúa alto y pone Candidatos arriba; escribir "entrevistas" sube el apartado
 * sin hacerte bajar por seis nombres parecidos.
 *
 * Dos formas de la misma cosa: `inline` es el campo del centro (md en adelante)
 * y `sheet` la capa a pantalla completa del móvil, donde no cabe un campo.
 */

const MIN_CHARS = 2

function useDestinosCtx(): DestinosCtx {
  const { campaigns } = useStore()
  const { company, role } = useAuth()
  const base = useAppBase()
  const isStaff = useIsSupportStaff()
  const ajustes = useAjustesCtx()
  const { pathname } = useLocation()
  // El puesto sobre el que actúan los destinos que no son destino (el formulario,
  // la identidad): el abierto ahora, o el primero. `useParams` aquí no vale: la
  // barra la pinta el layout, y el layout no tiene los params de sus hijos.
  const campaignId = useMemo(
    () => pathname.match(/\/puestos\/([^/?#]+)/)?.[1] ?? campaigns[0]?.id ?? null,
    [pathname, campaigns],
  )
  return useMemo(
    () => ({ base, demo: base === '/demo', plan: company?.plan, role, isStaff, campaignId, ajustes }),
    [base, company?.plan, role, isStaff, campaignId, ajustes],
  )
}

/** Los grupos que salen del store (personas y puestos). Lo demás lo pone el registro. */
function useGruposDelStore(query: string, ctx: DestinosCtx): GrupoResultados[] {
  const { candidates, campaigns, sites, newCountFor } = useStore()
  return useMemo<GrupoResultados[]>(() => {
    const q = query.trim()
    if (q.length < MIN_CHARS) return []
    const tituloDe = (id: string) => campaigns.find((c) => c.id === id)?.title ?? 'Puesto'

    const personas: Fila[] = (candidates as Candidate[])
      .map((c) => ({ c, score: searchScore(c, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOPES.candidatos)
      .map(({ c, score }) => ({
        key: `candidato-${c.id}`,
        score,
        label: candidateName(c),
        hint: tituloDe(c.campaignId),
        iniciales: initials(candidateName(c)),
        to: `${ctx.base}/puestos/${c.campaignId}?candidato=${c.id}`,
      }))

    const puestos: Fila[] = campaigns
      // La sede entra como clave: "Cádiz" saca los puestos de esa sede sin que
      // haga falta que la lleven en el título.
      .map((c) => ({ c, score: scoreEntrada(c.title, [sites.find((s) => s.id === c.siteId)?.name ?? ''], q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOPES.puestos)
      .map(({ c, score }) => ({
        key: `puesto-${c.id}`,
        score,
        label: c.title,
        icon: Briefcase,
        badge: newCountFor(c.id),
        to: `${ctx.base}/puestos/${c.id}`,
      }))

    return [
      { id: 'candidatos', titulo: 'Candidatos', orden: 0, filas: personas },
      { id: 'puestos', titulo: 'Puestos', orden: 1, filas: puestos },
    ].filter((g) => g.filas.length > 0)
  }, [query, candidates, campaigns, sites, newCountFor, ctx.base])
}

export function GlobalSearch({
  variant,
  onClose,
  onUpgrade,
}: {
  variant: 'inline' | 'sheet'
  onClose?: () => void
  /** El diálogo de plan lo pinta la barra, no esto: en el móvil la capa se cierra
   *  al elegir y se llevaría el diálogo por delante. */
  onUpgrade: (feature: PlanFeature) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(variant === 'sheet')
  const [activo, setActivo] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const ctx = useDestinosCtx()
  const acciones = useAcciones()

  // El cálculo va en segundo plano: con miles de candidatos, puntuar cada
  // pulsación en el hilo de la escritura haría el campo pastoso.
  const diferida = useDeferredValue(query)
  const delStore = useGruposDelStore(diferida, ctx)
  const grupos = useMemo(() => {
    const q = diferida.trim()
    if (q.length < MIN_CHARS) return []
    return limitar(ordenarGrupos([...delStore, ...buscarDestinos(ctx, acciones, q)]))
  }, [diferida, delStore, ctx, acciones])

  const vacio = query.trim().length === 0
  const corta = !vacio && query.trim().length < MIN_CHARS
  // Con el campo vacío la lista no desaparece: enseña atajos. Es la única forma de
  // descubrir que aquí dentro también están los ajustes y lo que se puede hacer.
  const lista = useMemo<GrupoResultados[]>(
    () => (vacio ? [{ id: 'atajos', titulo: 'Atajos', orden: 0, filas: atajosDe(ctx, acciones) }] : grupos),
    [vacio, ctx, acciones, grupos],
  )
  const filas = useMemo(() => aplanar(lista), [lista])
  // Cada fila necesita su sitio en la lista aplanada: es el que recorren las
  // flechas y el que pinta la selección, y los grupos lo parten en trozos.
  const indices = useMemo(() => new Map(filas.map((f, i) => [f.key, i])), [filas])
  const mostrar = abierto && (vacio ? filas.length > 0 : true)

  useEffect(() => setActivo(0), [diferida])

  // La capa del móvil entra con el foco puesto: se abre para escribir.
  useEffect(() => {
    if (variant === 'sheet') inputRef.current?.focus()
  }, [variant])

  // Atajo del sistema. Solo donde el campo existe de verdad: por debajo de md
  // hay un botón que abre la capa, y robar el foco a un input oculto sería un
  // atajo que no lleva a ninguna parte.
  useEffect(() => {
    if (variant !== 'inline') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!window.matchMedia('(min-width: 768px)').matches) return
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        // Abrir a mano y no fiarse del foco: si el campo YA estaba enfocado (acabas
        // de cerrar la lista con Escape), el evento de foco no se repite y el atajo
        // no haría nada.
        setAbierto(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [variant])

  // Clic fuera: cerrar la lista sin perder lo escrito.
  useEffect(() => {
    if (variant !== 'inline' || !mostrar) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [variant, mostrar])

  const cerrar = () => {
    setAbierto(false)
    onClose?.()
  }

  const ir = (fila: Fila) => {
    setQuery('')
    setAbierto(false)
    onClose?.()
    // Soltar el foco: elegido un resultado, el buscador ha terminado. Si se lo
    // queda, su Escape (que corta la propagación para no cerrar diálogos padre) se
    // tragaría el Escape de lo que acabas de abrir con una acción.
    inputRef.current?.blur()
    // Con candado no se navega: se cuenta qué falta. El diálogo lo pinta la barra.
    if (fila.bloqueado) return onUpgrade(fila.bloqueado)
    if (fila.hacer) return fila.hacer()
    if (fila.to) navigate(fila.to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (query) {
        setQuery('')
        setAbierto(variant === 'sheet')
      } else cerrar()
      return
    }
    if (!filas.length || !mostrar) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((i) => (i + 1) % filas.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((i) => (i - 1 + filas.length) % filas.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const fila = filas[activo]
      if (fila) ir(fila)
    }
  }

  const campo = (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={mostrar && filas.length > 0}
        aria-controls={listId}
        aria-activedescendant={mostrar && filas[activo] ? `${listId}-${activo}` : undefined}
        aria-autocomplete="list"
        aria-label="Busca personas, puestos y ajustes"
        // En la capa del móvil no cabe la frase entera y se cortaba a media palabra.
        // El nombre accesible sigue siendo el mismo, y debajo están los atajos.
        placeholder={variant === 'sheet' ? 'Personas, puestos, ajustes' : 'Busca personas, puestos y ajustes'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        // Mismo motivo: volver a pulsar en un campo que ya tiene el foco no dispara
        // `focus`, y quien acaba de cerrar la lista espera que vuelva al pulsar.
        onClick={() => setAbierto(true)}
        onKeyDown={onKeyDown}
        // `search` pinta una X propia en WebKit que se solapa con la nuestra.
        className={`h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 text-sm text-slate-900 outline-none transition-[background-color,border-color,box-shadow] placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 [&::-webkit-search-cancel-button]:appearance-none ${
          variant === 'sheet' ? 'pr-9' : 'pr-14'
        }`}
      />
      {query ? (
        <button
          onClick={() => {
            setQuery('')
            inputRef.current?.focus()
          }}
          aria-label="Borrar la búsqueda"
          className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : (
        variant === 'inline' && (
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
            ⌘K
          </kbd>
        )
      )}
    </div>
  )

  const resultados = (
    <>
      {corta ? (
        <p className="px-2.5 py-3 text-[13px] text-slate-500">Escribe al menos {MIN_CHARS} letras.</p>
      ) : filas.length === 0 ? (
        <p className="px-2.5 py-3 text-[13px] text-slate-500">
          Nada con «{query.trim()}». Prueba con un nombre, un teléfono o el nombre de un apartado.
        </p>
      ) : (
        <ul id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(60vh,26rem)] overflow-y-auto">
          {lista.map((grupo) => (
            <li key={grupo.id} role="presentation">
              {/* El título es de verdad el nombre del grupo, no un adorno: lo
                  anuncia también quien navega con lector de pantalla. */}
              <Grupo id={`${listId}-g-${grupo.id}`}>{grupo.titulo}</Grupo>
              <ul role="group" aria-labelledby={`${listId}-g-${grupo.id}`}>
                {grupo.filas.map((fila) => {
                  const i = indices.get(fila.key) ?? 0
                  return (
                    <li key={fila.key} role="presentation">
                      <FilaResultado
                        fila={fila}
                        id={`${listId}-${i}`}
                        activo={i === activo}
                        onHover={() => setActivo(i)}
                        onClick={() => ir(fila)}
                      />
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  )

  if (variant === 'sheet') {
    return (
      <div role="dialog" aria-modal="true" aria-label="Buscar" className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 p-2">
          {campo}
          <button
            onClick={cerrar}
            className="shrink-0 rounded-lg px-2 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Cancelar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">{resultados}</div>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative flex h-full w-full max-w-[420px] items-center">
      {campo}
      {mostrar && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop">
          {resultados}
        </div>
      )}
    </div>
  )
}

/**
 * Una fila, sea persona, apartado, ajuste o acción. Una sola: lo que cambia entre
 * ellas es el adorno de la izquierda (iniciales o icono) y el de la derecha
 * (candidaturas nuevas o candado), no la forma.
 */
function FilaResultado({
  fila,
  id,
  activo,
  onHover,
  onClick,
}: {
  fila: Fila
  id: string
  activo: boolean
  onHover: () => void
  onClick: () => void
}) {
  const Icon = fila.icon
  const plan = fila.bloqueado ? PLAN_LABEL[FEATURE_COPY[fila.bloqueado].minPlan] : null
  return (
    <button
      id={id}
      role="option"
      aria-selected={activo}
      onMouseEnter={onHover}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
        activo ? 'bg-slate-100' : ''
      }`}
    >
      {fila.iniciales ? (
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600"
        >
          {fila.iniciales}
        </span>
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          {Icon && <Icon className="size-4" aria-hidden />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-slate-900">{fila.label}</span>
        {fila.hint && <span className="block truncate text-[12px] text-slate-500">{fila.hint}</span>}
      </span>
      {plan && (
        // El plan se dice con palabras, no solo con el candado.
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500">
          <Lock className="size-3" aria-hidden />
          Plan {plan}
        </span>
      )}
      {!plan && fila.badge != null && fila.badge > 0 && (
        <span className="num shrink-0 rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-700">
          {miles(fila.badge)}
        </span>
      )}
    </button>
  )
}

function Grupo({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 first:pt-1">
      {children}
    </p>
  )
}
