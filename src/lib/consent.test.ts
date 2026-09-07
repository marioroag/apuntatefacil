import { describe, it, expect } from 'vitest'
import {
  CONSENT_VERSION, CONSENT_VERSIONS, ENLACE_PRIVACIDAD,
  consentimientoVigente, textoConsentimiento,
} from './consent'

// El guardián del consentimiento. Lo que hay aquí no es estilo: cada regla
// corresponde a algo que, si se rompe, deja una candidatura sin poder demostrar
// qué aceptó esa persona.
describe('consentimiento', () => {
  it('ninguna versión se repite', () => {
    const ids = CONSENT_VERSIONS.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('la vigente es la última', () => {
    expect(CONSENT_VERSION).toBe(CONSENT_VERSIONS[CONSENT_VERSIONS.length - 1].id)
  })

  it('el id cabe en la columna (40 caracteres)', () => {
    for (const v of CONSENT_VERSIONS) expect(v.id.length).toBeLessThanOrEqual(40)
  })

  // AQUÍ SE EXIGÍA QUE TODA VERSIÓN NOMBRARA WHATSAPP, porque sin eso el permiso
  // guardado no amparaba escribirle por ahí. Retirado el asistente (sep 2026) la
  // regla se da la vuelta: lo que no se puede es PEDIR permiso para un canal que
  // no existe. Se comprueba sobre la VIGENTE y no sobre todas, porque las
  // versiones publicadas no se tocan: la 2026-08-02 lo nombra y tiene que seguir
  // resolviendo tal cual para quien la aceptó.
  it('el texto vigente no pide permiso para un canal que ya no existe', () => {
    expect(consentimientoVigente('Transportes Peña')).not.toMatch(/WhatsApp/)
  })

  it('toda versión lleva dentro la frase que se enlaza', () => {
    // El formulario parte el texto por aquí para colgar el enlace a
    // /privacidad. Sin la frase, la casilla se queda sin enlace.
    for (const v of CONSENT_VERSIONS) expect(v.texto).toContain(ENLACE_PRIVACIDAD)
  })

  it('toda versión coloca el nombre de la empresa', () => {
    for (const v of CONSENT_VERSIONS) expect(v.texto).toContain('{empresa}')
  })

  it('sin guiones largos, como el resto de la app', () => {
    for (const v of CONSENT_VERSIONS) expect(v.texto).not.toContain('—')
  })

  it('resuelve el texto de una versión pasada, no solo el de la vigente', () => {
    // Un candidato de hace seis meses tiene guardado un id viejo. Si no se
    // pudiera resolver, no se podría demostrar qué le dijimos.
    for (const v of CONSENT_VERSIONS) {
      expect(textoConsentimiento(v.id, 'Construcciones Ledesma')).toContain('Construcciones Ledesma')
    }
  })

  it('una versión desconocida devuelve null, no un texto inventado', () => {
    expect(textoConsentimiento('no-existe', 'Construcciones Ledesma')).toBeNull()
  })

  it('el vigente sale con el nombre puesto y sin marcador', () => {
    const t = consentimientoVigente('Transportes Peña')
    expect(t).toContain('Transportes Peña')
    expect(t).not.toContain('{empresa}')
  })
})
