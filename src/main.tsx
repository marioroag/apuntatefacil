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

// -----------------------------------------------------------------------------
// UNA PESTAÑA ABIERTA ES UNA APP VIEJA, y cada deploy le rompe los chunks.
//
// Con code-splitting, el index.html que la pestaña tiene en memoria apunta a los
// hashes de SU build; al desplegar, esos ficheros dejan de existir en el alias.
// La primera pantalla perezosa que se visite después pide un chunk que ya no
// está, el import dinámico falla y React se queda desmontado: página en blanco
// hasta recargar a mano. Se vio en producción (ago 2026) con la consola delante:
// `Candidatos-jGDFMSMN.js` pedido, `Candidatos-DVkOnVVO.js` desplegado.
//
// Vite avisa de exactamente esto con `vite:preloadError`, y la salida documentada
// es recargar: el index.html nuevo trae los hashes nuevos y la URL se conserva,
// así que quien navegaba ni se entera. Con candado por pestaña para no entrar en
// bucle si el fallo es otro (sin red, por ejemplo): si acabamos de recargar por
// esto, la segunda vez se deja correr el error, que un fallo visible es mejor
// que una página que recarga sin parar.
//
// La otra mitad vive en `vercel.json`: el rewrite de SPA excluye `/assets/`, para
// que un chunk que falta sea un 404 honesto y no un 200 con HTML disfrazado de
// JavaScript (que era lo que convertía el error en uno de MIME, más raro de leer).
// -----------------------------------------------------------------------------
const RECARGA_CHUNK = 'apuntatefacil.recarga-chunk'
window.addEventListener('vite:preloadError', (e) => {
  let ultima = 0
  try { ultima = Number(sessionStorage.getItem(RECARGA_CHUNK) ?? 0) } catch { /* sin sessionStorage no hay candado: mejor recargar que quedarse en blanco */ }
  if (Date.now() - ultima < 15_000) return
  e.preventDefault()
  try { sessionStorage.setItem(RECARGA_CHUNK, String(Date.now())) } catch { }
  window.location.reload()
})

import { AuthProvider, DemoAuthProvider } from './lib/auth'
import { StoreProvider } from './lib/store'
import { ProfilesProvider } from './lib/profiles'
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
const InterestResponse = lazy(() => import('./screens/InterestResponse').then((m) => ({ default: m.InterestResponse })))
const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })))
const Candidatos = lazy(() => import('./screens/Candidatos').then((m) => ({ default: m.Candidatos })))
const Resumen = lazy(() => import('./screens/Resumen').then((m) => ({ default: m.Resumen })))
const Equipo = lazy(() => import('./screens/Equipo').then((m) => ({ default: m.Equipo })))
const Entrevistas = lazy(() => import('./screens/Entrevistas').then((m) => ({ default: m.Entrevistas })))
const Invitacion = lazy(() => import('./screens/Invitacion').then((m) => ({ default: m.Invitacion })))
const Builder = lazy(() => import('./screens/Builder').then((m) => ({ default: m.Builder })))
const Plan = lazy(() => import('./screens/Plan').then((m) => ({ default: m.Plan })))
const Soporte = lazy(() => import('./screens/Soporte').then((m) => ({ default: m.Soporte })))
const Ajustes = lazy(() => import('./screens/Ajustes').then((m) => ({ default: m.Ajustes })))
const AdminOverview = lazy(() => import('./screens/AdminOverview').then((m) => ({ default: m.AdminOverview })))
// Playground de diseño: solo en `npm run dev`, no entra en el build de producción.
const Playground = import.meta.env.DEV
  ? lazy(() => import('./screens/Playground').then((m) => ({ default: m.Playground })))
  : null

// EL HILO DE MERIDIAN SE RETIRÓ (Mario, ago 2026): no va a volver. La ruta se
// queda redirigiendo porque quien la tuviera guardada aterriza en su panel y no
// en la landing por el comodín del final, que es lo mismo que hacen las rutas de
// Sedes y Marcas. Lo que se fue es la pantalla, su bandera y sus dos entradas.
// El TRIAJE de Meridian sigue vivo entero: la columna Encaje, el informe de la
// ficha y el orden por encaje no dependían de esto.
const meridianRoute = <Route path="meridian" element={<Navigate to="../resumen" replace />} />

// Sedes y Marcas dejaron de ser pantallas (ago 2026): la sede se gestiona en Vista general
// y en los ajustes del puesto, y la marca en el constructor del formulario.
// Las rutas viejas no se borran, redirigen: quien las tuviera guardadas aterriza en
// su panel y no en la landing por el comodín del final.
/**
 * CANDIDATOS Y SUS CUATRO VISTAS (Mario, ago 2026).
 *
 * Rutas explícitas y no una con `:vista`: así no existe la ruta inválida
 * (`/candidatos/loquesea`) que habría que interceptar y redirigir, y el guardián
 * del buscador ve destinos de verdad a los que exigir su entrada. La lista
 * de vistas manda (`lib/candidatos.ts`); esto solo las cuelga del router.
 *
 * La principal NO lleva sufijo: "/candidatos" ES Activos.
 */
const rutasCandidatos = (
  <>
    {/* El `key` no es decoracion: sin el, React reconcilia las tres rutas como el
        MISMO componente (mismo tipo, misma posicion) y la pantalla conserva su
        estado al cambiar de vista. Se quedaba puesto el filtro por puesto, y si
        ese puesto no tenia a nadie en la vista nueva, el chip decia "Puesto (1)"
        con la lista de opciones vacia: no habia forma de ver cual estaba marcado.
        Cada vista es una pantalla distinta, asi que se monta como tal. */}
    <Route path="candidatos" element={<Candidatos key="activos" vista="activos" />} />
    <Route path="candidatos/contratados" element={<Candidatos key="contratados" vista="contratados" />} />
    <Route path="candidatos/favoritos" element={<Candidatos key="favoritos" vista="favoritos" />} />
    <Route path="candidatos/todos" element={<Candidatos key="todos" vista="todos" />} />
    {/* "Bandeja" era la cola de los `nuevo` y ahora es la vista Activos. La ruta
        vieja no se borra, redirige: quien la tuviera guardada aterriza donde
        estaba su trabajo y no en la landing por el comodín del final. */}
    <Route path="bandeja" element={<Navigate to="../candidatos" replace />} />
  </>
)

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
                      <ProfilesProvider>
                        <AppLayout />
                      </ProfilesProvider>
                    </AuthGate>
                  }
                >
                  <Route index element={<FirstCampaignRedirect />} />
                  <Route path="resumen" element={<Resumen />} />
                  {meridianRoute}
                  {rutasCandidatos}
                  <Route path="equipo" element={<Equipo />} />
                  {rutasRetiradas}
                  <Route path="entrevistas" element={<Entrevistas />} />
                  <Route path="puestos/:campaignId" element={<Dashboard />} />
                  <Route path="puestos/:campaignId/formulario" element={<Builder />} />
                  <Route path="ajustes" element={<Ajustes />} />
                  <Route path="ajustes/:seccion" element={<Ajustes />} />
                  <Route path="plan" element={<Plan />} />
                  <Route path="admin" element={<AdminOverview />} />
                  <Route path="soporte" element={<Soporte />} />
                </Route>
                <Route
                  path="/demo"
                  element={
                    <DemoAuthProvider>
                      <StoreProvider>
                        <ProfilesProvider>
                          <AppLayout />
                        </ProfilesProvider>
                      </StoreProvider>
                    </DemoAuthProvider>
                  }
                >
                  <Route index element={<FirstCampaignRedirect />} />
                  <Route path="resumen" element={<Resumen />} />
                  {meridianRoute}
                  {rutasCandidatos}
                  <Route path="equipo" element={<Equipo />} />
                  {rutasRetiradas}
                  <Route path="entrevistas" element={<Entrevistas />} />
                  <Route path="puestos/:campaignId" element={<Dashboard />} />
                  <Route path="puestos/:campaignId/formulario" element={<Builder />} />
                  <Route path="ajustes" element={<Ajustes />} />
                  <Route path="ajustes/:seccion" element={<Ajustes />} />
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
