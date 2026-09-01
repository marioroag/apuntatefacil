import { describe, expect, it } from 'vitest'

/**
 * EL GUARDIÁN DE LOS DOCUMENTOS DE UN CANDIDATO.
 *
 * Los ficheros de una candidatura viven en DOS sitios desde ago 2026: el primero
 * en `candidates.cv_path` (es el que lee Meridian y el que exporta el ZIP) y los
 * demás en `candidate_documents`. Los dos guardan su ruta en el MISMO bucket
 * privado, `cvs`, cuya política de lectura deriva la visibilidad de la FILA que
 * referencia el fichero.
 *
 * Ahí está la trampa, y ya cobró una vez: `candidate_documents` se creó sin
 * ampliar esa política, así que todo documento que no fuera el CV quedaba fuera
 * de la única condición que la policy sabía comprobar. Medido contra el stack
 * local, firmar el segundo fichero de una candidatura devolvía
 * `404 Object not found`, y con él caían el visor y la descarga de la ficha,
 * incluidos los documentos que acababa de subir el propio equipo.
 *
 * Y hay una segunda trampa que es peor, porque el arreglo fácil la abre: acotar
 * por `current_user_company_ids()`, que es lo que ya usaban las filas de la
 * tabla. Ese gate cuenta CUALQUIER membresía, así que un ENCARGADO (que solo ve
 * los puestos de sus sedes) pasaría a ver documentos de candidatos que no puede
 * ni listar. Comprobado en local: con el gate por empresa veía cero candidatos y
 * las cuatro filas de sus documentos.
 *
 * Esta prueba no necesita datos para verlo: lee las migraciones en orden y mira
 * la ÚLTIMA declaración de cada política.
 */

const MIGRACIONES = import.meta.glob('../../supabase/migrations/*.sql', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

/** El cuerpo de la última declaración de una policy, sin sus comentarios. */
function ultimaPolicy(nombre: string): { fichero: string; cuerpo: string } | null {
  const re = new RegExp(`create policy "${nombre}"[\\s\\S]*?;`, 'g')
  let out: { fichero: string; cuerpo: string } | null = null
  for (const ruta of Object.keys(MIGRACIONES).sort()) {
    for (const m of MIGRACIONES[ruta].matchAll(re)) {
      // Fuera los comentarios antes de leer nada, o una tabla nombrada dentro de
      // una explicación contaría como declarada.
      const cuerpo = m[0].split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
      out = { fichero: ruta.split('/').pop() ?? ruta, cuerpo }
    }
  }
  return out
}

describe('los documentos de un candidato', () => {
  it('hay políticas que leer', () => {
    expect(ultimaPolicy('cvs_select_visible'), 'no se encuentra cvs_select_visible').not.toBeNull()
    expect(ultimaPolicy('candidate_documents_select'), 'no se encuentra candidate_documents_select').not.toBeNull()
  })

  it('el bucket deja leer los dos sitios donde se guarda una ruta', () => {
    const p = ultimaPolicy('cvs_select_visible')!
    expect(
      p.cuerpo,
      `${p.fichero}: la política del bucket no mira \`candidates.cv_path\`. Sin eso no se abre ningún CV.`,
    ).toMatch(/candidates[\s\S]*cv_path|cv_path[\s\S]*candidates/)
    expect(
      p.cuerpo,
      `${p.fichero}: la política del bucket no mira \`candidate_documents\`. Todo documento que no sea el CV se queda sin abrir: el visor y la descarga devuelven 404. Si añades otra tabla que guarde una ruta del bucket \`cvs\`, va aquí también.`,
    ).toContain('candidate_documents')
  })

  it('nada que dé acceso a un documento se acota por EMPRESA', () => {
    for (const nombre of ['cvs_select_visible', 'candidate_documents_select', 'candidate_documents_insert', 'candidate_documents_delete']) {
      const p = ultimaPolicy(nombre)
      if (!p) continue
      expect(
        p.cuerpo,
        `${p.fichero}: \`${nombre}\` se acota con current_user_company_ids(), que cuenta cualquier membresía. Un ENCARGADO ve solo los puestos de sus sedes, así que por ahí le llegan documentos de candidatos que no puede ni listar. El gate es current_user_campaign_ids(), a través del candidato del que cuelga el documento.`,
      ).not.toMatch(/using[\s\S]*current_user_company_ids/)
      expect(
        p.cuerpo,
        `${p.fichero}: \`${nombre}\` no se acota por puesto. La visibilidad se deriva de la FILA, no del prefijo del nombre ni de la empresa.`,
      ).toContain('current_user_campaign_ids')
    }
  })
})
