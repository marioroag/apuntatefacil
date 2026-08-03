import { describe, expect, it } from 'vitest'
import { mentionHandle, mentionToken, resolveMentions } from './mentions'
import type { CompanyMember } from './types'

/**
 * EL GUARDIÁN DE LAS MENCIONES.
 *
 * La mención se escribe con las mayúsculas de la persona ("@Laura.Gil", no
 * "@laura.gil"), y eso solo puede tocar el CASO de las letras: lo que se
 * escribe tiene que seguir avisando. La trampa está en los acentos, porque la
 * resolución ignora las mayúsculas pero no los acentos: adaptar "jose" al
 * "José" del perfil dejaría en el texto un identificador que no resuelve a
 * nadie, con la chapa quitada y quien escribe convencido de que ha avisado.
 */

const miembro = (email: string, userId: string): CompanyMember => ({
  userId,
  email,
  role: 'member',
  isSelf: false,
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
