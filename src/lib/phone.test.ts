import { describe, it, expect } from 'vitest'
import { extractCandidatePhone, waIdDe } from './phone'

// Los casos son los que decide `public.wa_id_de` en SQL, que es la que manda.
// Esto fija que la copia del cliente diga lo mismo: si alguien afloja una regla
// aquí para que "salgan más", la vista previa prometería envíos que el servidor
// va a descartar, y el empresario vería un número y luego otro.
//
// Estos 21 casos se pasaron por la función de SQL (2 ago 2026) y dieron
// exactamente esto. Si tocas `wa_id_de`, vuelve a pasarlos:
//   docker exec -i supabase_db_apuntatefacil psql -U postgres -d postgres \
//     -c "select public.wa_id_de('612345678 / 698765432')"
describe('waIdDe', () => {
  it('completa el prefijo de un móvil español', () => {
    expect(waIdDe('612345678')).toBe('34612345678')
    expect(waIdDe('712345678')).toBe('34712345678')
  })

  it('acepta los fijos españoles, que también reciben WhatsApp', () => {
    expect(waIdDe('912345678')).toBe('34912345678')
    expect(waIdDe('828123456')).toBe('34828123456')
  })

  it('aguanta cómo lo escribe la gente de verdad', () => {
    for (const escrito of ['+34 612 34 56 78', '0034612345678', '612-345-678', '(+34) 612345678']) {
      expect(waIdDe(escrito), escrito).toBe('34612345678')
    }
  })

  it('no toca el que ya trae su prefijo', () => {
    expect(waIdDe('34612345678')).toBe('34612345678')
  })

  it('rechaza un español con un dígito de menos, que es otra persona', () => {
    // Un +34 mal tecleado no se "arregla": se manda a alguien que no es.
    expect(waIdDe('+34 61234567')).toBeNull()
    expect(waIdDe('3461234567')).toBeNull()
  })

  it('acepta internacionales que no conocemos, que en este sector son muchos', () => {
    expect(waIdDe('+351 912 345 678')).toBe('351912345678')
    expect(waIdDe('+40 721 234 567')).toBe('40721234567')
  })

  it('rechaza nueve dígitos que no son forma española', () => {
    // Sin '+' no hay nada que diga de dónde es, y en España no empiezan por 3.
    expect(waIdDe('312345678')).toBeNull()
  })

  // La razón de ser de todo esto: ante la duda, nadie.
  it('rechaza la casilla con dos números distintos', () => {
    expect(waIdDe('612345678 / 698765432')).toBeNull()
    expect(waIdDe('612345678 o el fijo 912345678')).toBeNull()
  })

  it('acepta el mismo número repetido de dos formas', () => {
    expect(waIdDe('612345678 (+34 612 345 678)')).toBe('34612345678')
  })

  it('rechaza lo que no es un teléfono', () => {
    for (const nada of ['', '   ', 'no tengo', '123', null, undefined]) {
      expect(waIdDe(nada), String(nada)).toBeNull()
    }
  })
})

describe('extractCandidatePhone', () => {
  it('lee la clave fija del formulario', () => {
    expect(extractCandidatePhone({ telefono: '612345678' })).toBe('34612345678')
  })

  it('no se inventa un teléfono desde otro campo', () => {
    expect(extractCandidatePhone({ movil: '612345678', otro: '612345678' })).toBeNull()
  })

  it('aguanta una respuesta que no es texto', () => {
    expect(extractCandidatePhone({ telefono: 612345678 })).toBeNull()
    expect(extractCandidatePhone({})).toBeNull()
  })
})
