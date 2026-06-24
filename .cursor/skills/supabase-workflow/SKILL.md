---
name: supabase-workflow
description: Supabase workflow for Apúntate Fácil — local stack, migrations, RLS, security definer RPCs, edge functions, store/auth integration, and production deploy cautions. Use when touching supabase/, migrations, RLS policies, RPCs, edge functions, store.tsx, auth.tsx, or when the user mentions db reset, db push, RLS, multi-tenant, or Supabase.
---

# Apúntate Fácil · Supabase

Full-stack: Vite/React frontend + Supabase (Postgres + Auth + Storage + RLS + Edge Functions).

## Local stack

```bash
cd /Users/mario/criba
supabase start                    # Postgres + Auth + Storage + Studio (Docker)
cp .env.example .env.local        # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev                       # http://localhost:5173
```

- Emails locales: Mailpit http://127.0.0.1:54324
- Tras tocar esquema: `supabase db reset`
- Tras tocar `config.toml`: `supabase stop && supabase start`
- Edge functions locales: `supabase functions serve`

## Multi-tenant (no improvisar)

- `companies` ← `memberships` → `auth.users`. Roles: **owner / member / encargado**.
- RLS helpers: `current_user_company_ids()`, `current_user_owner_company_ids()`, `current_user_campaign_ids()` (encargado acotado por `manager_sites`).
- **RLS devuelve TODAS las empresas del usuario**, no solo la activa. El store filtra con `.eq('company_id', companyId)`. Empresa activa: `localStorage` (`apuntatefacil.activeCompany`).
- Path demo (`companyId === 'demo'`): `localStorage`, no Supabase.

## Formulario público (anon)

- **No** acceso directo a tablas. Lee `get_public_campaign(slug)`, escribe `submit_application(slug, answers, source, cv_path)` (ambos `security definer`, grant a `anon`).
- CVs: bucket privado `cvs`. Insert anon; descarga merchant con URL firmada.

## Migraciones

- Carpeta: `supabase/migrations/`. Nombres timestamp + descripción.
- **Aditivas en producción**: no romper la app en vivo. Si cambias un RPC, mantén la firma vieja mientras migras.
- Tests SQL opcionales en `supabase/tests/`.
- **Producción (`db push`)**: requiere visto bueno explícito de Mario.

## Edge functions

| Función | Auth | Para qué |
| --- | --- | --- |
| `stripe-checkout` | JWT | Sesión Stripe Checkout |
| `stripe-webhook` | sin JWT | Sync plan/subscription |
| `notify-new-candidate` | sin JWT | Email Resend al dueño |
| `send-invitation` | JWT | Invitar miembros |

Secrets (pendientes en prod): `STRIPE_*`, `RESEND_API_KEY`, `NOTIFY_FROM`, `APP_URL`. Ver `DEPLOY.md`.

Webhook local: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`

## Frontend integration

| Archivo | Rol |
| --- | --- |
| `src/lib/supabase.ts` | Cliente |
| `src/lib/auth.tsx` | Sesión, empresa activa, onboarding |
| `src/lib/store.tsx` | Caché optimista de la empresa activa |

## Checklist al tocar backend

```
- [ ] RLS probada: usuario A no ve datos de empresa B
- [ ] Store filtra por company_id activa (multi-empresa)
- [ ] RPC público sigue siendo security definer + grant anon mínimo
- [ ] Migración aditiva si va a producción
- [ ] cd /Users/mario/criba && npm run build
- [ ] cd /Users/mario/criba && npx tsc --noEmit
```

## Referencias

- Regla: `.cursor/rules/backend.mdc`
- Deploy: `DEPLOY.md`, `EMPIEZA-AQUI.md`
