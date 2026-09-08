// El guardián del prerender de /a/:slug (api/_lib/publico.ts). No hay servidor:
// se prueba la función pura que rellena la cabecera del shell real (index.html)
// y monta el JobPosting. Lo que vigila: que nada se invente, que lo no activo o
// sin anuncio lleve noindex y no lleve JobPosting, que un slug desconocido
// lleve noindex, que el JSON no pueda cerrar el script, que la URL canónica sea
// la MISMA que la SPA pone en la barra y que el origen sea el de la marca.
import { describe, expect, it } from 'vitest'
import shell from '../../index.html?raw'
import {
  ORIGEN_PUBLICO, cabeceraPuesto, descripcionHtml, jobPosting, jsonLdSeguro, prerenderPublico,
  sitemapXml, validThrough, type PuestoPublico,
} from '../../api/_lib/publico'
import { DOMAIN, publicFormPathPretty } from './brand'
import { leerAnuncio } from './anuncio'

const AHORA = new Date('2026-09-07T10:00:00.000Z')

const PUESTO: PuestoPublico = {
  id: '3f1c2a8e-0000-4000-8000-000000000001',
  slug: 'k7p2m9x4a1',
  title: 'Mozo/a de almacén',
  status: 'activa',
  sector: 'Logística',
  location: 'Getafe',
  provincia: 'Madrid',
  created_at: '2026-09-01T09:00:00.000Z',
  anuncio: {
    descripcion: 'Preparar pedidos con PDA\nCargar y descargar camiones',
    modalidad: 'presencial',
    salarioMin: 1500,
    salarioMax: 1650,
    salarioPeriodo: 'mes',
    contrato: 'Temporal',
    jornada: 'Completa',
    experiencia: 'De 1 a 2 años',
    estudios: 'Educación Secundaria Obligatoria',
    idiomas: [{ idioma: 'Español', nivel: 'Avanzado' }],
    conocimientos: ['Carretilla elevadora', 'PDA'],
  },
  company_name: 'Logística Sur',
  company_description: 'Somos una empresa de logística con almacén en Getafe.',
  logo_path: 'empresa/logo.webp',
  banner_path: null,
}
const CTX = { supabaseUrl: 'https://xyz.supabase.co', ahora: AHORA }
const URL_CANONICA = 'https://apuntatefacil.com/logistica-sur/k7p2m9x4a1/mozo-a-de-almacen'

function metaDe(html: string, attr: 'name' | 'property', nombre: string): string | null {
  const m = html.match(new RegExp(`<meta ${attr}="${nombre}" content="([^"]*)"`))
  return m ? m[1] : null
}

function jsonLdDe(html: string): Record<string, unknown> | null {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  return m ? JSON.parse(m[1]) : null
}

describe('la URL canónica es la de la marca y la de la barra', () => {
  it('ORIGEN_PUBLICO espeja DOMAIN de brand.ts', () => {
    expect(ORIGEN_PUBLICO).toBe(`https://${DOMAIN}`)
  })
  it('la canónica es exactamente la que la SPA pone en la barra (publicFormPathPretty)', () => {
    const c = cabeceraPuesto(PUESTO, CTX)
    expect(c.url).toBe(`${ORIGEN_PUBLICO}${publicFormPathPretty(PUESTO.slug, PUESTO.company_name, PUESTO.title)}`)
    expect(c.url).toBe(URL_CANONICA)
  })
})

describe('cabecera', () => {
  it('sustituye título, descripción y og:* del shell real y añade canonical', () => {
    const html = prerenderPublico(shell, PUESTO, CTX)
    expect(html).toContain('<title>Mozo/a de almacén en Getafe · Logística Sur</title>')
    expect(metaDe(html, 'property', 'og:title')).toBe('Mozo/a de almacén en Getafe · Logística Sur')
    // Primero los hechos que descartan, luego la descripción. (Las cifras van
    // como las escribe la página: Intl en es-ES no agrupa los de cuatro dígitos.)
    expect(metaDe(html, 'name', 'description')).toBe(
      'Getafe, Madrid · Presencial · 1500 - 1650 € bruto/mes · Contrato temporal, jornada completa. Preparar pedidos con PDA Cargar y descargar camiones',
    )
    expect(metaDe(html, 'property', 'og:url')).toBe(URL_CANONICA)
    expect(html).toContain(`<link rel="canonical" href="${URL_CANONICA}" />`)
    expect(html).not.toContain('name="robots"')
    // La cabecera genérica de la landing ya no está.
    expect(html).not.toMatch(/<title>apuntatefacil: Contrata/)
    expect((html.match(/<meta property="og:title"/g) ?? []).length).toBe(1)
    // El cuerpo de la SPA sigue intacto.
    expect(html).toContain('<div id="root"></div>')
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>')
  })

  it('la imagen: banner > logo del bucket público > og.png; sin medidas inventadas', () => {
    const conLogo = prerenderPublico(shell, PUESTO, CTX)
    expect(metaDe(conLogo, 'property', 'og:image')).toBe('https://xyz.supabase.co/storage/v1/object/public/brand-assets/empresa/logo.webp')
    expect(metaDe(conLogo, 'name', 'twitter:card')).toBe('summary')
    expect(conLogo).not.toContain('og:image:width')
    const conBanner = prerenderPublico(shell, { ...PUESTO, banner_path: '/brand-demo/banner.jpg' }, CTX)
    expect(metaDe(conBanner, 'property', 'og:image')).toBe('https://apuntatefacil.com/brand-demo/banner.jpg')
    expect(metaDe(conBanner, 'name', 'twitter:card')).toBe('summary_large_image')
    const sinNada = prerenderPublico(shell, { ...PUESTO, logo_path: null }, CTX)
    expect(metaDe(sinNada, 'property', 'og:image')).toBe('https://apuntatefacil.com/og.png')
    expect(sinNada).toContain('og:image:width')
  })

  it('sin puesto, el shell sale intacto salvo un noindex', () => {
    const html = prerenderPublico(shell, null, CTX)
    expect(html).toContain('<meta name="robots" content="noindex" />')
    expect(html.replace('    <meta name="robots" content="noindex" />\n', '')).toBe(shell)
  })

  it('un puesto pausado lleva noindex y no lleva JobPosting; el enlace sigue vivo', () => {
    const html = prerenderPublico(shell, { ...PUESTO, status: 'pausada' }, CTX)
    expect(html).toContain('<meta name="robots" content="noindex" />')
    expect(jsonLdDe(html)).toBeNull()
    expect(html).toContain('<div id="root"></div>')
  })

  it('sin anuncio tampoco se indexa, y la descripción cae a la empresa', () => {
    const sin = cabeceraPuesto({ ...PUESTO, anuncio: null }, CTX)
    expect(sin.indexable).toBe(false)
    expect(sin.jsonLd).toBeNull()
    expect(sin.description).toBe('Somos una empresa de logística con almacén en Getafe.')
    const vacio = cabeceraPuesto({ ...PUESTO, anuncio: { descripcion: '  ' }, company_description: null }, CTX)
    expect(vacio.indexable).toBe(false)
    expect(vacio.description).toBe('Apúntate en un minuto, sin CV ni crear cuenta.')
  })
})

describe('JobPosting', () => {
  it('es válido, directo y solo con lo que el puesto dice', () => {
    const jd = jobPosting(PUESTO, CTX)!
    expect(jd['@context']).toBe('https://schema.org')
    expect(jd['@type']).toBe('JobPosting')
    expect(jd.title).toBe('Mozo/a de almacén')
    expect(jd.directApply).toBe(true)
    expect(jd.hiringOrganization).toEqual({
      '@type': 'Organization', name: 'Logística Sur',
      logo: 'https://xyz.supabase.co/storage/v1/object/public/brand-assets/empresa/logo.webp',
    })
    expect(jd.industry).toBe('Logística')
    expect(jd.datePosted).toBe('2026-09-01T09:00:00.000Z')
    expect(Date.parse(String(jd.validThrough))).toBeGreaterThan(AHORA.getTime())
    expect(jd.jobLocation).toEqual({
      '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Getafe', addressRegion: 'Madrid', addressCountry: 'ES' },
    })
    expect(jd.jobLocationType).toBeUndefined()
    expect(jd.employmentType).toEqual(['FULL_TIME', 'TEMPORARY'])
    expect(jd.baseSalary).toEqual({
      '@type': 'MonetaryAmount', currency: 'EUR',
      value: { '@type': 'QuantitativeValue', unitText: 'MONTH', minValue: 1500, maxValue: 1650 },
    })
    expect(jd.experienceRequirements).toEqual({ '@type': 'OccupationalExperienceRequirements', monthsOfExperience: 12 })
    expect(jd.educationRequirements).toEqual({ '@type': 'EducationalOccupationalCredential', credentialCategory: 'high school' })
    expect(jd.skills).toBe('Carretilla elevadora, PDA')
    expect(jd.qualifications).toBe('Español (avanzado)')
    expect(jd.identifier).toEqual({ '@type': 'PropertyValue', name: 'Logística Sur', value: PUESTO.id })
    expect(jd.url).toBe(URL_CANONICA)
  })

  it('la descripción es la oferta entera, con las mismas frases que la página', () => {
    const html = descripcionHtml(PUESTO, leerAnuncio(PUESTO.anuncio))
    expect(html).toBe(
      '<ul><li>Preparar pedidos con PDA</li><li>Cargar y descargar camiones</li></ul>' +
      '<p><strong>Requisitos</strong></p><ul><li>Experiencia mínima: de 1 a 2 años</li><li>Estudios mínimos: educación secundaria obligatoria</li><li>Español: avanzado</li><li>Conocimientos: Carretilla elevadora, PDA</li></ul>' +
      '<p><strong>Condiciones</strong></p><ul><li>Ubicación: Getafe, Madrid</li><li>Modalidad: presencial</li><li>Contrato temporal, jornada completa</li><li>Salario: 1500 - 1650 € bruto/mes</li></ul>' +
      '<p><strong>Sobre la empresa</strong></p><p>Somos una empresa de logística con almacén en Getafe.</p>',
    )
    // Una sola línea es un párrafo, no una lista de uno.
    const una = descripcionHtml({ ...PUESTO, company_description: null, location: null, provincia: null }, leerAnuncio({ descripcion: 'Turno de tarde' }))
    expect(una).toBe('<p>Turno de tarde</p>')
  })

  it('sin salario no hay baseSalary; sin ubicación, solo el país; sin experiencia ni estudios, nada', () => {
    const jd = jobPosting({
      ...PUESTO, location: '', provincia: null, sector: null,
      anuncio: { descripcion: 'Se busca gente', contrato: 'Indefinido' },
    }, CTX)!
    expect(jd.baseSalary).toBeUndefined()
    expect(jd.employmentType).toBeUndefined()
    expect(jd.industry).toBeUndefined()
    expect(jd.experienceRequirements).toBeUndefined()
    expect(jd.educationRequirements).toBeUndefined()
    expect(jd.skills).toBeUndefined()
    expect((jd.jobLocation as { address: Record<string, string> }).address).toEqual({ '@type': 'PostalAddress', addressCountry: 'ES' })
  })

  it('sin experiencia se dice con cero meses; formativo y parcial se traducen', () => {
    const jd = jobPosting({
      ...PUESTO,
      anuncio: { ...(PUESTO.anuncio as object), experiencia: 'Sin experiencia', contrato: 'Formativo', jornada: 'Parcial', salarioPeriodo: 'hora', salarioMin: 12, salarioMax: null },
    }, CTX)!
    expect(jd.experienceRequirements).toEqual({ '@type': 'OccupationalExperienceRequirements', monthsOfExperience: 0 })
    expect(jd.employmentType).toEqual(['PART_TIME', 'INTERN'])
    expect(jd.baseSalary).toEqual({
      '@type': 'MonetaryAmount', currency: 'EUR', value: { '@type': 'QuantitativeValue', unitText: 'HOUR', value: 12 },
    })
  })

  it('la provincia pasa por la aduana y se escribe una vez si es la ciudad', () => {
    const rara = jobPosting({ ...PUESTO, provincia: 'Narnia' }, CTX)!
    expect((rara.jobLocation as { address: Record<string, string> }).address.addressRegion).toBeUndefined()
    const c = cabeceraPuesto({ ...PUESTO, location: 'Valencia', provincia: 'Valencia' }, CTX)
    expect(c.title).toBe('Mozo/a de almacén en Valencia · Logística Sur')
    expect(c.description.startsWith('Valencia · Presencial')).toBe(true)
    const soloProv = cabeceraPuesto({ ...PUESTO, location: '', provincia: 'Madrid' }, CTX)
    expect(soloProv.title).toBe('Mozo/a de almacén en Madrid · Logística Sur')
  })

  it('teletrabajo: TELECOMMUTE y desde dónde se puede optar', () => {
    const jd = jobPosting({ ...PUESTO, anuncio: { ...(PUESTO.anuncio as object), modalidad: 'teletrabajo' } }, CTX)!
    expect(jd.jobLocationType).toBe('TELECOMMUTE')
    expect(jd.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'España' })
    // La ciudad de la empresa se sigue diciendo si la hay.
    expect(jd.jobLocation).toBeDefined()
    const sinCiudad = jobPosting({ ...PUESTO, location: null, provincia: null, anuncio: { ...(PUESTO.anuncio as object), modalidad: 'teletrabajo' } }, CTX)!
    expect(sinCiudad.jobLocation).toBeUndefined()
  })

  it('la vigencia nunca queda a menos de 30 días del momento en que se sirve', () => {
    // Recién creado: 60 días desde la creación.
    expect(validThrough(new Date('2026-09-01T09:00:00.000Z'), AHORA).toISOString()).toBe('2026-10-31T09:00:00.000Z')
    // Un puesto viejo que sigue abierto: 30 días desde ahora, no una fecha pasada.
    expect(validThrough(new Date('2026-05-01T09:00:00.000Z'), AHORA).toISOString()).toBe('2026-10-07T10:00:00.000Z')
    expect(validThrough(null, AHORA).toISOString()).toBe('2026-10-07T10:00:00.000Z')
  })

  it('el JSON no puede cerrar el script ni romper el documento', () => {
    const jd = jobPosting({
      ...PUESTO,
      anuncio: { ...(PUESTO.anuncio as object), descripcion: 'Fin </script><script>alert(1)</script>' },
    }, CTX)!
    const txt = jsonLdSeguro(jd)
    expect(txt).not.toContain('</script>')
    expect(txt).not.toContain('<')
    expect(JSON.parse(txt)).toEqual(jd)
    const html = prerenderPublico(shell, PUESTO, CTX)
    expect((html.match(/<\/script>/g) ?? []).length).toBe(2) // el módulo de la SPA y el JSON-LD
  })
})

describe('sitemap', () => {
  it('un <url> por puesto en su URL canónica, y un urlset vacío válido sin filas', () => {
    const xml = sitemapXml([
      { slug: 'k7p2m9x4a1', title: 'Mozo/a de almacén', brand_label: 'Logística Sur', updated_at: '2026-09-01T09:00:00.000Z' },
      { slug: '', updated_at: null },
    ])
    expect(xml).toContain(`<loc>${URL_CANONICA}</loc>`)
    expect(xml).toContain('<lastmod>2026-09-01T09:00:00.000Z</lastmod>')
    expect((xml.match(/<url>/g) ?? []).length).toBe(1)
    expect(sitemapXml([])).toMatch(/<urlset[^>]*>\n<\/urlset>/)
  })
})
