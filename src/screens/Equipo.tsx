import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { planHas } from '../lib/pricing'
import { FeatureLocked } from '../components/FeatureLocked'
import { EquipoTablon } from './EquipoTablon'
import { EquipoMiembros } from './EquipoMiembros'

// Página de equipo (Pro+), en dos pestañas:
//   * Tablón (por defecto, TODO el equipo): peticiones internas con respuestas
//     y candidatos propuestos.
//   * Miembros (solo owner, nunca en demo): invitar y gestionar accesos. La
//     seguridad real está en los RPCs owner-only del servidor; aquí solo se
//     decide qué se pinta.
export function Equipo() {
  const { company, role } = useAuth()
  const [params, setParams] = useSearchParams()

  const demo = company?.id === 'demo'
  if (!demo && !planHas(company?.plan, 'teamBoard')) {
    return <FeatureLocked feature="teamBoard" />
  }

  const showMiembros = role === 'owner' && !demo
  // Un no-owner que fuerce ?t=miembros cae al tablón.
  const tab: 'tablon' | 'miembros' = params.get('t') === 'miembros' && showMiembros ? 'miembros' : 'tablon'

  const switchTab = (next: 'tablon' | 'miembros') =>
    setParams(() => {
      // Pestaña en la URL (sobrevive a recargas); al cambiar se suelta también
      // el deep link ?peticion del detalle abierto.
      const p = new URLSearchParams()
      if (next === 'miembros') p.set('t', 'miembros')
      return p
    })

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Equipo</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {tab === 'tablon'
            ? 'Pide lo que necesitas cubrir: tu equipo responde y propone candidatos de la base.'
            : 'Invita a tu equipo a gestionar candidatos contigo. Usuarios ilimitados.'}
        </p>
      </header>

      {showMiembros && (
        <div role="tablist" aria-label="Secciones de equipo" className="mb-5 flex gap-5 border-b border-slate-200">
          <TabButton active={tab === 'tablon'} onClick={() => switchTab('tablon')} id="tab-tablon" controls="panel-tablon">
            Tablón
          </TabButton>
          <TabButton active={tab === 'miembros'} onClick={() => switchTab('miembros')} id="tab-miembros" controls="panel-miembros">
            Miembros
          </TabButton>
        </div>
      )}

      <div role="tabpanel" id={tab === 'tablon' ? 'panel-tablon' : 'panel-miembros'} aria-labelledby={tab === 'tablon' ? 'tab-tablon' : 'tab-miembros'}>
        {tab === 'tablon' ? <EquipoTablon /> : <EquipoMiembros />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  id,
  controls,
  children,
}: {
  active: boolean
  onClick: () => void
  id: string
  controls: string
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`-mb-px border-b-2 pb-2.5 text-sm transition-colors ${
        active
          ? 'border-indigo-600 font-semibold text-slate-900'
          : 'border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}
