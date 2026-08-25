import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Briefcase, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useAppBase } from '../lib/useAppBase'
import { useIsSupportStaff } from '../lib/useSupportStaff'
import { useAjustesCtx } from '../lib/settings'
import { Tecla } from './ui/Tecla'
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

/**
 * El buscador. UNA sola forma desde el reskin (ago 2026): una capa que se abre
 * encima, se monta al pedirla y se va al elegir.
 *
 * Tenía dos, `inline` (el campo del centro de la barra superior) y `sheet` (la
 * capa del móvil). Retirada la barra, el campo permanente se quedó sin sitio y
 * con él su variante: mantenerla habría sido dejar en el fichero media pieza que
 * nadie monta, que es como empieza la deriva. El atajo ⌘K, que vivía dentro del
 * campo porque era lo que estaba siempre montado, se mudó al shell por el mismo
 * motivo (`AppLayout`).
 *
 * Se coloca distinto según el ancho y es la misma capa: paleta centrada a partir
 * de `sm` (con su telón, porque detrás se sigue viendo el trabajo) y hoja a
 * pantalla completa por debajo, donde una paleta flotante sería un recorte de
 * pantalla con bordes.
 */
export function GlobalSearch({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(true)
  const [activo, setActivo] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
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

  // La capa entra con el foco puesto: se abre para escribir.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    if (fila.hacer) return fila.hacer()
    if (fila.to) navigate(fila.to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (query) {
        setQuery('')
        setAbierto(true)
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

  // El campo NO es un input dentro de una caja: es la boca del modal. Sin borde,
  // sin fondo y sin anillo de foco, porque la capa entera ya tiene el foco y
  // dibujarle una caja dentro de otra caja es un marco de más. Grande (20px) por
  // el mismo motivo por el que un buscador de escritorio lo es: es lo único que
  // se hace aquí, y lo que escribes tiene que leerse mientras lo escribes.
  const campo = (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
      <Search className="size-5 shrink-0 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={mostrar && filas.length > 0}
        aria-controls={listId}
        aria-activedescendant={mostrar && filas[activo] ? `${listId}-${activo}` : undefined}
        aria-autocomplete="list"
        aria-label="Busca personas, puestos y ajustes"
        placeholder="Busca personas, puestos, ajustes"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        // Volver a pulsar en un campo que ya tiene el foco no dispara `focus`, y
        // quien acaba de cerrar la lista espera que vuelva al pulsar.
        onClick={() => setAbierto(true)}
        onKeyDown={onKeyDown}
        // `search` pinta una X propia en WebKit que se solapa con la nuestra.
        className="h-16 min-w-0 flex-1 bg-transparent text-[20px] text-slate-900 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {query && (
        <button
          onClick={() => {
            setQuery('')
            inputRef.current?.focus()
          }}
          aria-label="Borrar la búsqueda"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" aria-hidden />
        </button>
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

  return (
    <div role="dialog" aria-modal="true" aria-label="Buscar" className="fixed inset-0 z-50">
      {/* Telón solo donde el panel NO ocupa la pantalla entera: a pantalla
          completa no hay nada detrás que atenuar, y un telón bajo una hoja opaca
          es una capa que no se ve y sí se paga. */}
      <div className="absolute inset-0 hidden bg-slate-900/40 sm:block" onClick={cerrar} aria-hidden />

      {/* ALTO FIJO, no "lo que midan los resultados". Una paleta que crece y
          encoge con cada tecla obliga a reencontrar la primera fila en cada
          pulsación; con el alto quieto, lo único que se mueve es la lista. Y
          arriba (10% de la ventana) porque se lee de arriba abajo: centrada de
          verdad, el campo bailaría en vertical al cambiar la lista. */}
      <div className="relative mx-auto flex h-full max-h-full flex-col overflow-clip bg-white sm:mt-[10vh] sm:h-[min(32rem,72vh)] sm:w-[min(40rem,calc(100vw-2rem))] sm:rounded-xl sm:filo sm:shadow-pop">
        <div className="flex shrink-0 items-center border-b border-slate-200">
          {campo}
          {/* En móvil no hay tecla Escape ni pie que la anuncie: hace falta una
              salida visible. En escritorio la dice el pie, y repetirla aquí
              sería la misma puerta dos veces. */}
          <button
            onClick={cerrar}
            className="mr-2 shrink-0 rounded-lg px-2 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:hidden"
          >
            Cancelar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">{resultados}</div>

        {/* El pie enseña el teclado: es lo que convierte esto en una herramienta
            de teclado en vez de una lista que además se puede recorrer. Solo en
            escritorio, que es donde hay teclado. */}
        <div className="hidden shrink-0 items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-500 sm:flex" aria-hidden>
          <span className="flex items-center gap-1.5"><Tecla>Esc</Tecla> para cerrar</span>
          <span className="flex items-center gap-1.5"><Tecla>↓</Tecla><Tecla>↑</Tecla> para moverte</span>
          <span className="flex items-center gap-1.5"><Tecla>↵</Tecla> para abrir</span>
        </div>
      </div>
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
      {fila.badge != null && fila.badge > 0 && (
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
