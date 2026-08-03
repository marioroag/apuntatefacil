---
name: pr-review
description: Reviews pull requests and local branch changes for Apúntate Fácil using the project's product, design, Supabase, copy, and verification standards. Use when reviewing PRs, branch diffs, GitHub PR URLs, code changes, or when the user asks for PR review, code review, revisar cambios, revisar PR, or review this branch.
---

# Apúntate Fácil · PR Review

Review like a senior engineer protecting a production product. Prioritize bugs, regressions,
security, data leaks, accessibility failures, broken product scope, and missing verification.
Do not turn the review into a style pass unless style creates a real product or maintenance risk.

## 1. Gather Context

If the user gives a GitHub PR URL, use `gh` to inspect it. Otherwise review the local branch or
uncommitted diff.

Useful context:

```bash
cd /Users/mario/criba && git status --short
cd /Users/mario/criba && git diff --stat
cd /Users/mario/criba && git diff
cd /Users/mario/criba && git log --oneline --decorate -10
```

For PR branches, compare against the base branch:

```bash
cd /Users/mario/criba && git merge-base HEAD main
cd /Users/mario/criba && git diff main...HEAD
```

Read the files that changed and nearby code paths. Do not review only the latest commit if the PR
contains multiple commits.

## 2. Review Priorities

Lead with findings. A good finding includes the affected file, the user-visible or data impact, a
concrete scenario, and the smallest credible fix direction.

Severity order:

- **Critical**: data leak, auth/RLS bypass, payment/security issue, destructive data loss.
- **High**: broken core flow, public form cannot submit, multi-tenant contamination, production deploy break.
- **Medium**: meaningful UX/accessibility regression, missing validation, stale state, race condition, missing migration compatibility.
- **Low**: maintainability or test gap with credible future risk.

Skip purely subjective nits. If there are no findings, say that clearly and mention residual test
or verification gaps.

## 3. Project-Specific Checks

### Scope

- The product has 4 surfaces only: `/`, `/app/puestos/:id`, `/app/puestos/:id/formulario`,
  `/a/:slug` and `/:marca/:slug`. Flag new features outside scope unless the PR clearly requested them.
- Brand source of truth is `src/lib/brand.ts`.

### UI and Design

- Ultramarine `#374cce` only for action, active nav, focus, and selection. Never decorative or status.
- Candidate status colors come from `STATUS_META`; `descartado` is never red.
- Use `BTN_*`, `Checkbox`, `CandidateModal`, `FieldRenderer`, tokens in `src/index.css`.
- Text with meaning must pass AA contrast. `slate-400` is only for icons.
- Focus visible, semantic buttons/links/tables, accessible drag alternatives.
- Motion short and sober; no springs, no decorative gradients, no stacked shadows.

### Copy and Ethics

- Spanish with tuteo, sentence case, frozen glossary: puesto, candidato, candidatura, enlace,
  estado, exportar, formulario.
- No visible em dash. No fake urgency, fake social proof, confirmshaming, or prechecked consent.
- Pro badge is "Recomendado", never "el más elegido".

### Public Form

- Mobile-first: one column, max 480px, inputs 48px high, font 16px, targets at least 44px.
- Validate on blur and submit, never while typing.
- Failed submit must not erase answers or CV.
- Public form uses customer accent via `--accent` / `--accent-contrast`, not brand ultramarine.
- Anonymous flow uses RPCs, not direct table access.

### Supabase and Backend

- Multi-tenant queries must filter by active `company_id`; RLS may return all companies for a user.
- Public anonymous access only through `get_public_campaign` and `submit_application`.
- RLS policies must prevent cross-company reads/writes, including manager site scoping.
- Migrations for production should be additive. Keep old RPC signatures while migrating live code.
- Production `db push` or destructive schema changes require Mario's explicit approval.

### Pricing and Billing

- Plans: Esencial 150 €/mes, Pro 250 €/mes, Multi 450 €/mes; annual = x10.
- Differentiate by active processes, never candidates or users.
- Stripe/webhook code must be idempotent and safe against missing secrets in local/dev.

## 4. Verification Expectations

For observable UI changes, require browser verification: capture, inspect, and test interactions.

Before considering a PR merge-ready:

```bash
cd /Users/mario/criba && npm run build
cd /Users/mario/criba && npx tsc -b --noEmit
```

Extra checks by area:

- Supabase schema: `supabase db reset` and relevant SQL tests if migrations changed.
- Public form: test failed submit persistence and successful anonymous submit.
- Auth/RLS: verify user A cannot see company B.
- Builder drag/drop: do not rely on synthetic preview for dnd-kit or Safari bugs.

## 5. Response Format

Use this structure:

```markdown
## Findings
- High: `path/to/file.tsx` — Clear bug and impact. Explain the scenario and fix direction.
- Medium: `path/to/file.sql` — ...

## Open Questions
- Question if needed.

## Test Gaps
- What was not run or what the PR still needs verified.

## Summary
Short change summary only after findings.
```

If there are no findings:

```markdown
## Findings
No blocking issues found.

## Test Gaps
List remaining verification gaps or say what was verified.
```

Keep the review concise. Findings first, ordered by severity.
