// EL BUZÓN DE LA CSP (auditoría de seguridad, sep 2026).
//
// La Content-Security-Policy de vercel.json no tenía canal de informes, así
// que las dos regresiones que hubo en producción (el visor de CV en gris, dos
// veces) las descubrieron los usuarios. Los navegadores mandan aquí cada
// bloqueo que la política produce, y esto lo deja en el log de la función:
// una línea por informe, con lo que hace falta para saber qué directiva
// bloqueó qué recurso en qué página. Se mira en el panel de Supabase, en los
// logs de esta función.
//
// Sin JWT: lo llama el navegador de cualquier visitante, sin sesión. Por eso
// no escribe en la base (un buzón anónimo que escribe filas es un sitio donde
// meter lo que sea), acota el tamaño del cuerpo y responde siempre 204. Y no
// devuelve CORS: los informes de CSP no lo necesitan.
//
// Acepta los dos formatos: `application/csp-report` (report-uri, el viejo,
// un objeto) y `application/reports+json` (Reporting API, una lista).

const MAX_BYTES = 16 * 1024

type Informe = Record<string, unknown>

function resumen(cuerpo: Informe): string {
  const r = (cuerpo['csp-report'] ?? cuerpo.body ?? cuerpo) as Record<string, unknown>
  const campo = (...claves: string[]) => {
    for (const k of claves) {
      const v = r[k]
      if (typeof v === 'string' && v) return v.slice(0, 300)
    }
    return '-'
  }
  return [
    campo('effective-directive', 'effectiveDirective', 'violated-directive', 'violatedDirective'),
    campo('blocked-uri', 'blockedURL', 'blockedURI'),
    campo('document-uri', 'documentURL', 'documentURI'),
    campo('source-file', 'sourceFile'),
    campo('disposition'),
  ].join(' | ')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  const tamano = Number(req.headers.get('content-length') ?? '0')
  if (tamano > MAX_BYTES) return new Response(null, { status: 413 })
  let texto: string
  try {
    texto = (await req.text()).slice(0, MAX_BYTES)
  } catch {
    return new Response(null, { status: 204 })
  }
  try {
    const cuerpo = JSON.parse(texto) as Informe | Informe[]
    const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo]
    for (const i of lista.slice(0, 20)) console.log('[csp]', resumen(i))
  } catch {
    // Un informe ilegible no es un error nuestro: no hay nada que devolver.
  }
  return new Response(null, { status: 204 })
})
