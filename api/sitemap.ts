// Sitemap de los puestos activos con anuncio, para Google. Solo lo que ya es
// público en la propia página de cada puesto: su enlace. La lista la da el RPC
// anónimo public_jobs_sitemap, que aplica el mismo filtro que decide si una
// página se indexa (activa y con anuncio).
import { sitemapXml, type FilaSitemap } from './_lib/publico.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

export async function GET(): Promise<Response> {
  let filas: FilaSitemap[] = []
  if (SUPABASE_URL && ANON_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/public_jobs_sitemap`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(6000),
      })
      if (res.ok) {
        const data = (await res.json()) as unknown
        if (Array.isArray(data)) filas = data as FilaSitemap[]
      }
    } catch (e) {
      console.error('sitemap: rpc', e)
    }
  }
  return new Response(sitemapXml(filas), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600',
    },
  })
}
