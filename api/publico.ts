// Prerender de la página pública de un puesto (/a/:slug y /<marca>/<slug>[/<titulo>]).
//
// La SPA sirve un index.html vacío para todo, así que los robots (WhatsApp,
// LinkedIn, Google for Jobs) veían la landing genérica en cualquier enlace de
// puesto. Esta función sirve el MISMO shell con la cabecera rellena por puesto:
// <title>, description, og:*, twitter:*, canonical, robots y el JobPosting de
// schema.org. El cuerpo no se toca: la SPA se hidrata igual que siempre.
//
// Reglas:
//  * Nunca 404 ni 500 hacia el visitante: si el RPC falla o el puesto no existe,
//    el shell tal cual (la SPA pinta su "no encontrado" o cae a la demo). El
//    enlace ya se repartió por WhatsApp; romperlo sería peor que no
//    prerenderizarlo.
//  * El shell sale del build (dist/index.html, incluido en la función vía
//    `includeFiles` en vercel.json). Si no está, se pide a la propia
//    instalación (/index.html es un estático y no pasa por aquí).
//  * Lo que decide qué se escribe vive en _lib/publico.ts (puro, con su
//    guardián en src/lib/publico.test.ts); aquí solo hay red y cabeceras.
//  * Sin credenciales de Supabase (un preview sin variables) no se pregunta
//    nada y se sirve el shell: la página funciona, solo que sin ficha.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { prerenderPublico, type PuestoPublico } from './_lib/publico.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

/** El shell se lee una vez por instancia: el build no cambia en caliente. */
let shellCache: string | null = null

async function leerShell(req: Request): Promise<string> {
  if (shellCache) return shellCache
  for (const ruta of [join(process.cwd(), 'dist', 'index.html'), join(process.cwd(), 'index.html')]) {
    try {
      const html = await readFile(ruta, 'utf8')
      if (/<div id="root">/.test(html) && /<script type="module"/.test(html)) {
        shellCache = html
        return html
      }
    } catch { /* siguiente */ }
  }
  // Fallback: la propia instalación. `/index.html` es un fichero estático, así
  // que no vuelve a entrar por esta función.
  const res = await fetch(new URL('/index.html', req.url), { headers: { accept: 'text/html' } })
  if (!res.ok) throw new Error(`shell ${res.status}`)
  shellCache = await res.text()
  return shellCache
}

/** El puesto, o `null` con `sabido: true` cuando el RPC ha contestado que NO
 *  existe, que no es lo mismo que no haber podido preguntar: un enlace muerto
 *  se sirve con 404 (es lo que Google necesita para olvidarlo), pero un fallo
 *  de red no puede convertir un anuncio vivo en un 404. */
async function puestoPublico(slug: string): Promise<{ puesto: PuestoPublico | null; sabido: boolean }> {
  if (!SUPABASE_URL || !ANON_KEY) return { puesto: null, sabido: false }
  const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/get_public_campaign`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug }),
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) return { puesto: null, sabido: false }
  const data = (await res.json()) as PuestoPublico | null
  const puesto = data && typeof data === 'object' && typeof data.slug === 'string' ? data : null
  return { puesto, sabido: true }
}

const HTML = {
  'Content-Type': 'text/html; charset=utf-8',
  // Corto en el navegador, cacheado en el borde: un anuncio cambia poco y el
  // rastreador no necesita el último segundo. Y al cerrar un puesto, en cinco
  // minutos su página ya sale con noindex.
  'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const slug = (url.searchParams.get('slug') ?? '').trim()
  let shell: string
  try {
    shell = await leerShell(req)
  } catch (e) {
    console.error('publico: sin shell', e)
    return new Response('', { status: 302, headers: { Location: '/' } })
  }
  if (!slug || !/^[a-z0-9][a-z0-9-]{2,40}$/.test(slug)) return new Response(shell, { headers: HTML })
  let puesto: PuestoPublico | null = null
  let sabido = false
  try {
    ;({ puesto, sabido } = await puestoPublico(slug))
  } catch (e) {
    console.error('publico: rpc', e)
  }
  const html = prerenderPublico(shell, puesto, { supabaseUrl: SUPABASE_URL, ahora: new Date() })
  // Sin puesto y con el RPC contestando, es un enlace muerto: 404 de verdad,
  // con el shell dentro para que la SPA pinte su "no existe" (o la demo, que
  // vive en el navegador y no en la base). Sin respuesta del RPC, 200 y
  // noindex: mejor no decir que no existe lo que no se ha podido comprobar.
  return new Response(html, { status: !puesto && sabido ? 404 : 200, headers: HTML })
}
