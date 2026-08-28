# Cursor Setup

This folder makes Apuntate Facil work well with Cursor agents.

## Rules

Project rules live in `.cursor/rules/` and are flat `.mdc` files with frontmatter.

- `project.mdc`: always-on project context, stack, scope, verification.
- `design-system.mdc`: UI doctrine, tokens, components, accessibility.
- `pricing.mdc`: pay-per-open-process pricing rules.

Copy, backend and public-form rules were folded into `CLAUDE.md` and the skills
(`apuntate-copy`, `supabase-workflow`) in ago 2026: one source, fewer stale summaries.

## Skills

Project skills live in `.cursor/skills/<skill-name>/SKILL.md`.

- `apuntate-design`: visual/UX workflow.
- `apuntate-copy` / `apuntate-pro-copy`: Spanish product copy (glossary, ethics, register).
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
