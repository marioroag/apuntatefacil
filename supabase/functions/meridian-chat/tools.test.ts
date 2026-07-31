// Herramientas de Meridian: lo que el modelo puede leer y en qué forma.
// Se ejecuta con: deno test supabase/functions/meridian-chat/tools.test.ts
import { assertEquals, assertFalse } from 'jsr:@std/assert@1'
import {
  buscarCandidatos, estadisticas, estadoEnvios, verCandidato,
  type CampaignRow, type CandidateRow, type ToolContext,
} from './tools.ts'

const campaign: CampaignRow = {
  id: 'c1', title: 'Peón de albañil', sector: 'construccion', location: 'Las Palmas', status: 'activa',
  fields: [
    { id: 'nombre', label: 'Nombre y apellidos', type: 'text' },
    { id: 'email', label: 'Email', type: 'email' },
    { id: 'tel', label: 'Teléfono', type: 'phone' },
    { id: 'carnet', label: 'Carnet de conducir', type: 'select', options: ['Sí', 'No'] },
    { id: 'exp', label: 'Años de experiencia', type: 'number' },
  ],
}

const dias = (n: number) => new Date(Date.now() - n * 86400000).toISOString()

function candidate(patch: Partial<CandidateRow> & { id: string }): CandidateRow {
  return {
    campaign_id: 'c1',
    answers: { nombre: `Nombre ${patch.id}`, email: `${patch.id}@ejemplo.com`, tel: '600111222', carnet: 'Sí', exp: '6' },
    status: 'nuevo', favorito: false, notes: null, ai: null, created_at: dias(1),
    ...patch,
  }
}

const ctx = (candidates: CandidateRow[], rpc?: ToolContext['userClient']): ToolContext => ({
  userClient: rpc ?? { rpc: () => Promise.resolve({ data: [], error: null }) },
  companyId: 'empresa-1',
  campaigns: [campaign],
  candidates,
})

Deno.test('buscar: filtra por respuesta del formulario', () => {
  const c = ctx([
    candidate({ id: 'a', answers: { nombre: 'Ana', carnet: 'Sí', exp: '6' } }),
    candidate({ id: 'b', answers: { nombre: 'Beto', carnet: 'No', exp: '9' } }),
  ])
  const r = buscarCandidatos(c, { filtros: [{ campo_id: 'carnet', valores: ['Sí'] }] })
  assertEquals(r.total, 1)
  assertEquals(r.mostrados[0].nombre, 'Ana')
})

Deno.test('buscar: filtra por rango numérico', () => {
  const c = ctx([
    candidate({ id: 'a', answers: { nombre: 'Ana', exp: '6' } }),
    candidate({ id: 'b', answers: { nombre: 'Beto', exp: '2' } }),
  ])
  assertEquals(buscarCandidatos(c, { filtros_numero: [{ campo_id: 'exp', min: 5, max: null }] }).total, 1)
})

Deno.test('buscar: ordena por ajuste y etiqueta en cualitativo', () => {
  const c = ctx([
    candidate({ id: 'flojo', ai: { fit: 30 } }),
    candidate({ id: 'bueno', ai: { fit: 82 } }),
    candidate({ id: 'medio', ai: { fit: 55 } }),
  ])
  const r = buscarCandidatos(c, {})
  assertEquals(r.mostrados.map((x) => x.id), ['bueno', 'medio', 'flojo'])
  assertEquals(r.mostrados.map((x) => x.etiqueta), ['Encaja bien', 'Puede encajar', 'A valorar'])
})

Deno.test('buscar: un análisis con error no cuenta como ajuste', () => {
  const r = buscarCandidatos(ctx([candidate({ id: 'a', ai: { fit: 90, error: 'fallo' } })]), {})
  assertEquals(r.mostrados[0].ajuste, null)
  assertEquals(r.mostrados[0].etiqueta, 'Sin analizar')
})

Deno.test('buscar: solo_con_correo aparta a quien no dejó email', () => {
  const c = ctx([
    candidate({ id: 'con', answers: { nombre: 'Con', email: 'con@ejemplo.com' } }),
    candidate({ id: 'sin', answers: { nombre: 'Sin' } }),
    candidate({ id: 'malo', answers: { nombre: 'Malo', email: 'no-es-un-email' } }),
  ])
  assertEquals(buscarCandidatos(c, { solo_con_correo: true }).mostrados.map((x) => x.id), ['con'])
})

Deno.test('buscar: el tope de filas es duro (máximo 25)', () => {
  const many = Array.from({ length: 40 }, (_, i) => candidate({ id: `c${i}` }))
  const r = buscarCandidatos(ctx(many), { limite: 999 })
  assertEquals(r.total, 40)
  assertEquals(r.mostrados.length, 25)
})

// El punto importante de RGPD: correos, teléfonos y adjuntos no salen de aquí.
Deno.test('ver_candidato: nunca devuelve datos de contacto', () => {
  const c = ctx([candidate({ id: 'a' })])
  const ficha = verCandidato(c, { id: 'a' })
  const serializado = JSON.stringify(ficha)
  assertFalse(serializado.includes('a@ejemplo.com'))
  assertFalse(serializado.includes('600111222'))
  // Pero sí sabe que tiene correo, que es lo que necesita para proponer escribirle.
  assertEquals((ficha as { tiene_correo: boolean }).tiene_correo, true)
  const campos = (ficha as { respuestas: { campo: string }[] }).respuestas.map((r) => r.campo)
  assertEquals(campos.includes('Email'), false)
  assertEquals(campos.includes('Teléfono'), false)
  assertEquals(campos.includes('Carnet de conducir'), true)
})

Deno.test('ver_candidato: id inexistente no revienta', () => {
  assertEquals(verCandidato(ctx([]), { id: 'no-existe' }), { error: 'No encuentro esa candidatura.' })
})

Deno.test('estadisticas: cuenta destacados sin contactar', () => {
  const c = ctx([
    candidate({ id: 'a', ai: { fit: 82 }, status: 'nuevo', created_at: dias(4) }),
    candidate({ id: 'b', ai: { fit: 80 }, status: 'nuevo', created_at: dias(0) }), // recién llegado
    candidate({ id: 'c', ai: { fit: 90 }, status: 'contactado', created_at: dias(9) }),
    candidate({ id: 'd', status: 'nuevo' }), // sin analizar
  ])
  const s = estadisticas(c, {})
  assertEquals(s.total, 4)
  assertEquals(s.analizados, 3)
  assertEquals(s.encajan_bien, 3)
  assertEquals(s.encajan_bien_sin_contactar, 1)
  assertEquals(s.por_estado.nuevo, 3)
})

Deno.test('estado_envios: agrupa por lote y solo cuenta lo visible', async () => {
  const rows = [
    { candidate_id: 'a', batch_id: 'b1', response: 'interested', sent_at: dias(3) },
    { candidate_id: 'b', batch_id: 'b1', response: null, sent_at: dias(3) },
    // Candidatura que esta persona NO ve: no puede colarse en el recuento.
    { candidate_id: 'oculto', batch_id: 'b1', response: 'interested', sent_at: dias(3) },
  ]
  const c = ctx([candidate({ id: 'a' }), candidate({ id: 'b' })], {
    rpc: () => Promise.resolve({ data: rows, error: null }),
  })
  const r = await estadoEnvios(c) as { envios: { enviados: number; respondieron: number }[] }
  assertEquals(r.envios.length, 1)
  assertEquals(r.envios[0].enviados, 2)
  assertEquals(r.envios[0].respondieron, 1)
})
