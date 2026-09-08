// Guardián del AVISO DE FIN DE PRUEBA (sep 2026). Lo que vigila es lo que no se
// ve romperse: que la cadena esté entera (el cron encola, el tick sabe ejecutar,
// la función existe), que quien ya paga no reciba el correo, que un correo no
// salga dos veces, y que un fallo del proveedor suelte el reclamo para que la
// cola reintente en vez de cancelar con un motivo falso.
import { describe, expect, it } from 'vitest'
import tick from '../../supabase/functions/interview-tick/index.ts?raw'
import fn from '../../supabase/functions/notify-trial/index.ts?raw'

const MIGRACIONES = import.meta.glob('../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('el aviso de fin de prueba', () => {
  it('la cadena está entera: el cron encola, el tick ejecuta, la función responde', () => {
    const encola = Object.values(MIGRACIONES).some((t) => /enqueue_interview_job\(\s*'avisar_prueba'/.test(t))
    expect(encola, 'ninguna migración encola `avisar_prueba`').toBe(true)
    const programa = Object.values(MIGRACIONES).some((t) => /cron\.schedule\('aviso-prueba'/.test(t))
    expect(programa, 'no hay cron que llame a encolar_avisos_prueba cada día').toBe(true)
    expect(tick, 'el tick no sabe ejecutar `avisar_prueba`').toContain("job.kind === 'avisar_prueba'")
    expect(tick).toContain("functions.invoke('notify-trial'")
  })

  it('quien ya paga no recibe el correo, y solo lo manda la cola', () => {
    expect(fn).toMatch(/plan !== 'trial'[\s\S]{0,80}skipped: 'ya no está en prueba'/)
    expect(fn, 'la función tiene que exigir el service_role: un navegador no puede disparar correos a clientes').toContain('igualSeguro(bearer, SERVICE_ROLE_KEY)')
  })

  it('un correo por tipo y empresa, y el reclamo se suelta si Resend falla o no contesta', () => {
    expect(fn).toMatch(/\.is\(marca, null\)/)
    const soltar = fn.match(/await soltarReclamo\(\)/g)?.length ?? 0
    expect(soltar, 'hay que soltar el reclamo por los DOS caminos: rechazo y red caída').toBeGreaterThanOrEqual(2)
    for (const motivo of ['ya no está en prueba', 'sin clave de Resend', 'sin email del dueño', 'ya avisado']) {
      expect(fn, `falta la salida con motivo: ${motivo}`).toContain(motivo)
    }
  })
})
