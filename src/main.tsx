import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import '@fontsource-variable/inter'
import './index.css'

import { AuthProvider, DemoAuthProvider } from './lib/auth'
import { StoreProvider } from './lib/store'
import { ToastProvider } from './components/ui/Toast'
import { AuthGate } from './components/AuthGate'
import { Landing } from './screens/Landing'
import { Login } from './screens/Login'
import { AppLayout, FirstCampaignRedirect } from './screens/AppLayout'
import { Dashboard } from './screens/Dashboard'
import { Builder } from './screens/Builder'
import { Plan } from './screens/Plan'
import { PublicForm } from './screens/PublicForm'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ToastProvider>
          <StoreProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/a/:slug" element={<PublicForm />} />
                <Route
                  path="/app"
                  element={
                    <AuthGate>
                      <AppLayout />
                    </AuthGate>
                  }
                >
                  <Route index element={<FirstCampaignRedirect />} />
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
                  <Route path="puestos/:campaignId" element={<Dashboard />} />
                  <Route path="puestos/:campaignId/formulario" element={<Builder />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </StoreProvider>
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
)
