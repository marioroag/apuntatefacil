import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useToast } from './ui/Toast'
import { Checkbox } from './ui/Checkbox'
import { PLAN_LABEL, PLAN_PROCESS_LIMIT } from '../lib/pricing'
import { BTN_PRIMARY } from '../lib/buttons'

// Diálogo BLOQUEANTE tras bajar de plan: el servidor ya pausó los puestos que
// sobraban (los de menos candidaturas), y aquí el dueño elige cuáles mantener
// activos hasta el límite del plan. Los que queden en pausa conservan todos sus
// candidatos (política: nunca se borra ni se cierra nada). No se puede cerrar sin
// elegir; guardar resuelve el flag y desmonta el diálogo.
export function DowngradeReconcileDialog() {
  const { company, refreshCompany } = useAuth()
  const { campaigns, candidatesFor, reload } = useStore()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const plan = company?.plan ?? 'esencial'
  const limit = PLAN_PROCESS_LIMIT[plan] ?? 0

  // Puestos "abiertos" (activo o pausado), ordenados por candidaturas desc para
  // que la decisión sea fácil; los cerrados no entran (no reciben ni cuentan).
  const rows = useMemo(
    () =>
      campaigns
        .filter((c) => c.status === 'activa' || c.status === 'pausada')
        .map((c) => ({ c, count: candidatesFor(c.id).length }))
        .sort((a, b) => b.count - a.count),
    [campaigns, candidatesFor],
  )

  // Preselección = lo que el servidor dejó activo (los de más candidaturas). El
  // store puede cargar los puestos DESPUÉS de montar el diálogo, así que sembramos
  // una sola vez cuando llegan (sin pisar los cambios que el usuario haga luego).
  const [keep, setKeep] = useState<Set<string>>(
    () => new Set(campaigns.filter((c) => c.status === 'activa').map((c) => c.id)),
  )
  const seeded = useRef(campaigns.some((c) => c.status === 'activa'))
  useEffect(() => {
    if (!seeded.current && campaigns.some((c) => c.status === 'activa')) {
      seeded.current = true
      setKeep(new Set(campaigns.filter((c) => c.status === 'activa').map((c) => c.id)))
    }
  }, [campaigns])
  const atMax = keep.size >= limit

  const toggle = (id: string) =>
    setKeep((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < limit) next.add(id)
      return next
    })

  const save = async () => {
    if (!company || busy) return
    setBusy(true)
    const { error } = await supabase.rpc('set_active_campaigns', {
      p_company_id: company.id,
      p_active: [...keep],
    })
    if (error) {
      setBusy(false)
      toast.error('No se pudo guardar. Inténtalo de nuevo.')
      return
    }
    await reload() // estados de puesto al día
    await refreshCompany() // limpia el flag -> el diálogo se desmonta
    setBusy(false)
    toast.success('Puestos actualizados.')
  }

  return (
    <div
      // El telón, al 40% como las otras cuatro capas del sistema. Estaba al 50%:
      // una capa más oscura que las demás se lee como "esto es más grave", y aquí
      // no lo es más que en cualquier otro diálogo bloqueante.
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconcile-title"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-pop">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="reconcile-title" className="text-lg font-semibold text-slate-900">
            Elige qué puestos mantener activos
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            Tu plan {PLAN_LABEL[plan]} permite {limit}{' '}
            {limit === 1 ? 'puesto activo' : 'puestos activos'} a la vez. Los que dejes en pausa dejan de
            recibir candidaturas nuevas, pero conservas y puedes exportar todos sus candidatos.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="space-y-1.5">
            {rows.map(({ c, count }) => {
              const selected = keep.has(c.id)
              const disabled = !selected && atMax
              return (
                <li key={c.id}>
                  {/* Elegir de una lista es un CHECKBOX, y el de la casa es
                      `ui/Checkbox`: esto era una casilla dibujada a mano, de 20px y
                      `rounded-md`, cuando la primitiva mide 16 y va a 5px. Un input
                      no puede vivir dentro de un `<button>`, así que la fila pasa a
                      `<label>`: el control es real, el estado lo dice `checked` en vez
                      de un `aria-pressed` prestado, y pulsar en cualquier parte de la
                      fila sigue marcando, igual que antes.

                      El marco, a DOS MANOS (`filo-*`). Y las dos se mueven a la vez
                      en el hover a propósito: la segunda mano es un outline pintado
                      encima del borde, así que un `hover:border-*` suelto no se
                      vería. */}
                  <label
                    // `focus-within` en la FILA y no solo el anillo de la casilla: al
                    // pasar de `<button aria-pressed>` a `<label>` + `ui/Checkbox`, la
                    // señal de foco bajó de un contorno alrededor de toda la fila a un
                    // aro sobre una caja de 16px. Este diálogo BLOQUEA y su única tarea
                    // es recorrer estas filas con el teclado, así que el foco tiene que
                    // decir en qué fila estás, no solo en qué casilla.
                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600 ${
                      selected
                        ? 'cursor-pointer filo-indigo-300 bg-indigo-50/50'
                        : disabled
                          ? 'cursor-not-allowed filo-slate-200 bg-slate-50 opacity-55'
                          : 'cursor-pointer filo-slate-200 hover:filo-slate-300'
                    }`}
                  >
                    <Checkbox checked={selected} disabled={disabled} onChange={() => toggle(c.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{c.title}</span>
                      <span className="block truncate text-[12px] text-slate-500 num">
                        {count} {count === 1 ? 'candidato' : 'candidatos'}
                        {c.location ? ` · ${c.location}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-slate-500">
                      {selected ? 'Activo' : 'En pausa'}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <span className="num text-[13px] text-slate-500">
            {keep.size} de {limit} activos
          </span>
          <button onClick={save} disabled={busy} className={`${BTN_PRIMARY} disabled:opacity-70`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
