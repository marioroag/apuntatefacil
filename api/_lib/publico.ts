// ============================================================================
// Lo que ven los ROBOTS de la página pública de un puesto (/a/:slug y sus
// variantes /<marca>/<slug>[/<titulo>]).
//
// La SPA sirve el mismo index.html para todo, así que un enlace de puesto
// previsualizaba la landing genérica en WhatsApp y Google for Jobs no podía
// indexar nada. El prerender (api/publico.ts) rellena la CABECERA de ese mismo
// shell por puesto: <title>, description, og:*, twitter:*, canonical, robots y
// un JobPosting de schema.org. El cuerpo no se toca: la SPA se hidrata igual.
//
// Este módulo es PURO a propósito: sin red, sin process.env, sin fs. Lo carga
// la función de Vercel y lo prueba vitest (src/lib/publico.test.ts, su
// guardián). Las reglas que hace cumplir:
//   * Nada inventado: sin salario no hay baseSalary, sin ubicación no hay
//     addressLocality, sin anuncio no hay JobPosting.
//   * Un puesto que no está activo o no tiene anuncio se sirve igual (el
//     enlace ya se repartió) pero lleva noindex.
//   * Un slug que el RPC no conoce (un enlace muerto, un puesto de la demo)
//     también lleva noindex: no hay nada ahí que Google deba guardar.
//   * Lo que entra en el HTML se escapa; lo que entra en el JSON no puede
//     cerrar el <script> (ningún "<" sobrevive).
//
// CÓMO SE ESCRIBE CADA HECHO NO VIVE AQUÍ: se importa de src/lib/anuncio.ts,
// que es la única fuente de "cómo se dice un salario" o "cómo se dice un
// contrato". Es la misma regla que ya obliga a la página del anuncio a leer de
// ahí: el día que cambie una frase, cambia en la pantalla y en el JobPosting a
// la vez. Los dos módulos que se importan son puros (sin DOM ni imports), y el
// guardián lo vigila.
// ============================================================================
import {
  contratoTexto, estudiosTexto, experienciaTexto, hayAnuncio, leerAnuncio, leerProvincia, lugarTexto,
  modalidadLabel, salarioTexto, type Anuncio, type PeriodoSalario,
} from '../../src/lib/anuncio.js'
import { DOMAIN, publicFormPathPretty } from '../../src/lib/brand.js'

/** Origen canónico: el de la marca, no el del preview desde el que se sirva.
 *  Un preview compartido nunca debe ser, a ojos de Google, la dirección de la
 *  oferta. */
export const ORIGEN_PUBLICO = `https://${DOMAIN}`
export const OG_POR_DEFECTO = `${ORIGEN_PUBLICO}/og.png`
export const SITE_NAME = 'apuntatefacil'
/** Google exige una fecha de caducidad aunque el puesto no la tenga: 60 días
 *  desde que se creó, el plazo habitual de los portales. Y como un puesto puede
 *  seguir abierto más allá, la fecha nunca queda a menos de MARGEN_VIGENCIA
 *  días del momento en que se sirve: un JobPosting vencido en una oferta viva
 *  es lo que Google penaliza, y el prerender se sirve fresco cada pocos
 *  minutos, así que la fecha va rodando con él. Cuando el puesto se cierra, el
 *  JobPosting deja de emitirse y la página pasa a noindex, que es lo que Google
 *  pide para una oferta que ya no existe. */
export const DIAS_VIGENCIA = 60
export const MARGEN_VIGENCIA = 30
/** Lo que se dice de un puesto sin descripción. */
export const DESCRIPCION_POR_DEFECTO = 'Apúntate en un minuto, sin CV ni crear cuenta.'
const MAX_DESCRIPCION = 200

export type EstadoPuesto = 'activa' | 'pausada' | 'cerrada'

/** Lo que devuelve el RPC anónimo get_public_campaign. Solo lo que aquí se
 *  usa; el resto (fields, others...) viaja igual y se ignora. `anuncio` llega
 *  como jsonb crudo y pasa por la misma aduana que en la app (leerAnuncio). */
export interface PuestoPublico {
  id: string
  slug: string
  title: string
  status: EstadoPuesto
  sector?: string | null
  location?: string | null
  /** Una de PROVINCIAS o nada; pasa por leerProvincia como en la app. */
  provincia?: string | null
  created_at?: string | null
  anuncio?: unknown
  company_name?: string | null
  company_description?: string | null
  logo_path?: string | null
  banner_path?: string | null
}

export interface ContextoPrerender {
  /** Origen público, sin barra final. */
  origen?: string
  /** URL del proyecto de Supabase, para resolver las rutas del bucket público
   *  brand-assets. Sin ella, los assets del bucket no se pueden enseñar y se
   *  cae a la imagen por defecto. */
  supabaseUrl?: string
  /** "Ahora", para la vigencia. Inyectable en los tests. */
  ahora?: Date
}

export interface Cabecera {
  title: string
  description: string
  image: string
  /** true si la imagen es un banner (apaisado): twitter:card summary_large_image.
   *  Con un logo se pide la tarjeta pequeña, que no lo estira. */
  imagenGrande: boolean
  /** URL canónica del puesto: la legible, con marca, slug y título, que es la
   *  que la SPA pone en la barra y la que la gente copia. */
  url: string
  /** false = lleva <meta name="robots" content="noindex">. */
  indexable: boolean
  jsonLd: Record<string, unknown> | null
}

// ----------------------------------------------------------------------------
// Texto
// ----------------------------------------------------------------------------

const limpiar = (s: unknown): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

/** "Getafe, Madrid", con la misma regla que la página (una sola vez si coinciden). */
const lugar = (p: { location?: string | null; provincia?: string | null }): string =>
  lugarTexto(limpiar(p.location), leerProvincia(p.provincia))

/** Recorta a `max` caracteres sin partir una palabra; si corta, lo dice con "…". */
export function recortar(s: string, max = MAX_DESCRIPCION): string {
  if (s.length <= max) return s
  const corte = s.lastIndexOf(' ', max - 1)
  return `${s.slice(0, corte > max / 2 ? corte : max - 1).replace(/[\s,;:.]+$/, '')}…`
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function escapeXml(s: string): string {
  return escapeHtml(s).replace(/'/g, '&apos;')
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ----------------------------------------------------------------------------
// Assets de marca
// ----------------------------------------------------------------------------

/** URL absoluta de un logo/banner. El RPC devuelve rutas del bucket público
 *  brand-assets; una URL absoluta o una ruta de /public (la demo) se respetan.
 *  Una data URL no vale como og:image (los rastreadores no la cargan): null. */
export function urlAsset(path: string | null | undefined, ctx: ContextoPrerender): string | null {
  if (!path) return null
  if (path.startsWith('data:')) return null
  if (path.startsWith('http')) return path
  if (path.startsWith('/')) return `${ctx.origen ?? ORIGEN_PUBLICO}${path}`
  const base = ctx.supabaseUrl?.replace(/\/+$/, '')
  if (!base) return null
  return `${base}/storage/v1/object/public/brand-assets/${encodeURI(path)}`
}

// ----------------------------------------------------------------------------
// Fechas
// ----------------------------------------------------------------------------

function fecha(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const DIA = 86_400_000

/** Hasta cuándo vale el JobPosting: ver DIAS_VIGENCIA y MARGEN_VIGENCIA. */
export function validThrough(creado: Date | null, ahora: Date): Date {
  const suelo = new Date(ahora.getTime() + MARGEN_VIGENCIA * DIA)
  if (!creado) return suelo
  const natural = new Date(creado.getTime() + DIAS_VIGENCIA * DIA)
  return natural.getTime() > suelo.getTime() ? natural : suelo
}

// ----------------------------------------------------------------------------
// El anuncio, leído con la aduana de la app
// ----------------------------------------------------------------------------

/** El anuncio del puesto, o null si no tiene (los puestos anteriores a ago
 *  2026, cuyo enlace abre el formulario a secas). Misma pregunta que la SPA. */
export function anuncioDe(p: PuestoPublico): Anuncio | null {
  const a = leerAnuncio(p.anuncio)
  return hayAnuncio(a) ? a : null
}

/** El anuncio, como HTML para el JobPosting: la descripción como se escribió
 *  (varias líneas son una lista, una sola un párrafo, igual que la página),
 *  y detrás lo que se pide y lo que se ofrece, con las mismas frases que la
 *  página. Google quiere aquí la oferta entera, no un resumen. */
export function descripcionHtml(p: PuestoPublico, a: Anuncio): string {
  const partes: string[] = []
  const lineas = a.descripcion.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lineas.length === 1) partes.push(`<p>${escapeHtml(lineas[0])}</p>`)
  else if (lineas.length > 1) partes.push(`<ul>${lineas.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`)

  const requisitos = [
    experienciaTexto(a),
    a.estudios ? `Estudios mínimos: ${estudiosTexto(a).toLowerCase()}` : '',
    ...a.idiomas.map((i) => (i.nivel ? `${i.idioma}: ${i.nivel.toLowerCase()}` : i.idioma)),
    a.conocimientos.length ? `Conocimientos: ${a.conocimientos.join(', ')}` : '',
  ].filter(Boolean)
  if (requisitos.length) {
    partes.push(`<p><strong>Requisitos</strong></p><ul>${requisitos.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`)
  }

  const condiciones = [
    lugar(p) ? `Ubicación: ${lugar(p)}` : '',
    modalidadLabel(a) ? `Modalidad: ${modalidadLabel(a).toLowerCase()}` : '',
    contratoTexto(a),
    salarioTexto(a) ? `Salario: ${salarioTexto(a)}` : '',
  ].filter(Boolean)
  if (condiciones.length) {
    partes.push(`<p><strong>Condiciones</strong></p><ul>${condiciones.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`)
  }

  const empresa = limpiar(p.company_description)
  if (empresa) partes.push(`<p><strong>Sobre la empresa</strong></p><p>${escapeHtml(empresa)}</p>`)
  return partes.join('')
}

// ----------------------------------------------------------------------------
// JobPosting (schema.org), solo con lo que el puesto dice de verdad
// ----------------------------------------------------------------------------

const UNIDAD_SALARIO: Record<PeriodoSalario, string> = { año: 'YEAR', mes: 'MONTH', hora: 'HOUR' }

/** Los valores que entiende Google. Contrato y jornada son dos ejes y aquí se
 *  funden en uno: la jornada dice FULL/PART_TIME y el contrato añade si es
 *  temporal o formativo. Un indefinido no añade nada, porque lo que Google
 *  llama FULL_TIME ya lo describe. */
export function employmentType(a: Anuncio): string[] {
  const out: string[] = []
  if (a.jornada === 'Completa') out.push('FULL_TIME')
  if (a.jornada === 'Parcial') out.push('PART_TIME')
  if (a.contrato === 'Temporal' || a.contrato === 'Fijo discontinuo') out.push('TEMPORARY')
  if (a.contrato === 'Formativo') out.push('INTERN')
  return out
}

export function baseSalary(a: Anuncio): Record<string, unknown> | null {
  const min = a.salarioMin != null && a.salarioMin > 0 ? a.salarioMin : null
  const max = a.salarioMax != null && a.salarioMax > 0 ? a.salarioMax : null
  if (!min && !max) return null
  const value: Record<string, unknown> = { '@type': 'QuantitativeValue', unitText: UNIDAD_SALARIO[a.salarioPeriodo] }
  if (min && max && min !== max) {
    value.minValue = Math.min(min, max)
    value.maxValue = Math.max(min, max)
  } else {
    value.value = min ?? max
  }
  return { '@type': 'MonetaryAmount', currency: 'EUR', value }
}

/** Meses mínimos de experiencia, en los términos de Google. "Sin experiencia"
 *  se dice con un 0, que para Google significa que no se pide; "menos de un
 *  año" no fija un mínimo y se queda sin decir. */
const MESES_EXPERIENCIA: Record<string, number> = {
  'Sin experiencia': 0,
  'De 1 a 2 años': 12,
  'De 2 a 5 años': 24,
  'Más de 5 años': 60,
}

/** Las categorías que admite Google, y a cuál cae cada nivel español. Es una
 *  aproximación declarada: la ESO y el bachillerato son "high school" (no hay
 *  peldaño más bajo), el grado medio es un certificado profesional y el grado
 *  superior el equivalente a un "associate degree". Sin estudios mínimos no se
 *  escribe nada. */
const CATEGORIA_ESTUDIOS: Record<string, string> = {
  'Educación Secundaria Obligatoria': 'high school',
  'Bachillerato': 'high school',
  'Ciclo Formativo de Grado Medio': 'professional certificate',
  'Ciclo Formativo de Grado Superior': 'associate degree',
  'Grado universitario': 'bachelor degree',
  'Máster': 'postgraduate degree',
  'Doctorado': 'postgraduate degree',
}

/** El JobPosting del puesto, o null si no toca (sin anuncio o puesto no
 *  activo). Cada campo sale de un dato real; lo que no consta no se escribe. */
export function jobPosting(p: PuestoPublico, ctx: ContextoPrerender = {}): Record<string, unknown> | null {
  const a = anuncioDe(p)
  if (!a || p.status !== 'activa') return null
  const ahora = ctx.ahora ?? new Date()
  const empresa = limpiar(p.company_name)
  const creado = fecha(p.created_at)

  const out: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: limpiar(p.title),
    description: descripcionHtml(p, a),
  }
  if (creado) out.datePosted = creado.toISOString()
  out.validThrough = validThrough(creado, ahora).toISOString()
  if (empresa) {
    const org: Record<string, unknown> = { '@type': 'Organization', name: empresa }
    const logo = urlAsset(p.logo_path, ctx)
    if (logo) org.logo = logo
    out.hiringOrganization = org
  }
  const sector = limpiar(p.sector)
  if (sector) out.industry = sector

  // Dónde. Con teletrabajo, lo que Google pide es el tipo y desde dónde se
  // puede optar (España); la ciudad, si la hay, sigue siendo la de la empresa
  // y se escribe también.
  const ubicacion = limpiar(p.location)
  const provincia = leerProvincia(p.provincia)
  if (ubicacion || provincia || a.modalidad !== 'teletrabajo') {
    const address: Record<string, unknown> = { '@type': 'PostalAddress' }
    if (ubicacion) address.addressLocality = ubicacion
    if (provincia) address.addressRegion = provincia
    address.addressCountry = 'ES'
    out.jobLocation = { '@type': 'Place', address }
  }
  if (a.modalidad === 'teletrabajo') {
    out.jobLocationType = 'TELECOMMUTE'
    out.applicantLocationRequirements = { '@type': 'Country', name: 'España' }
  }

  const tipos = employmentType(a)
  if (tipos.length === 1) out.employmentType = tipos[0]
  else if (tipos.length > 1) out.employmentType = tipos
  const salario = baseSalary(a)
  if (salario) out.baseSalary = salario

  const meses = MESES_EXPERIENCIA[a.experiencia]
  if (meses != null) out.experienceRequirements = { '@type': 'OccupationalExperienceRequirements', monthsOfExperience: meses }
  const categoria = CATEGORIA_ESTUDIOS[a.estudios]
  if (categoria) out.educationRequirements = { '@type': 'EducationalOccupationalCredential', credentialCategory: categoria }
  if (a.conocimientos.length) out.skills = a.conocimientos.join(', ')
  if (a.idiomas.length) out.qualifications = a.idiomas.map((i) => (i.nivel ? `${i.idioma} (${i.nivel.toLowerCase()})` : i.idioma)).join(', ')

  if (empresa) out.identifier = { '@type': 'PropertyValue', name: empresa, value: p.id }
  // La candidatura se hace en la propia página, sin cuenta ni registro: es lo
  // que Google llama "direct apply" y lo que este producto es.
  out.directApply = true
  out.url = urlPuesto(p, ctx)
  return out
}

/** JSON para un <script type="application/ld+json">: ningún "<" sobrevive, así
 *  que ni "</script>" ni "<!--" pueden romper el documento. */
export function jsonLdSeguro(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

// ----------------------------------------------------------------------------
// Cabecera
// ----------------------------------------------------------------------------

/** La URL canónica del puesto: la misma que la SPA pone en la barra. */
export function urlPuesto(p: { slug: string; company_name?: string | null; title?: string | null }, ctx: ContextoPrerender = {}): string {
  return `${ctx.origen ?? ORIGEN_PUBLICO}${publicFormPathPretty(p.slug, p.company_name, p.title)}`
}

/** El <title>: el puesto, dónde, y de quién. "Mozo/a de almacén en Getafe ·
 *  Logística Sur" es lo que alguien busca y lo que distingue esta oferta de
 *  las demás con el mismo nombre. */
export function tituloPagina(p: PuestoPublico): string {
  const titulo = limpiar(p.title) || 'Oferta de empleo'
  const donde = limpiar(p.location) || leerProvincia(p.provincia)
  const empresa = limpiar(p.company_name)
  return `${titulo}${donde ? ` en ${donde}` : ''}${empresa ? ` · ${empresa}` : ''}`
}

/** La descripción: primero los hechos que descartan (dónde, cómo, cuánto, qué
 *  contrato), que es lo que se mira antes de pinchar, y detrás la descripción
 *  del puesto hasta donde quepa. Sin anuncio, el párrafo de la empresa; sin
 *  nada, la promesa del producto. */
export function descripcionPagina(p: PuestoPublico, a: Anuncio | null): string {
  if (!a) return recortar(limpiar(p.company_description) || DESCRIPCION_POR_DEFECTO)
  const hechos = [
    lugar(p),
    modalidadLabel(a),
    salarioTexto(a),
    contratoTexto(a),
  ].filter(Boolean).join(' · ')
  const cuerpo = limpiar(a.descripcion) || limpiar(p.company_description)
  return recortar([hechos, cuerpo].filter(Boolean).join('. '))
}

export function cabeceraPuesto(p: PuestoPublico, ctx: ContextoPrerender = {}): Cabecera {
  const a = anuncioDe(p)
  const banner = urlAsset(p.banner_path, ctx)
  const logo = banner ? null : urlAsset(p.logo_path, ctx)
  const image = banner ?? logo ?? OG_POR_DEFECTO
  return {
    title: tituloPagina(p),
    description: descripcionPagina(p, a),
    image,
    imagenGrande: !logo,
    url: urlPuesto(p, ctx),
    indexable: p.status === 'activa' && !!a,
    jsonLd: jobPosting(p, ctx),
  }
}

// ----------------------------------------------------------------------------
// Inyección en el shell
// ----------------------------------------------------------------------------

/** Sustituye (o añade antes de </head>) una <meta> por su `name` o `property`.
 *  Tolera cualquier orden de atributos y comillas simples o dobles. */
function ponMeta(html: string, attr: 'name' | 'property', nombre: string, content: string): string {
  const tag = `<meta ${attr}="${nombre}" content="${escapeHtml(content)}" />`
  const re = new RegExp(`<meta\\s+(?=[^>]*\\b${attr}=["']${escapeRegExp(nombre)}["'])[^>]*>`, 'i')
  return re.test(html) ? html.replace(re, tag) : antesDeHead(html, tag)
}

function quitaMeta(html: string, attr: 'name' | 'property', nombre: string): string {
  const re = new RegExp(`[ \\t]*<meta\\s+(?=[^>]*\\b${attr}=["']${escapeRegExp(nombre)}["'])[^>]*>[ \\t]*\\r?\\n?`, 'gi')
  return html.replace(re, '')
}

function ponTitle(html: string, title: string): string {
  const tag = `<title>${escapeHtml(title)}</title>`
  return /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, tag)
    : antesDeHead(html, tag)
}

function antesDeHead(html: string, ...tags: string[]): string {
  return html.replace(/[ \t]*<\/head>/i, `${tags.map((t) => `    ${t}`).join('\n')}\n  </head>`)
}

const NOINDEX = '<meta name="robots" content="noindex" />'

/** El shell con la cabecera del puesto. Sin puesto (un enlace muerto o uno de
 *  la demo, que no está en la base), el shell tal cual más un noindex: la SPA
 *  pinta lo suyo, y Google no guarda una página que no existe. */
export function prerenderPublico(shell: string, p: PuestoPublico | null, ctx: ContextoPrerender = {}): string {
  if (!/<\/head>/i.test(shell)) return shell
  if (!p) return antesDeHead(shell, NOINDEX)
  const c = cabeceraPuesto(p, ctx)
  let html = shell
  html = ponTitle(html, c.title)
  html = ponMeta(html, 'name', 'description', c.description)
  html = ponMeta(html, 'property', 'og:type', 'website')
  html = ponMeta(html, 'property', 'og:site_name', SITE_NAME)
  html = ponMeta(html, 'property', 'og:locale', 'es_ES')
  html = ponMeta(html, 'property', 'og:url', c.url)
  html = ponMeta(html, 'property', 'og:title', c.title)
  html = ponMeta(html, 'property', 'og:description', c.description)
  html = ponMeta(html, 'property', 'og:image', c.image)
  if (c.image !== OG_POR_DEFECTO) {
    // Las medidas del shell son las de og.png; de la imagen del cliente no se
    // sabe nada, y mejor callar que mentir.
    html = quitaMeta(html, 'property', 'og:image:width')
    html = quitaMeta(html, 'property', 'og:image:height')
  }
  html = ponMeta(html, 'name', 'twitter:card', c.imagenGrande ? 'summary_large_image' : 'summary')
  html = ponMeta(html, 'name', 'twitter:title', c.title)
  html = ponMeta(html, 'name', 'twitter:description', c.description)
  html = ponMeta(html, 'name', 'twitter:image', c.image)

  const extra: string[] = [`<link rel="canonical" href="${escapeHtml(c.url)}" />`]
  if (!c.indexable) extra.push(NOINDEX)
  if (c.jsonLd) extra.push(`<script type="application/ld+json">${jsonLdSeguro(c.jsonLd)}</script>`)
  return antesDeHead(html, ...extra)
}

// ----------------------------------------------------------------------------
// Sitemap
// ----------------------------------------------------------------------------

/** Lo que devuelve el RPC public_jobs_sitemap: un puesto activo con anuncio.
 *  `updated_at` es opcional y hoy el RPC no lo manda: no guardamos cuándo se
 *  tocó un anuncio, y un lastmod que no es verdad Google lo ignora en el mejor
 *  caso. Se emite solo si algún día se sabe. */
export interface FilaSitemap {
  slug: string
  title?: string | null
  brand_label?: string | null
  updated_at?: string | null
}

/** <urlset> con un <url> por puesto activo con anuncio (lo filtra el RPC), en
 *  su URL canónica. Sin filas, un urlset vacío y válido. */
export function sitemapXml(filas: FilaSitemap[], origen: string = ORIGEN_PUBLICO): string {
  const urls = filas
    .filter((f) => typeof f.slug === 'string' && f.slug.length > 0)
    .map((f) => {
      const loc = urlPuesto({ slug: f.slug, company_name: f.brand_label, title: f.title }, { origen })
      const mod = fecha(f.updated_at)
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>${mod ? `\n    <lastmod>${mod.toISOString()}</lastmod>` : ''}\n  </url>`
    })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}${urls.length ? '\n' : ''}</urlset>\n`
}
