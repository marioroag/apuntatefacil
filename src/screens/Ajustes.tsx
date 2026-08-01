import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { planHas } from '../lib/pricing'
import { FeatureLocked } from '../components/FeatureLocked'
import { Tabs, TabPanel } from '../components/ui/Tabs'
import { AjustesCalendario } from './AjustesCalendario'

// Ajustes de la cuenta. Hoy tiene una sola sección (Calendario), y aun así lleva
// pestañas con la activa en la URL: es el molde de Equipo, y estrenarlo ahora
// evita que la segunda sección obligue a rehacer la página. La barra no se pinta
// mientras solo haya una, que sería ruido.
type Seccion = 'calendario'

export function Ajustes() {
  const { company } = useAuth()
  const [, setParams] = useSearchParams()

  const demo = company?.id === 'demo'
  // Misma llave que las entrevistas: sin ellas, esta pantalla no configura nada.
  if (!demo && !planHas(company?.plan, 'entrevistas')) {
    return <FeatureLocked feature="entrevistas" />
  }

  const secciones: { value: Seccion; label: string }[] = [{ value: 'calendario', label: 'Calendario' }]
  const tab: Seccion = 'calendario'
  const switchTab = (next: Seccion) =>
    setParams(() => {
      const p = new URLSearchParams()
      if (next !== 'calendario') p.set('t', next)
      return p
    })

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Ajustes</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Cómo son tus entrevistas y cuándo puedes hacerlas. Es lo que usamos al cuadrar cada cita.
        </p>
      </header>

      {secciones.length > 1 && (
        <Tabs
          items={secciones}
          value={tab}
          onChange={switchTab}
          idPrefix="ajustes"
          label="Secciones de ajustes"
          className="mb-5"
        />
      )}

      <TabPanel idPrefix="ajustes" value={tab}>
        <AjustesCalendario />
      </TabPanel>
    </div>
  )
}
