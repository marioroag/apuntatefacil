// defineConfig de vitest/config para poder declarar el bloque `test`.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: process.env.PORT ? Number(process.env.PORT) : 5173 },
  // @shadcn/react es ESM puro y React le entra por peer. Si lo preempaqueta,
  // Vite le mete DENTRO su propia copia de React (chunk aparte, con otro hash)
  // y cualquier hook revienta con "Invalid hook call". Dejándolo fuera del
  // optimizador, su `import 'react'` se resuelve por el grafo normal y comparte
  // la única instancia. El `dedupe` es el cinturón por si entra otro paquete.
  optimizeDeps: { exclude: ['@shadcn/react'] },
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    // Las edge functions son Deno y se prueban con `deno test`: sus imports
    // (jsr:, npm:) no los resuelve vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'supabase/functions/**'],
  },
})
