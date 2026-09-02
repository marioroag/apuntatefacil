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

const FUENTE = import.meta.glob('../**/*.{ts,tsx}', {
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

/**
 * El fuente SIN comentarios. Hace falta antes de buscar cualquier nombre: un
 * detector que no los quita vigila la PROSA, y aquí ya pasó (los dos de abajo
 * daban verde con el fallo puesto, porque el nombre que buscaban seguía escrito
 * en un comentario que lo explicaba).
 */
function desnudo(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
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

  /**
   * BORRAR SE DERIVA DE LA FILA IGUAL QUE LEER. El bucket estuvo sin política de
   * DELETE, así que las tres llamadas a `remove()` que había en el cliente no
   * borraban nada: contestaban 200 con `[]` (medido), y el `.catch()` de detrás
   * nunca se enteraba. Quien quitaba un documento se quedaba con el fichero
   * dentro del bucket para siempre.
   */
  it('el bucket tiene política de borrado, y con el mismo gate que la de leer', () => {
    const p = ultimaPolicy('cvs_delete_visible')
    expect(p, 'no hay política de DELETE sobre `cvs`: `remove()` devuelve 200 sin borrar nada').not.toBeNull()
    expect(p!.cuerpo, `${p!.fichero}: el borrado no mira \`candidate_documents\``).toContain('candidate_documents')
    expect(p!.cuerpo, `${p!.fichero}: el borrado no mira \`candidates.cv_path\``).toMatch(/candidates[\s\S]*cv_path|cv_path[\s\S]*candidates/)
  })

  /**
   * Y NADIE VUELVE A PROMETER UNA LIMPIEZA QUE NO OCURRE. Un `remove()` sobre
   * `cvs` solo puede borrar lo que tiene fila, así que fuera del store (que borra
   * el fichero ANTES que la fila, por eso funciona) cualquier otra llamada es un
   * no-op con un comentario al lado afirmando lo contrario. Los huérfanos son cosa
   * de un barrido de servidor.
   */
  it('solo el store borra del bucket, y nadie finge limpiar huérfanos', () => {
    const culpables = Object.entries(FUENTE)
      .filter(([r]) => !r.includes('.test.') && !r.endsWith('/store.tsx'))
      .filter(([, src]) => desnudo(src).includes("storage.from('cvs').remove"))
      .map(([r]) => r.replace(/^\.{1,2}\//, 'src/'))
    expect(
      culpables,
      'Un `remove()` sobre `cvs` fuera del store no borra: el permiso se deriva de la FILA, ' +
        'y estos sitios llaman justo cuando la fila no existe. Devuelve 200 con [] y ningún error.',
    ).toEqual([])
  })

  /**
   * LO QUE EL STORE SABE BORRAR TIENE QUIEN SE LO PIDA. Esto ya cobró: la
   * política de DELETE del bucket y `removeCandidateDocument` se escribieron en
   * sep 2026 y **nada en `src/` lo llamaba**, así que un documento subido por
   * error se quedaba en la ficha para siempre. Un verbo del store sin llamador no
   * es código de más: es una función que la ficha promete y no tiene.
   */
  it('quitar un documento se puede pedir desde alguna pantalla', () => {
    const llamadores = Object.entries(FUENTE)
      .filter(([r]) => !r.includes('.test.') && !r.endsWith('/store.tsx'))
      .filter(([, src]) => desnudo(src).includes('removeCandidateDocument('))
      .map(([r]) => r)
    expect(
      llamadores.length,
      '`removeCandidateDocument` no lo llama ninguna pantalla: el store sabe quitar un documento y no hay por dónde pedirlo.',
    ).toBeGreaterThan(0)
  })

  /**
   * Y EL ZIP SE LLEVA LOS DOS SITIOS DONDE VIVE UN FICHERO. Misma trampa que la
   * policy de lectura, en el otro extremo: `exportCandidateDocs` filtraba por
   * `cvPath` y punto, mientras la fila del menú decía "CV y adjuntos". El carnet
   * que pidió el formulario y el contrato que subió el equipo se quedaban fuera.
   */
  it('la exportación de documentos mira las dos fuentes', () => {
    // El glob resuelve desde `src/lib/`, así que la clave es relativa a aquí.
    const src = FUENTE['./export.ts']
    expect(src, 'no se encuentra src/lib/export.ts').toBeTruthy()
    const limpio = desnudo(src)
    const zip = limpio.slice(limpio.indexOf('export async function exportCandidateDocs'))
    expect(
      zip,
      'src/lib/export.ts: el ZIP no lee `cvPath`. Es el primer fichero de toda candidatura.',
    ).toContain('cvPath')
    expect(
      zip,
      'src/lib/export.ts: el ZIP no pide los documentos de `candidate_documents`, así que se lleva solo el CV mientras el menú promete "CV y adjuntos".',
    ).toContain('cargarDocs(')
  })

  it('nada que dé acceso a un documento se acota por EMPRESA', () => {
    for (const nombre of ['cvs_select_visible', 'cvs_delete_visible', 'candidate_documents_select', 'candidate_documents_insert', 'candidate_documents_delete']) {
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
