import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './auth'
import { useStore } from './store'
import { useAppBase } from './useAppBase'
import { candidateName } from './format'
import { planHas } from './pricing'
import type { CandidateComment, TeamRequestComment } from './types'

/**
 * Avisos: lo que ha pasado y te toca a ti. Alimenta el timbre de la barra.
 *
 * Regla de qué entra: algo que **una persona dirige a ti** o que ha cambiado y
 * quieres enterarte. Por eso los candidatos nuevos NO son un aviso: ya los
 * cuenta la Bandeja en el menú lateral, y 272 avisos no avisan de nada.
 *
 * Todo se DERIVA de datos que ya existen; no hay tabla de notificaciones ni
 * nada que mantener. El "visto" es una marca de tiempo por empresa en
 * localStorage, el mismo patrón que ya usan `seen` (candidatos) y `boardSeen`.
 *
 * Para añadir una fuente (las entrevistas de la rama de agenda son la
 * siguiente: "mañana a las 10:00 tienes a Manuel"), se empuja a `out` en el
 * useMemo de abajo con su `kind` y su `to`. Nada más: el panel, el contador y
 * el visto ya funcionan por fecha.
 */

export type AvisoKind = 'mencion' | 'respuesta' | 'peticion' | 'completada'

export interface Aviso {
  id: string
  kind: AvisoKind
  /** ISO. Ordena la lista y decide si está sin ver. */
  at: string
  actorUserId: string | null
  actorEmail: string
  /** Verbo en tercera persona, SIN el nombre: lo antepone quien lo pinta, que
   *  es quien sabe resolver el nombre real de esa persona. */
  accion: string
  detalle: string
  to: string
}

const SEEN_KEY = 'apuntatefacil.avisos.seen'
const MAX = 30

function readSeen(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export interface AvisosState {
  /** Si el plan no tiene equipo, nada puede generar un aviso: el timbre no se pinta. */
  disponible: boolean
  items: Aviso[]
  sinVer: number
  marcarVisto: () => void
}

export function useAvisos(): AvisosState {
  const { user, company } = useAuth()
  const { loadMentions, loadBoardMentions, teamRequests, candidates, campaigns, members, chatVersion, boardVersion } =
    useStore()
  const base = useAppBase()
  const userId = user?.id ?? null
  const companyId = company?.id ?? null
  const demo = base === '/demo'
  const disponible = demo || planHas(company?.plan, 'teamBoard')

  const [menciones, setMenciones] = useState<CandidateComment[]>([])
  const [mencionesTablon, setMencionesTablon] = useState<TeamRequestComment[]>([])
  const [seen, setSeen] = useState<Record<string, string>>(readSeen)

  // El valor del store se rehace con cualquier cambio de datos, así que
  // `loadMentions` no puede ir en las dependencias: dispararía una consulta por
  // render. Va por referencia, y se recarga cuando cambia el chat.
  const loadRef = useRef(loadMentions)
  loadRef.current = loadMentions
  const loadTablonRef = useRef(loadBoardMentions)
  loadTablonRef.current = loadBoardMentions
  useEffect(() => {
    // Sin limpiar el estado al salir: `items` ya devuelve [] cuando no procede,
    // y al cambiar de empresa las menciones viejas se caen solas porque su
    // candidato no está en el store nuevo.
    if (!disponible || !userId || !companyId) return
    let vivo = true
    void loadRef.current().then((m) => {
      if (vivo) setMenciones(m)
    })
    void loadTablonRef.current().then((m) => {
      if (vivo) setMencionesTablon(m)
    })
    return () => {
      vivo = false
    }
    // `candidates.length` entra a propósito: en la demo los datos se restauran
    // de localStorage DESPUÉS del primer render, así que sin esto la consulta
    // salía contra un store vacío y las menciones no aparecían nunca. De paso,
    // al entrar una candidatura nueva se refrescan las menciones.
    // `boardVersion` sube con cada ping realtime del tablón: sin él, una
    // mención en una petición no llegaría al timbre hasta recargar.
  }, [disponible, userId, companyId, chatVersion, boardVersion, candidates.length])

  const items = useMemo<Aviso[]>(() => {
    if (!disponible) return []
    const out: Aviso[] = []
    const emailDe = (uid: string | null) => members.find((m) => m.userId === uid)?.email ?? ''

    for (const m of menciones) {
      if (m.authorUserId === userId) continue
      const cand = candidates.find((c) => c.id === m.candidateId)
      // Sin ficha visible no hay aviso: la RLS puede dejarte fuera de ese
      // candidato (encargado de otra sede) y anunciar algo que no puedes abrir
      // sería mandarte a una puerta cerrada.
      if (!cand) continue
      const puesto = campaigns.find((c) => c.id === cand.campaignId)?.title ?? 'Puesto'
      out.push({
        id: `mencion-${m.id}`,
        kind: 'mencion',
        at: m.createdAt,
        actorUserId: m.authorUserId,
        actorEmail: m.authorEmail,
        accion: 'te mencionó',
        detalle: `${candidateName(cand)} · ${puesto}`,
        to: `${base}/puestos/${cand.campaignId}?candidato=${cand.id}`,
      })
    }

    // Menciones del tablón, antes que la actividad: una petición donde te han
    // llamado por tu nombre se anuncia por eso, no como "movimiento".
    // Se apunta CUÁNDO fue la última, no solo que la hubo: si después alguien
    // ha vuelto a escribir, eso es otra cosa que contar y sí merece su línea.
    const mencionAt = new Map<string, string>()
    for (const m of mencionesTablon) {
      if (m.authorUserId === userId) continue
      const req = teamRequests.find((r) => r.id === m.requestId)
      // Sin petición visible no hay aviso, por lo mismo que en las fichas: la
      // RLS puede dejarte fuera y sería mandarte a una puerta cerrada.
      if (!req) continue
      const previa = mencionAt.get(req.id)
      if (!previa || m.createdAt > previa) mencionAt.set(req.id, m.createdAt)
      out.push({
        id: `mencion-tablon-${m.id}`,
        kind: 'mencion',
        at: m.createdAt,
        actorUserId: m.authorUserId,
        actorEmail: m.authorEmail,
        accion: 'te mencionó en el tablón',
        detalle: req.title,
        to: `${base}/equipo?peticion=${req.id}`,
      })
    }

    for (const r of teamRequests) {
      const to = `${base}/equipo?peticion=${r.id}`
      // Completada por otro algo que pediste tú: se cierra un asunto tuyo.
      if (r.status === 'completada') {
        if (r.completedBy && r.completedBy !== userId && r.authorUserId === userId) {
          out.push({
            id: `completada-${r.id}`,
            kind: 'completada',
            at: r.lastActivityAt,
            actorUserId: r.completedBy,
            actorEmail: emailDe(r.completedBy),
            accion: 'completó tu petición',
            detalle: r.title,
            to,
          })
        }
        continue
      }
      if (r.lastActivityBy === userId) continue
      if (r.commentCount === 0) {
        if (r.authorUserId === userId) continue
        out.push({
          id: `peticion-${r.id}`,
          kind: 'peticion',
          at: r.createdAt,
          actorUserId: r.authorUserId,
          actorEmail: r.authorEmail,
          accion: 'abrió una petición',
          detalle: r.title,
          to,
        })
      } else {
        // Si lo último que pasó en esa petición fue que te mencionaran, ese
        // aviso lo dice todo y mejor: dos líneas del mismo hilo en el timbre
        // son una de más. Si después alguien escribió otra cosa, se cuenta.
        const mencion = mencionAt.get(r.id)
        if (mencion && mencion >= r.lastActivityAt) continue
        out.push({
          id: `respuesta-${r.id}`,
          kind: 'respuesta',
          at: r.lastActivityAt,
          actorUserId: r.lastActivityBy,
          actorEmail: emailDe(r.lastActivityBy),
          accion: r.authorUserId === userId ? 'respondió en tu petición' : 'respondió en el tablón',
          detalle: r.title,
          to,
        })
      }
    }

    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX)
  }, [disponible, menciones, mencionesTablon, teamRequests, candidates, campaigns, members, userId, base])

  const desde = companyId ? seen[companyId] : undefined
  const sinVer = items.filter((a) => !desde || a.at > desde).length

  const marcarVisto = useCallback(() => {
    if (!companyId) return
    setSeen((prev) => {
      const next = { ...prev, [companyId]: new Date().toISOString() }
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next))
      } catch {
        /* cuota llena: el contador se recalcula igual en esta sesión */
      }
      return next
    })
  }, [companyId])

  return { disponible, items, sinVer, marcarVisto }
}
