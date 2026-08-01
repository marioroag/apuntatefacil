import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useAppBase } from '../lib/useAppBase'
import { normalizeSearch, searchScore } from '../lib/search'
import { candidateName, initials, miles } from '../lib/format'
import type { Campaign, Candidate } from '../lib/types'

/**
 * Búsqueda global de la barra: personas y puestos, de todos los puestos a la vez.
 * Es lo único que hoy no se puede hacer en ninguna pantalla ("¿en qué puesto
 * estaba Manuel?"), y por eso ocupa el centro de la barra.
 *
 * Sin red: el store ya tiene en memoria los candidatos y los puestos de la
 * empresa (los mismos que cuenta Vista general), así que la lista se recalcula
 * mientras escribes. La puntuación es la de `lib/search.ts`, la misma que usa el
 * panel: tolera acentos, erratas y teléfono por dígitos, y así "jose" encuentra
 * a "José" y 654 encuentra su número.
 *
 * Dos formas de la misma cosa: `inline` es el campo del centro (md en adelante)
 * y `sheet` la capa a pantalla completa del móvil, donde no cabe un campo.
 */

const MIN_CHARS = 2
const MAX_CANDIDATOS = 6
const MAX_PUESTOS = 4

type Hit =
  | { kind: 'candidato'; key: string; nombre: string; puesto: string; to: string }
  | { kind: 'puesto'; key: string; titulo: string; nuevos: number; to: string }

function useHits(query: string) {
  const { candidates, campaigns, newCountFor } = useStore()
  const base = useAppBase()
  return useMemo<Hit[]>(() => {
    const q = query.trim()
    if (q.length < MIN_CHARS) return []
    const nq = normalizeSearch(q)
    const tituloDe = (id: string) => campaigns.find((c) => c.id === id)?.title ?? 'Puesto'

    const personas: Hit[] = (candidates as Candidate[])
      .map((c) => ({ c, s: searchScore(c, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_CANDIDATOS)
      .map(({ c }) => ({
        kind: 'candidato' as const,
        key: c.id,
        nombre: candidateName(c),
        puesto: tituloDe(c.campaignId),
        to: `${base}/puestos/${c.campaignId}?candidato=${c.id}`,
      }))

    const puestos: Hit[] = (campaigns as Campaign[])
      .filter((c) => normalizeSearch(c.title).includes(nq))
      .slice(0, MAX_PUESTOS)
      .map((c) => ({
        kind: 'puesto' as const,
        key: c.id,
        titulo: c.title,
        nuevos: newCountFor(c.id),
        to: `${base}/puestos/${c.id}`,
      }))

    return [...personas, ...puestos]
  }, [query, candidates, campaigns, newCountFor, base])
}

export function GlobalSearch({ variant, onClose }: { variant: 'inline' | 'sheet'; onClose?: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(variant === 'sheet')
  const [activo, setActivo] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  // El cálculo va en segundo plano: con miles de candidatos, puntuar cada
  // pulsación en el hilo de la escritura haría el campo pastoso.
  const diferida = useDeferredValue(query)
  const hits = useHits(diferida)
  const corta = query.trim().length > 0 && query.trim().length < MIN_CHARS
  const mostrar = abierto && query.trim().length > 0

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

  const ir = (hit: Hit) => {
    setQuery('')
    setAbierto(false)
    onClose?.()
    navigate(hit.to)
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
    if (!hits.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((i) => (i + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((i) => (i - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits[activo]
      if (hit) ir(hit)
    }
  }

  const campo = (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={mostrar && hits.length > 0}
        aria-controls={listId}
        aria-activedescendant={mostrar && hits[activo] ? `${listId}-${activo}` : undefined}
        aria-autocomplete="list"
        aria-label="Buscar candidatos y puestos"
        placeholder="Buscar candidatos y puestos"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
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

  const lista = (
    <>
      {corta ? (
        <p className="px-2.5 py-3 text-[13px] text-slate-500">Escribe al menos {MIN_CHARS} letras.</p>
      ) : hits.length === 0 ? (
        <p className="px-2.5 py-3 text-[13px] text-slate-500">
          Nada con «{query.trim()}». Prueba con el nombre o el teléfono.
        </p>
      ) : (
        <ul id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(60vh,26rem)] overflow-y-auto">
          {hits.map((hit, i) => (
            // El título de grupo aparece cuando cambia el tipo, no en posiciones
            // fijas: si no hay ni un candidato, la lista empieza en "Puestos".
            <li key={`${hit.kind}-${hit.key}`} role="presentation">
              {(i === 0 || hits[i - 1].kind !== hit.kind) && (
                <Grupo>{hit.kind === 'candidato' ? 'Candidatos' : 'Puestos'}</Grupo>
              )}
              <button
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activo}
                onMouseEnter={() => setActivo(i)}
                onClick={() => ir(hit)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                  i === activo ? 'bg-slate-100' : ''
                }`}
              >
                {hit.kind === 'candidato' ? (
                  <>
                    <span
                      aria-hidden
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600"
                    >
                      {initials(hit.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900">{hit.nombre}</span>
                      <span className="block truncate text-[12px] text-slate-500">{hit.puesto}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                      <Briefcase className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900">{hit.titulo}</span>
                    {hit.nuevos > 0 && (
                      <span className="num shrink-0 rounded-full bg-slate-200 px-1.5 text-[11px] font-bold text-slate-700">
                        {miles(hit.nuevos)}
                      </span>
                    )}
                  </>
                )}
              </button>
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
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {query.trim() ? (
            lista
          ) : (
            <p className="px-2.5 py-3 text-[13px] text-slate-500">Busca a una persona por su nombre o su teléfono.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative flex h-full w-full max-w-[420px] items-center">
      {campo}
      {mostrar && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop">
          {lista}
        </div>
      )}
    </div>
  )
}

function Grupo({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 first:pt-1">
      {children}
    </p>
  )
}
