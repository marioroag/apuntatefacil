import { describe, expect, it } from 'vitest'
import { MENTION_SPLIT_RE, mentionHandle, resolveMentions } from './mentions'
import { SEED_CANDIDATE_COMMENTS, SEED_MEMBERS, SEED_TEAM_COMMENTS } from './seed'
import type { CompanyMember } from './types'

/**
 * El guardián de las menciones.
 *
 * Lo que vigila no es una regex: es que una mención NUNCA prometa un aviso que
 * no va a salir. En el chat, `@algo` se pinta con chapa solo si resuelve a
 * alguien, y quien escribe deduce de esa chapa que ha avisado. Si lo que se
 * pinta y lo que se avisa se separan, el fallo es invisible y el precio lo paga
 * quien creía haber llamado a un compañero.
 */

const EQUIPO: CompanyMember[] = [
  { userId: 'u-yo', email: 'marta@empresa.es', role: 'owner', isSelf: true },
  { userId: 'u-laura', email: 'laura.gil@empresa.es', role: 'member', isSelf: false },
  { userId: 'u-sergio', email: 'sergio@empresa.es', role: 'member', isSelf: false },
]

describe('a quién avisa un mensaje', () => {
  it('avisa al compañero que se nombra', () => {
    expect(resolveMentions('@laura.gil ¿lo llamas tú?', EQUIPO)).toEqual(['u-laura'])
  })

  it('no avisa a nadie por un identificador que no es de nadie', () => {
    // Y es justo el caso que el chat pinta como texto normal: lo que no avisa
    // no lleva chapa.
    expect(resolveMentions('escribe a @nadie y a @laura.gil2', EQUIPO)).toEqual([])
  })

  it('no te avisa a ti mismo, que no es un aviso', () => {
    expect(resolveMentions('@marta me lo apunto', EQUIPO)).toEqual([])
  })

  it('avisa una sola vez a quien se nombra dos veces', () => {
    expect(resolveMentions('@sergio y otra vez @sergio', EQUIPO)).toEqual(['u-sergio'])
  })

  it('no se come el correo de un candidato escrito en el mensaje', () => {
    // 'laura.gil@empresa.es' contiene un '@', pero lo que va detrás es el
    // dominio: nadie ha llamado a nadie.
    expect(resolveMentions('me escribió desde luis@example.com', EQUIPO)).toEqual([])
  })

  it('parte el cuerpo por las mismas menciones que resuelve', () => {
    // El pintado y el aviso salen de la misma gramática. Si se separan, se
    // puede pintar una chapa que no avisa (o al revés).
    const trozos = '@laura.gil mira esto'.split(MENTION_SPLIT_RE)
    expect(trozos).toContain('@laura.gil')
  })
})

describe('las menciones de la demo son de verdad', () => {
  const porHandle = new Map(SEED_MEMBERS.map((m) => [mentionHandle(m.email), m]))
  const hilos = [
    ...SEED_TEAM_COMMENTS.map((c) => ({ donde: `tablón ${c.id}`, ...c })),
    ...SEED_CANDIDATE_COMMENTS.map((c) => ({ donde: `ficha ${c.id}`, ...c })),
  ]

  it('lo que se ve mencionado es a quien se avisa', () => {
    for (const { donde, body, mentions, authorUserId } of hilos) {
      // Quien no avisa es el AUTOR (nombrarte a ti mismo no es un aviso), no
      // quien esté mirando la demo: a `demo-user` le escriben sus compañeros.
      const escritos = (body.match(/@[\w.+-]+/g) ?? [])
        .map((t) => porHandle.get(t.slice(1).toLowerCase()))
        .filter((m): m is (typeof SEED_MEMBERS)[number] => !!m && m.user_id !== authorUserId)
        .map((m) => m.user_id)
      expect([...new Set(escritos)].sort(), `${donde}: el texto nombra a quien no avisa`).toEqual(
        [...mentions].sort(),
      )
    }
  })

  it('no avisa a nadie que no esté en el equipo', () => {
    const delEquipo = new Set(SEED_MEMBERS.map((m) => m.user_id))
    for (const { donde, mentions } of hilos) {
      for (const uid of mentions) expect(delEquipo.has(uid), `${donde}: ${uid}`).toBe(true)
    }
  })
})
