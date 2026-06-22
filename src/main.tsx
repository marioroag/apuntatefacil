import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import '@fontsource-variable/inter'
// Manrope = fuente de MARCA (Apúntate Fácil): wordmark "apuntatefacil" y todos los
// titulares, en la landing y en la app. El cuerpo y los datos densos siguen en Inter.
import '@fontsource-variable/manrope'
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

const ResetPassword = lazy(() => import('./screens/ResetPassword').then((m) => ({ default: m.ResetPassword })))
const Privacidad = lazy(() => import('./screens/Legal').then((m) => ({ default: m.Privacidad })))
const Terminos = lazy(() => import('./screens/Legal').then((m) => ({ default: m.Terminos })))
const PublicForm = lazy(() => import('./screens/PublicForm').then((m) => ({ default: m.PublicForm })))
const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })))
const Bandeja = lazy(() => import('./screens/Bandeja').then((m) => ({ default: m.Bandeja })))
const Sedes = lazy(() => import('./screens/Sedes').then((m) => ({ default: m.Sedes })))
const Marcas = lazy(() => import('./screens/Marcas').then((m) => ({ default: m.Marcas })))
const Resumen = lazy(() => import('./screens/Resumen').then((m) => ({ default: m.Resumen })))
const Equipo = lazy(() => import('./screens/Equipo').then((m) => ({ default: m.Equipo })))
const Invitacion = lazy(() => import('./screens/Invitacion').then((m) => ({ default: m.Invitacion })))
const Builder = lazy(() => import('./screens/Builder').then((m) => ({ default: m.Builder })))
const Plan = lazy(() => import('./screens/Plan').then((m) => ({ default: m.Plan })))

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
                  <Route path="bandeja" element={<Bandeja />} />
                  <Route path="sedes" element={<Sedes />} />
                  <Route path="marcas" element={<Marcas />} />
                  <Route path="equipo" element={<Equipo />} />
                  <Route path="puestos/:campaignId" element={<Dashboard />} />
                  <Route path="puestos/:campaignId/formulario" element={<Builder />} />
                  <Route path="plan" element={<Plan />} />
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
                  <Route path="bandeja" element={<Bandeja />} />
                  <Route path="sedes" element={<Sedes />} />
                  <Route path="marcas" element={<Marcas />} />
                  <Route path="puestos/:campaignId" element={<Dashboard />} />
                  <Route path="puestos/:campaignId/formulario" element={<Builder />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </StoreProvider>
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
)
