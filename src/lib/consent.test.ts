import { describe, it, expect } from 'vitest'
import {
  CONSENT_VERSION, CONSENT_VERSIONS, ENLACE_PRIVACIDAD,
  consentimientoVigente, textoConsentimiento,
} from './consent'

// El guardián del consentimiento. Lo que hay aquí no es estilo: cada regla
// corresponde a algo que, si se rompe, deja una candidatura sin poder demostrar
// qué aceptó esa persona, o al asistente escribiendo sin permiso.
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

  it('toda versión avisa de WhatsApp', () => {
    // Es la razón de existir de esta pieza: si el texto no lo dice, el
    // consentimiento guardado no ampara escribirle por WhatsApp.
    for (const v of CONSENT_VERSIONS) expect(v.texto).toMatch(/WhatsApp/)
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
