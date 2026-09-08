import { describe, expect, it } from 'vitest'
import { EMAIL_KEYS, SECCIONES } from './settings'

/**
 * EL GUARDIÁN DE LOS AJUSTES.
 *
 * El problema que resuelve: dentro de tres meses alguien (yo incluido) añade un
 * aviso por correo nuevo, o una columna de configuración de la empresa, y se
 * olvida de darle su interruptor. El ajuste no aparece, nadie lo echa de menos
 * hasta que un cliente se queja de que le llegan correos que no puede parar.
 * Una nota en la documentación no lo impide; una prueba que falla, sí.
 *
 * Por eso esto no comprueba comportamiento: comprueba que **lo que merece un
 * ajuste tenga un ajuste**. Es un detector, y cuando salta te dice qué hacer.
 *
 * Cuando falle, hay exactamente dos salidas honestas:
 *   1. Declarar el ajuste en `settings.tsx` (una entrada, ver ese fichero).
 *   2. Apuntar el caso en la lista de excepciones de abajo CON SU MOTIVO
 *      escrito. Una excepción sin motivo es un olvido con permiso.
 */

// Los ficheros se leen con los globs de Vite y no con `node:fs`: el tsconfig de
// la app no tiene los tipos de node (y meterlos solo para una prueba sería una
// dependencia nueva por nada). `?raw` los trae como texto. Esto no entra en el
// bundle: la prueba no la importa la app.
const FUNCIONES = import.meta.glob('../../supabase/functions/*/index.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const MIGRACIONES = import.meta.glob('../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// --- Excepciones, con su motivo ----------------------------------------------

/**
 * Correos que NO son un aviso configurable, y por qué. Todo lo demás que mande
 * un correo tiene que pasar por `conPreferencia`.
 */
const CORREOS_SIN_AJUSTE: Record<string, string> = {
  'send-invitation': 'Lo mandas tú al invitar a alguien: es la acción, no un aviso.',
  'send-interest-check': 'Va al CANDIDATO y lo disparas tú; sus ajustes no son los del cliente.',
  'notify-support': 'Bandeja interna de Apúntate Fácil, no del cliente.',
  'support-reply': 'Respuesta a un ticket que abrió el propio usuario.',
  'resend-inbound': 'Webhook de entrada: recibe correo, no lo manda por su cuenta.',
  'notify-trial': 'Fin de la prueba: avisa de que termina lo gratis y de que empieza a cobrarse si sigue. Como los correos de acceso, no se apaga.',
}

/** Columnas de `companies` que se pueden actualizar y NO son un ajuste. */
const COLUMNAS_SIN_AJUSTE: Record<string, string> = {
  name: 'Nombre de la empresa: se edita en el onboarding, no es una preferencia.',
  accent: 'Color de marca: vive en el constructor del formulario.',
  onboarding_done_at: 'Estado de la guía de primer uso, lo mueve la propia guía.',
}

// --- Utilidades ---------------------------------------------------------------

function ficherosDeFunciones(): { nombre: string; codigo: string }[] {
  return Object.entries(FUNCIONES)
    .map(([ruta, codigo]) => ({ nombre: ruta.split('/').at(-2) ?? '', codigo }))
    .filter((f) => f.nombre && !f.nombre.startsWith('_'))
}

/** Todas las migraciones en orden, que es como se aplican. */
function sql(): string {
  return Object.keys(MIGRACIONES)
    .sort()
    .map((k) => MIGRACIONES[k])
    .join('\n')
}

const manda = (codigo: string) => codigo.includes('api.resend.com/emails')
const clavesUsadas = (codigo: string) =>
  [...codigo.matchAll(/conPreferencia\([\s\S]*?['"]([a-z_]+)['"]\s*,?\s*\)/g)].map((m) => m[1])

const todosLosAjustes = SECCIONES.flatMap((s) => s.grupos.flatMap((g) => g.ajustes))

// --- El detector ---------------------------------------------------------------

describe('lo que merece un ajuste, tiene un ajuste', () => {
  it('todo correo de aviso se puede apagar', () => {
    const sinInterruptor = ficherosDeFunciones()
      .filter((f) => manda(f.codigo))
      .filter((f) => !(f.nombre in CORREOS_SIN_AJUSTE))
      .filter((f) => !f.codigo.includes('conPreferencia'))
      .map((f) => f.nombre)

    expect(
      sinInterruptor,
      `Estas funciones mandan correo y no consultan las preferencias:\n` +
        sinInterruptor.map((n) => `  · ${n}`).join('\n') +
        `\n\nDale su interruptor: añade la clave a EMAIL_KEYS y su fila al registro de ` +
        `src/lib/settings.tsx, y filtra los destinatarios con conPreferencia(). ` +
        `Si de verdad no es un aviso configurable, apúntalo en CORREOS_SIN_AJUSTE con el motivo.`,
    ).toEqual([])
  })

  it('las claves de los correos son las mismas en el registro y en las funciones', () => {
    const declaradas = new Set<string>(Object.values(EMAIL_KEYS))
    const usadas = new Set(ficherosDeFunciones().flatMap((f) => clavesUsadas(f.codigo)))

    const inventadas = [...usadas].filter((k) => !declaradas.has(k))
    expect(
      inventadas,
      `Estas claves se usan en una edge function y no existen en EMAIL_KEYS: ${inventadas.join(', ')}. ` +
        `Sin la clave común, el interruptor deja de gobernar el envío en silencio.`,
    ).toEqual([])

    const huerfanas = [...declaradas].filter((k) => !usadas.has(k))
    expect(
      huerfanas,
      `Estas claves están en EMAIL_KEYS y no las consulta nadie: ${huerfanas.join(', ')}. ` +
        `O el aviso no las respeta (interruptor falso), o sobran.`,
    ).toEqual([])
  })

  it('cada clave de correo tiene su fila en el registro', () => {
    const enRegistro = new Set(todosLosAjustes.map((a) => a.id))
    const sinFila = Object.values(EMAIL_KEYS).filter((k) => !enRegistro.has(k))
    expect(
      sinFila,
      `Claves sin fila visible en Ajustes: ${sinFila.join(', ')}. El correo se puede apagar pero nadie puede.`,
    ).toEqual([])
  })

  it('toda columna configurable de la empresa está en los ajustes y llega al cliente', () => {
    const texto = sql()
    const columnas = [
      ...texto.matchAll(/grant\s+update\s*\(\s*([a-z_]+)\s*\)\s+on\s+public\.companies\s+to\s+authenticated/gi),
    ].map((m) => m[1])

    const candidatas = [...new Set(columnas)].filter((c) => !(c in COLUMNAS_SIN_AJUSTE))
    const enRegistro = new Set(todosLosAjustes.map((a) => a.id))
    const sinAjuste = candidatas.filter((c) => !enRegistro.has(c))
    expect(
      sinAjuste,
      `Estas columnas de companies se pueden cambiar desde el cliente y no tienen ajuste: ${sinAjuste.join(', ')}. ` +
        `Dales su fila en src/lib/settings.tsx o apúntalas en COLUMNAS_SIN_AJUSTE con el motivo.`,
    ).toEqual([])

    // La trampa que ya nos mordió una vez: my_companies arma el objeto campo a
    // campo, así que una columna que no esté ahí NUNCA llega al cliente y el
    // ajuste parece no guardarse.
    // Busca la DEFINICIÓN, no cualquier mención. Con `function public.my_companies()`
    // a secas, un `revoke all on function public.my_companies()` en una migración
    // posterior se llevaba el `lastIndexOf` (pasó al endurecer sus permisos el
    // 26-ago-2026) y el detector daba por desaparecidas todas las columnas.
    // Un guardián que salta por su propia heurística gasta la confianza que
    // necesita para el día que salte de verdad.
    const ultimoMyCompanies = texto.lastIndexOf('create or replace function public.my_companies()')
    const cuerpo = ultimoMyCompanies >= 0 ? texto.slice(ultimoMyCompanies) : ''
    const noViajan = candidatas.filter((c) => !cuerpo.includes(`'${c}'`))
    expect(
      noViajan,
      `Estas columnas tienen ajuste pero my_companies no las devuelve: ${noViajan.join(', ')}. ` +
        `El interruptor guardaría bien y volvería a su sitio al recargar.`,
    ).toEqual([])
  })
})

describe('el registro se mantiene coherente', () => {
  it('no hay ids repetidos', () => {
    const ids = [
      ...SECCIONES.map((s) => `seccion:${s.id}`),
      ...SECCIONES.flatMap((s) => s.grupos.map((g) => `grupo:${s.id}/${g.id}`)),
      ...SECCIONES.flatMap((s) => s.grupos.flatMap((g) => g.ajustes.map((a) => `ajuste:${a.id}`))),
    ]
    expect(new Set(ids).size, `Ids repetidos en el registro: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('cada ajuste explica qué pasa si lo apagas', () => {
    const mudos = todosLosAjustes.filter((a) => !a.hint?.trim()).map((a) => a.id)
    expect(mudos, `Ajustes sin explicación: ${mudos.join(', ')}. Un interruptor sin hint es un acertijo.`).toEqual([])
  })

  it('el copy de los ajustes respeta las reglas de la casa', () => {
    // Sin guion largo en nada visible (regla de copy del proyecto).
    const textos = [
      ...SECCIONES.flatMap((s) => [s.label, s.titulo, s.descripcion, s.nota ?? '']),
      ...SECCIONES.flatMap((s) => s.grupos.flatMap((g) => [g.titulo, g.descripcion ?? '', g.nota ?? ''])),
      ...todosLosAjustes.flatMap((a) => [a.label, a.hint ?? '']),
    ]
    const conGuion = textos.filter((t) => t.includes('—'))
    expect(conGuion, `Guion largo en: ${conGuion.join(' | ')}`).toEqual([])
  })
})
