# Empieza aquí: publicar Apúntate Fácil (paso a paso)

Dos fases. **Fase 1**: dejar la web EN VIVO con el login funcionando. **Fase 2**: Stripe, que va **después** de publicar (como debe ser: el webhook necesita la URL pública).

Leyenda:
- 👉 **TÚ** = un clic en una web del navegador.
- 🤖 **YO** = lo hago por terminal en cuanto me digas "listo". Tú solo tecleas 2 comandos de "login" que abren el navegador.
- 📋 = valores que me pegas en el chat para que yo siga.

---

## FASE 1 — Publicar

### Paso 1 · Crea el proyecto de Supabase 👉 TÚ (3 min)
1. Entra en https://supabase.com/dashboard → botón verde **New project**.
2. Nombre `apuntate-facil`. **Region**: `Central EU (Frankfurt)`. Genera y guarda la **Database Password**. Crea.
3. Cuando esté montado (1-2 min): **Project Settings → General** → copia el **Reference ID** (es tu `<ref>`, 20 letras).
4. **Project Settings → Data API** → copia **Project URL** (`https://<ref>.supabase.co`).
5. **Project Settings → API Keys** → copia la clave **`anon` / `public`** (NO la `service_role`).
6. 📋 **Pásame**: Project URL + anon key.

### Paso 2 · Conéctate una vez y yo subo el backend 👉 TÚ + 🤖 YO
1. 👉 En tu terminal, dentro de la carpeta del proyecto: `supabase login` (se abre el navegador, autorizas). Dime **"listo"**.
2. 🤖 YO: enlazo el proyecto (`link`), subo el esquema (`db push`) y las funciones (`functions deploy`), y te doy la **Callback URL** que necesitarás para Google.

### Paso 3 · Resend (los emails) 👉 TÚ
1. https://resend.com → crea cuenta (puedes con Google).
2. **Domains → Add Domain** → `apuntatefacil.com`. Resend te muestra unos registros DNS (MX, SPF, DKIM). Cópialos **tal cual** en el panel DNS de donde compraste el dominio. Pulsa **Verify**. (Tarda de minutos a un par de horas.)
3. **API Keys → Create API Key** → cópiala (`re_...`). ⚠️ Solo se ve **una vez**.
4. 📋 **Pásame** la API key (o, si prefieres, la guardo con un comando que te doy).

### Paso 4 · Google (entrar con Google) 👉 TÚ
Usa la **Callback URL** que te di en el paso 2 (`https://<ref>.supabase.co/auth/v1/callback`).
1. https://console.cloud.google.com → arriba, selector de proyecto → **NEW PROJECT** → nombre `Apuntate Facil` → créalo y selecciónalo.
2. Busca arriba **"Google Auth Platform"** (es lo que antes se llamaba "OAuth consent screen") → **Get started** → App name `Apuntate Facil`, tu email, **Audience: External**, crea.
3. Menú **Clients → Create client** → **Web application** → en **Authorized redirect URIs** pega la **Callback URL** (letra por letra) → **Create**.
4. Copia **Client ID** y **Client secret**.
5. 📋 **Pásame** Client ID + secret (o pégalos tú en Supabase en el paso 5).

### Paso 5 · Configura el login en Supabase 👉 TÚ (dashboard). Lista exacta:
En el proyecto Supabase → **Authentication**:
- **Sign In / Providers → Email**:
  - `Minimum password length` = **10**
  - `Password Requirements` = **"Lowercase, uppercase letters and digits"** ⚠️ (NO la de símbolos: tiene que coincidir con lo que pide la app, o el registro fallará)
  - `Confirm email` = **ON**
  - (`Prevent use of leaked passwords`: actívalo **si tu plan es Pro**. En el plan Free no aparece, no pasa nada, no es bloqueante.)
- **Sign In / Providers → Google**: actívalo, pega Client ID y Client Secret, **Save**.
- **Emails → pestaña SMTP** → **Enable Custom SMTP**:
  - Host `smtp.resend.com` · Port `465` · Username `resend` · Password = tu **API key de Resend** (`re_...`)
  - Sender email `no-reply@apuntatefacil.com` · Sender name `Apúntate Fácil` · **Save**
- **URL Configuration**: Site URL y Redirect URLs → **te los digo yo** según dónde publiquemos (primero la `.vercel.app`, luego `apuntatefacil.com`).

### Paso 6 · Publica la web 👉 TÚ (login) + 🤖 YO (deploy)
1. 👉 `npm i -g vercel` y luego `vercel login` (abre el navegador). Dime **"listo"**.
2. 🤖 YO: pongo las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (las del paso 1) y despliego. Te doy la URL `.vercel.app`: **tu web en vivo**.
3. Probamos juntos: entrar con Google (funciona ya) y, si el dominio de Resend ya verificó, registro con email + confirmación.

### Paso 7 · Tu dominio 👉 TÚ (cuando quieras)
1. Vercel → tu proyecto → **Settings → Domains → Add** → `apuntatefacil.com`. Crea los DNS que te muestre. Cuando ponga **Valid** (verde), listo con HTTPS automático.
2. 🤖 YO: actualizo en Supabase el Site URL/redirect y el `APP_URL` a `apuntatefacil.com`.

✅ **Fin de Fase 1: web publicada y login funcionando.**

---

## FASE 2 — Stripe (SOLO con la web ya publicada)

Empieza todo en **modo Test** (arriba a la derecha, interruptor "Test mode" ON). No cobra dinero real.
1. **Product catalog** → crea 3 productos con precio **Recurrente / Mensual / EUR**: `Esencial` 150, `Pro` 250, `Multi` 450. De cada uno copia su **Price ID** (`price_...`, con los `...` → "Copy price ID").
2. **Developers → API keys** → copia la **Secret key** (`sk_test_...`).
3. **Developers → Webhooks → Add endpoint** → URL `https://<ref>.supabase.co/functions/v1/stripe-webhook` → marca **exactamente** estos 4 eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` → crea → abre el webhook → copia el **Signing secret** (`whsec_...`).
4. 📋 **Pásame los 5 valores** (3 price_, 1 sk_test_, 1 whsec_). 🤖 YO los guardo en Supabase con `supabase secrets set`.
5. Cuando funcione en Test, repites lo mismo en **modo Live** (`sk_live_`, productos y webhook nuevos) para cobrar de verdad.

---

## Para empezar AHORA mismo
Solo necesito que hagas el **Paso 1** (crear el proyecto Supabase y pasarme **Project URL + anon key**) y el `supabase login` del **Paso 2**. Con eso ya subo el backend y vamos avanzando uno a uno. No tienes que hacerlo todo de golpe.
