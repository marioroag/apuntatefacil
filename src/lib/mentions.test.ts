import { describe, expect, it } from 'vitest'
import { MENTION_SPLIT_RE, mentionHandle, mentionToken, resolveMentions } from './mentions'
import { SEED_CANDIDATE_COMMENTS, SEED_MEMBERS, SEED_TEAM_COMMENTS } from './seed'
import type { CompanyMember } from './types'

/**
 * EL GUARDIÁN DE LAS MENCIONES.
 *
 * Lo que vigila no es una regex: es que una mención NUNCA prometa un aviso que
 * no va a salir. En el chat, `@algo` se pinta con chapa solo si resuelve a
 * alguien, y quien escribe deduce de esa chapa que ha avisado. Si lo que se
 * pinta, lo que se escribe y lo que se avisa se separan, el fallo es invisible
 * y el precio lo paga quien creía haber llamado a un compañero.
 *
 * De ahí las tres partes: la gramática (a quién avisa un texto), la escritura
 * (el identificador lleva las mayúsculas de la persona, y eso solo puede tocar
 * el CASO de las letras: la resolución ignora las mayúsculas pero no los
 * acentos) y la demo (que no haya un `@` con chapa que no avise a nadie).
 */

const miembro = (email: string, userId: string): CompanyMember => ({
  userId,
  email,
  role: 'member',
  isSelf: false,
})

const EQUIPO: CompanyMember[] = [
  { userId: 'u-yo', email: 'marta@empresa.es', role: 'owner', isSelf: true },
  miembro('laura.gil@empresa.es', 'u-laura'),
  miembro('sergio@empresa.es', 'u-sergio'),
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

describe('mentionToken: el identificador se escribe como la persona se llama', () => {
  it('toma las mayúsculas del nombre, trozo a trozo', () => {
    expect(mentionToken('Laura Gil', 'laura.gil@empresa.es')).toBe('Laura.Gil')
    expect(mentionToken('Laura', 'laura@empresa.es')).toBe('Laura')
    expect(mentionToken('Ana McDonald', 'ana.mcdonald@empresa.es')).toBe('Ana.McDonald')
  })

  it('respeta el nombre que se ha puesto la persona, aunque sea en minúscula', () => {
    expect(mentionToken('laura gil', 'laura.gil@empresa.es')).toBe('laura.gil')
    expect(mentionToken('LAURA GIL', 'laura.gil@empresa.es')).toBe('LAURA.GIL')
  })

  it('no inventa mayúsculas donde no hay nombre al que adaptarse', () => {
    expect(mentionToken('', 'laura.gil@empresa.es')).toBe('laura.gil')
    expect(mentionToken(null, 'laura.gil@empresa.es')).toBe('laura.gil')
    // 'hr' no es ninguna de sus palabras: se queda como está.
    expect(mentionToken('Laura Gil', 'laura.gil.hr@empresa.es')).toBe('Laura.Gil.hr')
  })

  it('cambia el caso, NUNCA las letras (los acentos se quedan fuera)', () => {
    expect(mentionToken('José Muñoz', 'jose.munoz@empresa.es')).toBe('Jose.Munoz')
  })
})

describe('lo que se escribe sigue avisando', () => {
  const equipo = [miembro('laura.gil@empresa.es', 'u-laura'), miembro('jose.munoz@empresa.es', 'u-jose')]

  it('la mención con mayúsculas resuelve igual que la de antes', () => {
    for (const nombre of ['Laura Gil', 'laura gil', 'LAURA GIL']) {
      const token = mentionToken(nombre, 'laura.gil@empresa.es')
      expect(resolveMentions(`@${token} mira esto`, equipo)).toEqual(['u-laura'])
    }
    expect(resolveMentions(`@${mentionToken('José Muñoz', 'jose.munoz@empresa.es')} ¿lo ves?`, equipo)).toEqual(['u-jose'])
  })

  it('la clave de búsqueda sigue siendo siempre minúscula', () => {
    expect(mentionHandle('Laura.Gil@empresa.es')).toBe('laura.gil')
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

/**
 * Y LA CUARTA PARTE: QUE UNA EDICIÓN NO PUEDA REPARTIR AVISOS.
 *
 * Desde ago 2026 se puede corregir una nota propia, y lo único que sostiene que
 * eso no toque `mentions` es que el UPDATE está concedido POR COLUMNAS. Un
 * `grant update on ...` a secas (sin la lista) pasa desapercibido en una
 * revisión, no rompe ninguna pantalla y deja al cliente reescribiendo a quién se
 * avisó: el aviso ya salió por correo, así que la fila pasaría a decir una cosa
 * distinta de lo que de verdad ocurrió.
 *
 * Se mira el SQL crudo porque esto no se puede comprobar desde la app: aquí no
 * hay base de datos, y el fallo vive en una línea de migración.
 */
describe('editar una nota no puede tocar a quién se avisó', () => {
  const migraciones = import.meta.glob('../../supabase/migrations/*.sql', {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>

  it('el update de los hilos va acotado por columnas', () => {
    const HILOS = ['candidate_comments', 'team_request_comments']
    for (const [ruta, sql] of Object.entries(migraciones)) {
      // `grant update on <tabla>` (sin lista de columnas) para cualquier rol que
      // no sea service_role, que es quien reclama `notified_at` al mandar el
      // correo y por eso sí necesita la fila entera.
      for (const tabla of HILOS) {
        const suelto = new RegExp(
          `grant[^;]*\\bupdate\\b(?!\\s*\\()[^;]*\\bon\\s+(?:public\\.)?${tabla}\\b[^;]*to\\s+([^;]*);`,
          'gi',
        )
        for (const m of sql.matchAll(suelto)) {
          const roles = m[1].toLowerCase()
          expect(
            roles.replace(/service_role|,|\s/g, ''),
            `${ruta.split('/').pop()}: \`grant update\` sin lista de columnas sobre ${tabla}. ` +
            'Con eso, quien edita su nota puede reescribir `mentions` y hacer que la fila ' +
            'diga que avisó a alguien a quien nunca le salió el correo. Concede solo ' +
            '`grant update (body)`.',
          ).toBe('')
        }
      }
    }
  })
})
