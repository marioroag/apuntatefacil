import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { EquipoTablon } from './EquipoTablon'
import { EquipoMiembros } from './EquipoMiembros'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { PageHeader } from '../components/ui/PageHeader'

// Página de equipo, en dos pestañas:
//   * Tablón (por defecto, TODO el equipo): peticiones internas con respuestas
//     y candidatos propuestos.
//   * Miembros (owner; en demo también, con datos de ejemplo): invitar y
//     gestionar accesos. Fuera de demo la seguridad real está en los RPCs
//     owner-only del servidor; aquí solo se decide qué se pinta.
export function Equipo() {
  const { company, role } = useAuth()
  const [params, setParams] = useSearchParams()

  const demo = company?.id === 'demo'

  // En demo el visitante actúa como propietario de "Tu empresa".
  const showMiembros = demo || role === 'owner'
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
    <div className="mx-auto max-w-lectura px-4 py-6 max-sm:pt-4 sm:px-6 lg:px-8">
      <PageHeader
        titulo="Equipo"
        sub={
          tab === 'tablon'
            ? 'Pide lo que necesitas cubrir: tu equipo responde y propone candidatos de la base.'
            : 'Invita a tu equipo a gestionar candidatos contigo. Usuarios ilimitados.'
        }
      />

      {showMiembros && (
        <Tabs
          items={[
            { value: 'tablon', label: 'Tablón' },
            { value: 'miembros', label: 'Miembros' },
          ]}
          value={tab}
          onChange={switchTab}
          idPrefix="equipo"
          label="Secciones de equipo"
          className="mb-5"
        />
      )}

      <TabPanel idPrefix="equipo" value={tab}>
        {tab === 'tablon' ? <EquipoTablon /> : <EquipoMiembros />}
      </TabPanel>
    </div>
  )
}
