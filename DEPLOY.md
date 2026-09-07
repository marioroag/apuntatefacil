# Despliegue de Apúntate Fácil

> **Ya está desplegado y en producción** (apuntatefacil.com, con clientes y cobro reales).
> Esta guía queda como referencia de la arquitectura y, sobre todo, del mapa de **Claves**.
> El flujo del día a día: gates verdes -> `supabase db push --linked` (con `--dry-run`
> primero) -> `vercel --prod`, siempre desde `/Users/mario/criba` y con permiso de Mario.

## Arquitectura

- **Frontend**: SPA (Vite + React). Se despliega como sitio estático (Vercel, Netlify o Cloudflare Pages). La config de hosting ya está en el repo (`vercel.json` y `public/_redirects`) para que las rutas profundas (`/login`, `/app`, `/restablecer`, `/privacidad`...) carguen sin 404.
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions). Necesitas un proyecto Supabase de producción.
- **Pagos**: Stripe (una suscripción por empresa; cantidad = procesos abiertos, pago por proceso).
- **Emails**: Resend, para los avisos de nueva candidatura, las comprobaciones manuales de interés y los emails de acceso (confirmación y reset) vía el SMTP de Supabase Auth.
- **Login**: email + contraseña y Google.

---

## Claves (qué necesitas y dónde conseguirlas)

Las claves van a **tres sitios**. Distingue bien cuál es cuál.

### A) Frontend → variables de entorno del host (p. ej. Vercel → Settings → Environment Variables)

Se "hornean" al construir, así que ponlas **antes** del build.

| Variable | Valor | Dónde conseguirla |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase → tu proyecto → **Project Settings → API → "Project URL"**: https://supabase.com/dashboard/project/_/settings/api |
| `VITE_SUPABASE_ANON_KEY` | la *anon public* (o *publishable*) key | Misma página → **"Project API keys" → anon public** |

### B) Secrets de las Edge Functions (Supabase → **Edge Functions → Secrets**, o `supabase secrets set`)

| Secret | Para qué | Dónde conseguirlo |
|---|---|---|
| `STRIPE_SECRET_KEY` | cobrar | Stripe → **Developers → API keys** (`sk_live_...`): https://dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | validar el webhook | Stripe → **Developers → Webhooks → "Add endpoint"** (URL más abajo) → **"Signing secret"** (`whsec_...`): https://dashboard.stripe.com/webhooks |
| `STRIPE_PRICE_ESENCIAL` | price del plan 150 € | Stripe → **Product catalog** → crea un producto recurrente 150 €/mes → copia el **"Price ID"** (`price_...`): https://dashboard.stripe.com/products |
| `STRIPE_PRICE_PRO` | price del plan 250 € | Igual, 250 €/mes |
| `STRIPE_PRICE_MULTI` | price del plan 450 € | Igual, 450 €/mes |
| `RESEND_API_KEY` | enviar emails | Resend → **API Keys** (`re_...`): https://resend.com/api-keys |
| `NOTIFY_FROM` | remitente de los avisos | Un email de tu dominio verificado en Resend, p. ej. `Apúntate Fácil <avisos@apuntatefacil.com>`. Verifica el dominio en https://resend.com/domains |
| `APP_URL` | enlace al panel en el email | Tu URL de producción: `https://apuntatefacil.com` |
| `OPENAI_API_KEY` | Meridian (la capa de IA) | OpenAI → **API keys** (`sk-...`): https://platform.openai.com/api-keys . **Sin esta clave Meridian no analiza nada**, pero no rompe: las funciones hacen no-op silencioso. Antes de ponerla en producción hay que cerrar el RGPD (OpenAI pasa a ser subencargado del tratamiento: DPA firmado, retención cero y aviso de privacidad actualizado). |
| `OPENAI_MODEL` | opcional, modelo a usar | Por defecto `gpt-5.6-luna`. Ojo: el alias `gpt-5.6` NO es Luna, apunta a Sol. |
| `OPENAI_REASONING_EFFORT` | opcional, esfuerzo de razonamiento | Por defecto `low`, que sobra para resumir y enrutar. Valores: `none`, `low`, `medium`, `high`, `xhigh`, `max`. |

> **Importante:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase **automáticamente** en las funciones. **No los pongas tú.**

### C) Ajustes de Auth de Supabase (dashboard → **Authentication**)

| Ajuste | Valor | Dónde |
|---|---|---|
| **SMTP** (para que salgan los emails de confirmación y reset) | host `smtp.resend.com`, port `465`, user `resend`, pass = tu `RESEND_API_KEY`, remitente de tu dominio verificado | Authentication → **SMTP Settings**. **Imprescindible**: sin esto, el registro se queda en "revisa tu email" y no llega nada. |
| **Google** (login con Google) | Client ID + Client Secret | Authentication → **Providers → Google**. Las claves salen de **Google Cloud Console → APIs & Services → Credentials → "Create OAuth client ID" (tipo Web)**: https://console.cloud.google.com/apis/credentials . El **"Authorized redirect URI"** debe ser `https://<ref>.supabase.co/auth/v1/callback` |
| **Política de contraseña + filtradas** | min 10, lower+upper+digits, **"Prevent leaked passwords" ON** | Authentication → Providers → Email |
| **Confirmación de email** | ON | Authentication → Providers → Email |
| **URLs** | Site URL = `https://apuntatefacil.com`; Redirect URLs += `https://apuntatefacil.com/app` y `https://apuntatefacil.com/restablecer` | Authentication → **URL Configuration** |

---

## Pasos de despliegue (en orden)

1. **Crear el proyecto Supabase** de producción (región EU recomendada): https://supabase.com/dashboard
2. **Subir esquema y funciones** desde tu máquina:
   ```bash
   supabase link --project-ref <ref>
   supabase db push                 # aplica las migraciones
   supabase functions deploy        # sube stripe-checkout, stripe-webhook, notify-new-candidate
   supabase secrets set \
     STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... \
     STRIPE_PRICE_ESENCIAL=... STRIPE_PRICE_PRO=... STRIPE_PRICE_MULTI=... \
     RESEND_API_KEY=... NOTIFY_FROM="Apúntate Fácil <avisos@apuntatefacil.com>" \
     APP_URL=https://apuntatefacil.com
   ```
   (La config de Auth puedes empujarla con `supabase config push` o ajustarla a mano en el dashboard, sección C.)
3. **Stripe**: crea los 3 productos/precios y copia sus Price ID. Crea el webhook apuntando a
   `https://<ref>.supabase.co/functions/v1/stripe-webhook`, con los eventos:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copia el signing secret.
4. **Resend**: verifica el dominio `apuntatefacil.com` (registros DNS), crea la API key y decide el remitente. Desactiva el seguimiento de aperturas y clics para el dominio o remitente usado por las comprobaciones de interés.
5. **Supabase Auth**: SMTP de Resend, Google, política de contraseña + HIBP, confirmaciones, Site URL y Redirect URLs (sección C).
6. **Google Cloud**: crea el OAuth client (Web), pon el redirect URI de Supabase, copia client id/secret al provider de Supabase.
7. **Frontend**: conecta el repo a Vercel (build `npm run build`, output `dist`), pon `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Environment Variables, despliega y apunta el dominio `apuntatefacil.com`.
8. **Sesiones** (auditoría, sep 2026): en Supabase → Authentication → Sessions, pon **Time-box user sessions = 30 días**. Es lo que `config.toml` declara para local (`[auth.sessions] timebox = "720h"`) y NO se despliega solo: el panel manda en producción.
9. **Informes de la CSP** (auditoría, sep 2026): `vercel.json` manda los bloqueos de la CSP a la función `csp-informe` (sin JWT). Se despliega con las demás y sus informes se leen en los logs de esa función. Si cambia el project ref, cambia la URL en las dos cabeceras (`Reporting-Endpoints` y `report-uri`). Antes de endurecer una directiva, pruébala unos días en `Content-Security-Policy-Report-Only` con el mismo `report-to`.

## Gates antes de desplegar (auditoría, sep 2026)

```bash
npm ci
npx tsc -b --noEmit
npm test
npm run build
npm run audit          # npm audit --omit=dev --audit-level=high: tiene que salir limpio
# Con Deno instalado, para las funciones:
#   cd supabase/functions && deno check */index.ts
```
Las versiones de las edge functions van fijadas en cada `import` (supabase-js, stripe, svix, unpdf): subirlas es un cambio a propósito, nunca un efecto del despliegue.
   - *Netlify/Cloudflare Pages*: igual, el `public/_redirects` ya gestiona el fallback del SPA. *Otro host*: asegúrate de reescribir todas las rutas a `/index.html`.

---

## Test vs Live (Stripe)

- Para probar de punta a punta **sin cobrar de verdad**: usa las claves de **Test** de Stripe (`sk_test_...`, price IDs creados en modo Test, webhook en modo Test).
- Para **cobrar de verdad** al lanzar: cambia a las claves **Live** (`sk_live_...`, price IDs de modo Live, webhook Live) y vuelve a poner `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` con los valores Live.

---

## Comprobaciones post-deploy

- Registro con email → llega el email de confirmación real → confirmas → entras.
- "¿Olvidaste tu contraseña?" → llega el email → `/restablecer` → contraseña nueva.
- Login con Google.
- Una candidatura de prueba en el formulario público → llega el email de aviso (mira el remitente y el botón "Ver en Apúntate Fácil").
- Selecciona un candidato con email → **Comprobar interés** → llega un solo correo, ambos botones abren `/respuesta/:token` y solo **Confirmar respuesta** guarda el resultado en el panel.
- Un alta de plan con [tarjeta de prueba de Stripe](https://stripe.com/docs/testing) → el plan se activa (lo hace el webhook).
- Recargar en `/privacidad`, `/app`, `/restablecer` carga sin 404.

## Pendientes / follow-ups

- Plantillas de email de Supabase Auth en español (por defecto salen en inglés).
- El CORS de las funciones está en `*`; se puede restringir al dominio más adelante (no es bloqueante: las funciones sensibles exigen sesión).
