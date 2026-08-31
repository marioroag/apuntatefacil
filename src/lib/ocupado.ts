import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { paredAUtc } from '../../supabase/functions/_shared/schedule/zone'

/**
 * Lo que el anfitrión ya tiene cogido, para avisar ANTES de guardar una cita.
 *
 * Hasta ahora, poner una entrevista encima de otra se descubría al pulsar
 * "Agendar": la base tiene una constraint de exclusión y devolvía "ocupado".
 * Eso vale como red, pero llega tarde, y de lo que hay en el Google Calendar
 * del anfitrión no se enteraba nadie: ahí no hay constraint que valga.
 *
 * TRES DECISIONES:
 *
 *   1. AVISA, NO BLOQUEA. Solaparse a propósito es legítimo (una entrevista
 *      corta encima de un hueco reservado, dos personas a la vez en obra), y
 *      además lo que Google llama "ocupado" incluye cosas que no lo son. Lo
 *      irreversible ya lo para la base.
 *   2. LAS DOS FUENTES O NINGUNA. Lo resuelve el servidor en una llamada, y por
 *      eso aquí no hay lógica de mezcla: un aviso que salta con una cita de
 *      Google y se calla con otra entrevista nuestra enseña a no hacerle caso.
 *   3. LA HORA ES LA DEL ANFITRIÓN. Lo que se escribe en el selector es su hora
 *      de pared (así lo interpreta `create_manual_interview`), así que pasarla a
 *      instante con la zona del NAVEGADOR daría un aviso movido una hora en una
 *      empresa de Canarias. Se usa `paredAUtc`, la misma función con la que el
 *      servidor genera los huecos: la cuenta de zonas horarias de este producto
 *      está escrita una vez.
 */

export interface Tramo {
  start: number
  end: number
}

/** Cuánto se mira por delante. Más que el horizonte de la agenda (10 días), que
 *  a mano se cita a quince días vista sin problema. */
const DIAS = 60

export function useOcupado(
  hostUserId: string | null,
  /** La cita que se está moviendo, que no puede chocar consigo misma. */
  excluirInterviewId?: string,
): { choca: (cuandoLocal: string, duracionMin: number) => boolean } {
  const { company } = useAuth()
  const [tramos, setTramos] = useState<Tramo[]>([])
  const [tz, setTz] = useState('Europe/Madrid')

  useEffect(() => {
    let vivo = true
    const leer = async () => {
      if (!company?.id || company.id === 'demo') { setTramos([]); return }
      try {
        const desde = new Date()
        const hasta = new Date(desde.getTime() + DIAS * 86_400_000)
        const { data, error } = await supabase.functions.invoke('google-calendar', {
          body: {
            accion: 'ocupado',
            companyId: company.id,
            hostUserId: hostUserId || undefined,
            excluirInterviewId,
            desde: desde.toISOString(),
            hasta: hasta.toISOString(),
          },
        })
        if (error || !vivo) return
        setTz((data?.tz as string) || 'Europe/Madrid')
        setTramos(
          ((data?.tramos ?? []) as Array<{ start: string; end: string }>)
            .map((t) => ({ start: Date.parse(t.start), end: Date.parse(t.end) }))
            .filter((t) => Number.isFinite(t.start) && Number.isFinite(t.end)),
        )
      } catch {
        // Sin respuesta no se avisa de nada. Es un aviso, no una comprobación:
        // quedarse sin él no puede impedir agendar.
        if (vivo) setTramos([])
      }
    }
    void leer()
    return () => { vivo = false }
  }, [company?.id, hostUserId, excluirInterviewId])

  const choca = useCallback(
    (cuandoLocal: string, duracionMin: number): boolean => {
      if (!tramos.length || !cuandoLocal) return false
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(cuandoLocal)
      if (!m) return false
      const ini = paredAUtc(
        { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) },
        Number(m[4]), Number(m[5]), tz,
      )
      // Una hora que no existe (el salto de primavera) no choca con nada: ya la
      // rechaza quien la guarda, y avisar ahí de un solape sería contar el
      // problema equivocado.
      if (!ini) return false
      const a = ini.getTime()
      const b = a + duracionMin * 60_000
      return tramos.some((t) => a < t.end && b > t.start)
    },
    [tramos, tz],
  )

  return { choca }
}
