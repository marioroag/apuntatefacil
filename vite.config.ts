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
    // `?raw` sobre un .css devuelve cadena VACÍA con el ajuste por defecto de
    // vitest (`css: false` stubea los imports de CSS). El guardián del acabado
    // (src/lib/acabado.test.ts) lee index.css para sacar de ahí el vocabulario de
    // sombras y duraciones en vez de copiarlo, así que sin esto sus detectores de
    // coherencia pasaban SIEMPRE, en verde y sin comprobar nada. Ningún otro test
    // importa CSS, así que el coste es cero.
    css: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Las edge functions son Deno y se prueban con `deno test`: sus imports
      // (jsr:, npm:) no los resuelve vitest. Con comodín delante porque también
      // aparecen dentro de los worktrees.
      '**/supabase/functions/**',
      // Los worktrees de git viven DENTRO del checkout principal, así que sin
      // esto `npm test` en main ejecuta además los tests de todas las ramas
      // abiertas: 19 ficheros en vez de 5, y fallos que no son de main.
      '**/.claude/worktrees/**',
    ],
  },
})
