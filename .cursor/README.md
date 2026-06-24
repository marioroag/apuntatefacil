# Cursor Setup

This folder makes Apuntate Facil work well with Cursor agents.

## Rules

Project rules live in `.cursor/rules/` and are flat `.mdc` files with frontmatter.

- `project.mdc`: always-on project context, stack, scope, verification.
- `design-system.mdc`: UI doctrine, tokens, components, accessibility.
- `copy.mdc`: Spanish copy, glossary, ethics.
- `backend.mdc`: Supabase, multi-tenant, RLS, public form RPCs.
- `public-form.mdc`: mobile-first public form and builder constraints.
- `pricing.mdc`: plan and pricing rules.

## Skills

Project skills live in `.cursor/skills/<skill-name>/SKILL.md`.

- `apuntate-design`: visual/UX/copy workflow.
- `supabase-workflow`: migrations, RLS, edge functions, auth/store.
- `verify-before-close`: final verification checklist.
- `pr-review`: review PRs and branch changes with project standards.

## Root Agent Context

`AGENTS.md` gives Cursor-compatible agents a short entry point. `CLAUDE.md` remains the full
source of truth and wins if anything conflicts.

## Local Files To Avoid

Agents should not inspect or commit local generated state:

- `node_modules/`
- `dist/`, `dist-ssr/`, `coverage/`
- `.env`, `.env.local`, `.env.*.local`
- `.vercel/`
- `supabase/.branches/`, `supabase/.temp/`
- logs and editor folders
