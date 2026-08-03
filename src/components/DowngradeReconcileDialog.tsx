import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useToast } from './ui/Toast'
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
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4"
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
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    disabled={disabled}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-[var(--duration-control)] ease-[var(--ease-out)] ${
                      selected
                        ? 'border-indigo-300 bg-indigo-50/50'
                        : disabled
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-55'
                          : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                        selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {selected && <Check className="size-3.5 [stroke-width:3]" />}
                    </span>
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
                  </button>
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
