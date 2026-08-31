import { describe, expect, it } from 'vitest'

/**
 * EL GUARDIÁN DEL VOCABULARIO DE LA COLA.
 *
 * Postgres no sabe extender un `check`, así que toda migración que quiere un
 * tipo de trabajo nuevo borra la restricción y la vuelve a declarar CON TODOS.
 * Eso convierte la lista en una trampa: quien copie la de una migración vieja
 * (la primera que sale al buscar, casi siempre) borra sin querer los tipos que
 * añadieron las de en medio.
 *
 * No es hipotético. Pasó al añadir `sincronizar_calendario`: se copió la lista
 * de `20260801200000_interview_jobs.sql`, que tiene seis tipos, y se llevaba por
 * delante los once del canal de WhatsApp. En local pasó en verde porque no había
 * ni una fila con esos tipos; lo paró Postgres al empujar a PRODUCCIÓN, que es
 * el peor sitio donde enterarse y el único que tenía los datos para verlo.
 *
 * Esta prueba lo ve sin datos: lee las migraciones en orden y exige que cada
 * declaración contenga todo lo que declaraba la anterior. Añadir tipos, sí;
 * quitarlos, solo a propósito y apuntándolo abajo.
 */

const MIGRACIONES = import.meta.glob('../../supabase/migrations/*.sql', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

/**
 * Un tipo se puede retirar de verdad (deja de existir el trabajo que lo usaba),
 * y entonces se apunta aquí CON SU MOTIVO. Una excepción sin motivo es un olvido
 * con permiso.
 */
const RETIRADOS: Record<string, string> = {}

/** Las listas de `kind in (...)` de cada migración que toca la restricción. */
function declaraciones(): Array<{ fichero: string; tipos: string[] }> {
  const re = /add constraint interview_jobs_kind_check check \(kind in \(([\s\S]*?)\)\)/g
  return Object.keys(MIGRACIONES)
    .sort()
    .flatMap((ruta) => {
      const texto = MIGRACIONES[ruta]
      const out: Array<{ fichero: string; tipos: string[] }> = []
      for (const m of texto.matchAll(re)) {
        // Fuera los comentarios de línea antes de leer los literales, o un tipo
        // nombrado dentro de un comentario contaría como declarado.
        const cuerpo = m[1].split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
        out.push({ fichero: ruta.split('/').pop() ?? ruta, tipos: [...cuerpo.matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]) })
      }
      return out
    })
}

describe('los tipos de trabajo de la cola', () => {
  it('hay declaraciones que leer', () => {
    const d = declaraciones()
    expect(d.length, 'no se encuentra ninguna declaración de interview_jobs_kind_check').toBeGreaterThan(1)
    expect(d[0].tipos.length).toBeGreaterThan(0)
  })

  it('ninguna migración recorta el vocabulario de la anterior', () => {
    const d = declaraciones()
    let acumulado: string[] = []
    let vieneDe = '(ninguna)'

    for (const { fichero, tipos } of d) {
      const perdidos = acumulado.filter((t) => !tipos.includes(t) && !(t in RETIRADOS))
      expect(
        perdidos,
        `${fichero} deja fuera tipos que ya existían (${perdidos.join(', ')}), declarados en ` +
        `${vieneDe} o antes. La lista de un \`check\` es el vocabulario ENTERO de la tabla: ` +
        'cópiala de la ÚLTIMA migración que la tocó y añade el tuyo al final. Si de verdad ' +
        'quieres retirar uno, apúntalo en RETIRADOS con su motivo.',
      ).toEqual([])

      acumulado = [...new Set([...acumulado, ...tipos])]
      vieneDe = fichero
    }
  })

  it('el último incluye el del calendario', () => {
    const d = declaraciones()
    expect(d[d.length - 1].tipos).toContain('sincronizar_calendario')
  })
})
