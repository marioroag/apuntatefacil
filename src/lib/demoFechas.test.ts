import { describe, expect, it } from 'vitest'
import {
  SEED,
  SEED_CANDIDATE_COMMENTS,
  SEED_CANDIDATE_EVENTS,
  SEED_TEAM_COMMENTS,
  SEED_TEAM_REQUESTS,
  freshenDemoData,
  DEMO_SEED_NOW_MS,
} from './seed'

/* ---------------------------------------------------------------------------
   EL GUARDIÁN DE LAS FECHAS DE LA DEMO.

   La demo se escribe contra un "ahora" narrativo fijo (`DEMO_SEED_NOW_MS`) y al
   cargarla `freshenDemoData` la desplaza entera hasta hoy, para que no envejezca.
   Eso descansa en una regla que no se ve por ninguna parte:

     **TODA fecha de la demo tiene que viajar en ese desplazamiento.**

   Una que se quede fuera no rompe nada de golpe: se queda anclada en julio
   mientras sus hermanas se mudan a hoy, y empieza a contar historias imposibles.
   Pasó (ago 2026) con `statusChangedAt`, el reloj de la etapa que estrena el
   tablero: la tarjeta decía "43 días en esta etapa" de alguien que había llegado
   hacía tres, porque su etapa "empezaba" cinco semanas ANTES de su candidatura.

   Por eso esto no es un comentario en `freshenDemoData`: es una prueba que falla
   cuando alguien añade un campo de fecha y se olvida de moverlo.

   LO QUE NO PUEDE VIGILAR: si las fechas cuentan una historia creíble (que una
   entrevista caiga en día hábil, que un contratado no lleve un año en la etapa).
   Eso sigue siendo mirar la demo.
--------------------------------------------------------------------------- */

/** El bundle tal y como lo hidrata la app. */
const fresco = (now: number) =>
  freshenDemoData(
    {
      campaigns: SEED.campaigns,
      candidates: SEED.candidates,
      teamRequests: SEED_TEAM_REQUESTS,
      teamComments: SEED_TEAM_COMMENTS,
      candidateComments: SEED_CANDIDATE_COMMENTS,
      candidateEvents: SEED_CANDIDATE_EVENTS,
    },
    now,
  )

/** Un "hoy" muy posterior al reloj del seed: es el caso real (la demo se mira
 *  meses después de escribirla) y el que destapa lo que no viaja. */
const HOY = Date.parse('2026-11-20T10:00:00.000Z')

describe('el guardián de las fechas de la demo', () => {
  it('ninguna etapa empieza antes de que llegue la candidatura', () => {
    const { candidates } = fresco(HOY)
    const imposibles = candidates
      .filter((c) => Date.parse(c.statusChangedAt) < Date.parse(c.submittedAt))
      .map((c) => `${c.id} (llegó ${c.submittedAt}, etapa desde ${c.statusChangedAt})`)

    expect(
      imposibles.slice(0, 5),
      `Estas candidaturas entran en su etapa ANTES de existir (${imposibles.length} en total).\n` +
        'Casi siempre significa que el campo no viaja en `freshenDemoData`: el seed lo\n' +
        'escribe contra DEMO_SEED_NOW_MS y la llegada sí se desplaza a hoy.',
    ).toEqual([])
  })

  it('ninguna etapa empieza en el futuro', () => {
    const { candidates } = fresco(HOY)
    const futuras = candidates.filter((c) => Date.parse(c.statusChangedAt) > HOY).map((c) => c.id)
    expect(futuras.slice(0, 5), `Estas empiezan su etapa en el futuro: ${futuras.length}`).toEqual([])
  })

  it('quien sigue en `nuevo` no ha cambiado de etapa: su reloj es el de llegar', () => {
    // Es lo que hace que un candidato recién llegado diga "Hoy" y no un número
    // inventado. Si se rompe, casi seguro es que alguien reasignó el estado
    // después de crearlo sin mover su reloj (fue el caso de `markProposed`).
    const { candidates } = fresco(HOY)
    const desalineados = candidates
      .filter((c) => c.status === 'nuevo' && c.statusChangedAt !== c.submittedAt)
      .map((c) => c.id)

    expect(
      desalineados.slice(0, 5),
      `Estos siguen en "nuevo" con un reloj de etapa distinto al de su llegada: ${desalineados.length}.\n` +
        'Cambiar el estado es reiniciar el reloj: quien lo reasigne tiene que moverlo.',
    ).toEqual([])
  })

  it('el desplazamiento conserva las distancias, no solo el orden', () => {
    // La demo se lee por sus duraciones ("3 días en esta etapa"), así que el
    // delta tiene que ser el MISMO para todas las fechas de un candidato.
    const antes = SEED.candidates.find((c) => c.status !== 'nuevo')!
    const despues = fresco(HOY).candidates.find((c) => c.id === antes.id)!
    const dLlegada = Date.parse(despues.submittedAt) - Date.parse(antes.submittedAt)
    const dEtapa = Date.parse(despues.statusChangedAt) - Date.parse(antes.statusChangedAt)
    expect(dEtapa, 'la etapa se desplaza con otro delta que la llegada').toBe(dLlegada)
  })

  it('el reloj narrativo del seed sigue siendo anterior a las fechas ya frescas', () => {
    // Cordura del montaje: si esto cae, es que el seed dejó de escribirse contra
    // su ancla y el desplazamiento ya no significa lo que dice.
    const crudo = SEED.candidates.map((c) => Date.parse(c.submittedAt))
    expect(Math.max(...crudo)).toBeLessThanOrEqual(DEMO_SEED_NOW_MS)
  })
})
