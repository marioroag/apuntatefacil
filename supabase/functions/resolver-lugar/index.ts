// De un enlace de Google Maps a un punto (latitud y longitud).
//
// POR QUÉ EXISTE ESTO. El pin de WhatsApp, el que abre el mapa dentro del chat,
// exige coordenadas. Hay tres formas de conseguirlas y solo una es aceptable
// aquí:
//
//   * Geocodificar la dirección con la API de Google -> clave de pago, coste
//     por consulta y un SUBENCARGADO nuevo que declarar en la política de
//     privacidad. Descartado: la dirección de una empresa no justifica meter a
//     un tercero en el tratamiento.
//   * Un selector de mapa -> necesita un proveedor de teselas, o sea lo mismo.
//   * Que el punto lo dé el cliente. Es lo que hacemos.
//
// El cliente abre su sitio en Google Maps, pulsa "Compartir" y pega lo que le
// dé. Ese enlace ya lleva el punto dentro. Lo único que hace falta es sacarlo,
// y para eso hay que seguir la redirección de los enlaces cortos
// (maps.app.goo.gl), que el navegador no puede leer por CORS. De ahí esta
// función: es un cortador de enlaces, no un servicio de mapas.
//
// SE RESUELVE AL GUARDAR, NO AL ENVIAR. Si el enlace no se puede leer, quien
// tiene que enterarse es quien lo pegó, en ese momento y con el campo delante.
// Resolverlo al mandar el mensaje convertiría un error de configuración en un
// candidato sin ubicación a las nueve de la noche, y sin nadie mirando.
//
// El troceo de las URLs vive en `_shared/interviews/mapa.ts`, que es puro y
// tiene pruebas. Aquí solo queda la parte que habla con la red.

import { createClient } from 'jsr:@supabase/supabase-js@2.116.0'
import { corsHeaders } from '../_shared/cors.ts'
import { PLAZO, plazo } from '../_shared/red.ts'
import {
  coordenadasSueltas, hostPermitido, nombreDe, puntoDe,
} from '../_shared/interviews/mapa.ts'

// `verify_jwt = true` en config.toml solo comprueba la FORMA del token: la anon
// key pública también es un JWT válido para el gateway, y con ella esto era un
// seguidor de redirecciones abierto a Internet. Quién llama se resuelve aquí,
// como en las demás funciones con sesión (auditoría, sep 2026).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

/**
 * Sigue las redirecciones A MANO (`redirect: 'manual'`) para poder comprobar
 * CADA salto contra la lista blanca. Con 'follow' solo se vería el destino
 * final, y para entonces las peticiones intermedias ya se habrían hecho.
 */
async function resolver(inicial: string): Promise<string> {
  let actual = inicial
  for (let i = 0; i < 5; i++) {
    if (!hostPermitido(actual)) return actual
    // Si ya lleva el punto dentro, no hay nada que pedir.
    if (puntoDe(actual)) return actual

    let res: Response
    try {
      res = await fetch(actual, {
        signal: plazo(PLAZO.api),
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; ApuntateFacil/1.0)' },
      })
    } catch {
      return actual
    }

    const siguiente = res.headers.get('location')
    if (!siguiente) {
      // Los enlaces cortos de Google a veces contestan 200 con la redirección
      // metida en el HTML en vez de en la cabecera.
      if (res.status !== 200) return actual
      const html = await res.text().catch(() => '')
      const m = html.match(/https:\/\/www\.google\.[a-z.]+\/maps\/[^"'\s\\]+/)
      return m ? m[0].replace(/&amp;/g, '&') : actual
    }
    try {
      actual = new URL(siguiente, actual).toString()
    } catch {
      return actual
    }
    if (puntoDe(actual)) return actual
  }
  return actual
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Siempre 200, con el fallo dentro. Que un enlace no se entienda no es un
  // error de protocolo: es el resultado normal de validar un campo, igual que
  // las RPC de este proyecto devuelven {status:'ocupado'} en vez de reventar. Y
  // así el cliente lee `data.error` en vez de destripar un FunctionsHttpError.
  const responder = (cuerpo: unknown) =>
    new Response(JSON.stringify(cuerpo), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt || !ANON_KEY) return new Response('No autorizado', { status: 401, headers: corsHeaders })
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const { data: auth } = await userClient.auth.getUser(jwt)
  if (!auth?.user?.id) return new Response('No autorizado', { status: 401, headers: corsHeaders })

  let entrada: { url?: string }
  try { entrada = await req.json() } catch { return responder({ error: 'json' }) }

  const bruto = (entrada.url ?? '').trim()
  if (!bruto) return responder({ error: 'vacio' })
  if (bruto.length > 2000) return responder({ error: 'largo' })

  const sueltas = coordenadasSueltas(bruto)
  if (sueltas) return responder({ ...sueltas, nombre: null })
  // Parece un par de números pero no es válido: se dice, en vez de mandarlo por
  // el camino de las URLs y contestar "eso no es un enlace", que despista.
  if (/^\s*-?[\d.]+\s*,\s*-?[\d.]+\s*$/.test(bruto)) {
    return responder({ error: 'fuera_de_rango' })
  }

  try { new URL(bruto) } catch { return responder({ error: 'no_es_enlace' }) }
  if (!hostPermitido(bruto)) return responder({ error: 'no_es_de_maps' })

  const final = await resolver(bruto)
  const punto = puntoDe(final)
  if (!punto) return responder({ error: 'sin_punto' })

  return responder({ ...punto, nombre: nombreDe(final) })
})
