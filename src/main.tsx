import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Loader2 } from 'lucide-react'
// Analítica de Vercel: conteo de páginas/visitas sin cookies ni datos personales.
// Es una app Vite/React (no Next), así que el import es el de React, no el de /next.
import { Analytics } from '@vercel/analytics/react'
// Speed Insights: métricas reales de rendimiento (Core Web Vitals). Mismo criterio:
// el import de React, no el de /next.
import { SpeedInsights } from '@vercel/speed-insights/react'
// Geist = familia única de producto (Apúntate Fácil): wordmark, titulares, cuerpo,
// etiquetas y datos, con jerarquía por peso. Los datos van con cifras tabulares
// (clase .num) para alinear columnas sin recurrir a una mono.
import '@fontsource-variable/geist'
import './index.css'

import { AuthProvider, DemoAuthProvider } from './lib/auth'
import { StoreProvider } from './lib/store'
import { ToastProvider } from './components/ui/Toast'
import { AuthGate } from './components/AuthGate'
import { AppLayout, FirstCampaignRedirect } from './screens/AppLayout'
// La landing y el login quedan en el bundle de entrada (primer pintado de la web
// pública y del acceso). El resto de pantallas van con code-splitting: cada una en
// su propio chunk, cargada al visitarla. Así el candidato en /a/:slug no se descarga
// el panel, ni el panel arrastra el formulario público o el constructor (dnd-kit).
import { Landing } from './screens/Landing'
import { Login } from './screens/Login'
import { MERIDIAN_CHAT_ENABLED } from './lib/meridian'

const ResetPassword = lazy(() => import('./screens/ResetPassword').then((m) => ({ default: m.ResetPassword })))
const Privacidad = lazy(() => import('./screens/Legal').then((m) => ({ default: m.Privacidad })))
const Terminos = lazy(() => import('./screens/Legal').then((m) => ({ default: m.Terminos })))
const PublicForm = lazy(() => import('./screens/PublicForm').then((m) => ({ default: m.PublicForm })))
const InterestResponse = lazy(() => import('./screens/InterestResponse').then((m) => ({ default: m.InterestResponse })))
const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })))
const Bandeja = lazy(() => import('./screens/Bandeja').then((m) => ({ default: m.Bandeja })))
const Resumen = lazy(() => import('./screens/Resumen').then((m) => ({ default: m.Resumen })))
const MeridianBriefing = lazy(() => import('./screens/MeridianBriefing').then((m) => ({ default: m.MeridianBriefing })))
const Equipo = lazy(() => import('./screens/Equipo').then((m) => ({ default: m.Equipo })))
const Invitacion = lazy(() => import('./screens/Invitacion').then((m) => ({ default: m.Invitacion })))
const Builder = lazy(() => import('./screens/Builder').then((m) => ({ default: m.Builder })))
const Plan = lazy(() => import('./screens/Plan').then((m) => ({ default: m.Plan })))
const Soporte = lazy(() => import('./screens/Soporte').then((m) => ({ default: m.Soporte })))
const AdminOverview = lazy(() => import('./screens/AdminOverview').then((m) => ({ default: m.AdminOverview })))
// Playground de diseño: solo en `npm run dev`, no entra en el build de producción.
const Playground = import.meta.env.DEV
  ? lazy(() => import('./screens/Playground').then((m) => ({ default: m.Playground })))
  : null

// El hilo de Meridian está apagado (MERIDIAN_CHAT_ENABLED). La ruta no se borra:
// redirige a la Vista general, así quien la tuviera guardada aterriza en su panel
// y no en la landing por el comodín del final.
const meridianRoute = MERIDIAN_CHAT_ENABLED
  ? <Route path="meridian" element={<MeridianBriefing />} />
  : <Route path="meridian" element={<Navigate to="../resumen" replace />} />

// Sedes y Marcas dejaron de ser pantallas (ago 2026): la sede se gestiona en Vista
// general y los ajustes del puesto, y la marca en el constructor del formulario.
// Las rutas viejas no se borran, redirigen: quien las tuviera guardadas aterriza en
// su panel y no en la landing por el comodín del final.
const rutasRetiradas = (
  <>
    <Route path="sedes" element={<Navigate to="../resumen" replace />} />
    <Route path="marcas" element={<Navigate to="../resumen" replace />} />
  </>
)

const RouteFallback = () => (
  <div className="grid min-h-screen place-items-center" role="status" aria-label="Cargando">
    <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ToastProvider>
          <StoreProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/restablecer" element={<ResetPassword />} />
                <Route path="/invitacion" element={<Invitacion />} />
                <Route path="/privacidad" element={<Privacidad />} />
                <Route path="/terminos" element={<Terminos />} />
                {Playground && <Route path="/dev/playground" element={<Playground />} />}
                <Route path="/respuesta/:token" element={<InterestResponse />} />
                {/* Enlace público. Lo que se comparte es estable: /<marca>/<slug> (2 tramos);
                    el slug del medio es el id real (lo resuelve el RPC), el resto es decorativo.
                    Al abrirlo, PublicForm embellece la barra a /<marca>/<slug>/<título> (3 tramos),
                    por eso esa ruta también existe. /a/:slug se mantiene para enlaces antiguos. */}
                <Route path="/a/:slug" element={<PublicForm />} />
                <Route path="/:brandSlug/:slug" element={<PublicForm />} />
                <Route path="/:brandSlug/:slug/:formName" element={<PublicForm />} />
                <Route
                  path="/app"
                  element={
                    <AuthGate>
                      <AppLayout />
                    </AuthGate>
                  }
                >
                  <Route index element={<FirstCampaignRedirect />} />
                  <Route path="resumen" element={<Resumen />} />
                  {meridianRoute}
                  <Route path="bandeja" element={<Bandeja />} />
                  <Route path="equipo" element={<Equipo />} />
                  {rutasRetiradas}
                  <Route path="puestos/:campaignId" element={<Dashboard />} />
                  <Route path="puestos/:campaignId/formulario" element={<Builder />} />
                  <Route path="plan" element={<Plan />} />
                  <Route path="admin" element={<AdminOverview />} />
                  <Route path="soporte" element={<Soporte />} />
                </Route>
                <Route
                  path="/demo"
                  element={
                    <DemoAuthProvider>
                      <StoreProvider>
                        <AppLayout />
                      </StoreProvider>
                    </DemoAuthProvider>
                  }
                >
                  <Route index element={<FirstCampaignRedirect />} />
                  <Route path="resumen" element={<Resumen />} />
                  {meridianRoute}
                  <Route path="bandeja" element={<Bandeja />} />
                  <Route path="equipo" element={<Equipo />} />
                  {rutasRetiradas}
                  <Route path="puestos/:campaignId" element={<Dashboard />} />
                  <Route path="puestos/:campaignId/formulario" element={<Builder />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
              <Analytics />
              <SpeedInsights />
            </BrowserRouter>
          </StoreProvider>
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
)
