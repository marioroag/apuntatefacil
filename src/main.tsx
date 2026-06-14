import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import '@fontsource-variable/inter'
import './index.css'

import { StoreProvider } from './lib/store'
import { ToastProvider } from './components/ui/Toast'
import { Landing } from './screens/Landing'
import { AppLayout, FirstCampaignRedirect } from './screens/AppLayout'
import { Dashboard } from './screens/Dashboard'
import { Builder } from './screens/Builder'
import { PublicForm } from './screens/PublicForm'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<FirstCampaignRedirect />} />
                <Route path="puestos/:campaignId" element={<Dashboard />} />
                <Route path="puestos/:campaignId/formulario" element={<Builder />} />
              </Route>
              <Route path="/a/:slug" element={<PublicForm />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </StoreProvider>
    </MotionConfig>
  </StrictMode>,
)
