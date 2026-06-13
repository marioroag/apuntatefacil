import { STATUS_META } from '../lib/types'
import type { CandidateStatus } from '../lib/types'

const ROWS: { name: string; sector: string; phone: string; status: CandidateStatus; when: string }[] = [
  { name: 'Antonio Navarro', sector: 'Camarero/a', phone: '622 481 109', status: 'nuevo', when: 'hace 2 h' },
  { name: 'Lucía Fernández', sector: 'Mozo/a almacén', phone: '655 203 884', status: 'nuevo', when: 'hace 5 h' },
  { name: 'Mohamed El Amrani', sector: 'Peón albañil', phone: '634 770 512', status: 'contactado', when: 'ayer' },
  { name: 'Marta Gil', sector: 'Camarero/a', phone: '600 918 233', status: 'entrevista', when: 'ayer' },
  { name: 'David Romero', sector: 'Peón albañil', phone: '671 552 048', status: 'contratado', when: 'hace 3 días' },
]

export function BrowserMock({ className = '' }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop ${className}`}>
      {/* Barra del navegador */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
        <span className="size-2.5 rounded-full bg-slate-300" />
        <span className="size-2.5 rounded-full bg-slate-300" />
        <span className="size-2.5 rounded-full bg-slate-300" />
        <div className="ml-2 flex-1 rounded-md bg-white px-3 py-1 text-[11px] text-slate-400 ring-1 ring-slate-200">
          criba.app/app/puestos
        </div>
      </div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex-1">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="mt-1.5 h-2 w-20 rounded bg-slate-100" />
        </div>
        <div className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">Filtros</div>
        <div className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white">Exportar a Excel</div>
      </div>
      {/* Filas */}
      <table className="w-full">
        <tbody>
          {ROWS.map((r) => {
            const m = STATUS_META[r.status]
            return (
              <tr key={r.name} className="border-b border-slate-50 last:border-0">
                <td className="py-2.5 pl-4 pr-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                      {r.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-slate-800">{r.name}</div>
                      <div className="text-[11px] text-slate-400">{r.sector}</div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-2 py-2.5 text-[12px] tabular-nums text-slate-500 sm:table-cell">{r.phone}</td>
                <td className="px-2 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${m.chip}`}>
                    <span className={`size-1.5 rounded-full ${m.dot}`} />
                    {m.label}
                  </span>
                </td>
                <td className="px-2 py-2.5 pr-4 text-right text-[11px] text-slate-400">{r.when}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
