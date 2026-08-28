# Apuntate Facil - Agent Guide

This repository is optimized for Cursor agents.

## Source of Truth

- `CLAUDE.md` is the full project doctrine and wins if anything conflicts.
- `.cursor/rules/*.mdc` contains Cursor-scoped rules for project, design, and pricing (copy/backend/public-form live in `CLAUDE.md` and the skills).
- `.cursor/skills/*/SKILL.md` contains task workflows for design, Supabase, verification, and PR review.

## Product Scope

Apuntate Facil automates hiring flows from Milanuncios-style ads:

- `/`: marketing landing.
- `/app/puestos/:id`: candidate database panel.
- `/app/puestos/:id/formulario`: form builder and live preview.
- `/a/:slug` and `/:marca/:slug`: the public job page (the ad, plus the candidate form via `?apuntarse`).

Do not add features outside these surfaces without asking Mario first.

## Stack

- Frontend: Vite, React, TypeScript, Tailwind v4.
- Backend: Supabase, Postgres, Auth, Storage, RLS, Edge Functions.
- Router: react-router.
- Deploy: Vercel.

## Non-Negotiables

- Brand name is defined in `src/lib/brand.ts`.
- Design follows the "Instrumento de precision" doctrine: premium, sober, neutral SaaS.
- Ultramarine `#3b4fe4` is only for action, focus, and selection (not active nav since ago 2026).
- Candidate statuses use `STATUS_META` in `src/lib/types.ts`; `descartado` is never red.
- Public form is mobile-first, validates on blur/submit, and never clears candidate input on failed submit.
- Public anonymous Supabase access goes through RPCs, not direct table access.
- Verify visible changes in browser before closing.

## Commands

```bash
npm install
supabase start
cp .env.example .env.local
npm run dev
npm run build
npx tsc -b --noEmit
npm test          # includes the "guardian" tests: they fail when new code breaks a house rule
```

Always run commands from the repo root:

```bash
cd /Users/mario/criba
```

## Cursor Skills

- `/apuntate-design`: UI, UX, visual polish, copy, tokens, accessibility.
- `/supabase-workflow`: migrations, RLS, RPCs, edge functions, auth/store.
- `/verify-before-close`: final verification checklist.
- `/pr-review`: PR and branch review using project standards.
