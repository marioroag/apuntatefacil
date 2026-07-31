import { supabase } from './supabase'
import { SEED } from './seed'

// Inserta los puestos y candidatos de ejemplo en la empresa indicada.
// Usa el cliente autenticado: la RLS exige que company_id sea de tu empresa.
export async function seedDemoData(companyId: string): Promise<{ error?: string }> {
  const idMap = new Map<string, string>()

  for (const c of SEED.campaigns) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        company_id: companyId,
        slug: `${c.slug}-${Math.random().toString(36).slice(2, 6)}`,
        title: c.title,
        sector: c.sector,
        location: c.location,
        status: c.status,
        milanuncios_url: c.milanunciosUrl ?? null,
        fields: c.fields,
        branding: c.branding,
      })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'No se pudo crear el puesto demo' }
    idMap.set(c.id, data.id as string)
  }

  const rows = SEED.candidates
    .map((cand) => ({
      campaign_id: idMap.get(cand.campaignId),
      company_id: companyId,
      answers: cand.answers,
      status: cand.status,
      source: cand.source,
      favorito: cand.favorito,
      notes: cand.notes,
      created_at: cand.submittedAt,
    }))
    .filter((r) => r.campaign_id)

  const { error } = await supabase.from('candidates').insert(rows)
  if (error) return { error: error.message }
  return {}
}
