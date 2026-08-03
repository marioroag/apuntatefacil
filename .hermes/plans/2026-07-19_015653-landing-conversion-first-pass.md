# Landing conversion first pass implementation plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make the first screen explain the concrete outcome, make the paid offer feel economically sensible before pricing, and preserve the sober, trustworthy product aesthetic.

**Architecture:** Keep the landing as a single route in `src/screens/Landing.tsx`. Reuse the existing `COST_TRUTHS` source in `src/lib/pricing.ts` rather than duplicating commercial claims in JSX. This pass deliberately avoids invented testimonials, logos or metrics: trust comes from a clearer product demonstration and transparent trial/pricing details.

**Tech stack:** Vite, React, TypeScript, Tailwind v4, React Router, Lucide.

**Current evidence:** Production is visually clean and the chat comparison works well. The main landing gap is commercial, not decorative: the hero describes a feature before the tangible hiring outcome, and pricing arrives without first making the manual alternative costly. `COST_TRUTHS` already exists but is not rendered. The browser capture also showed lower-page reveal states as very faint; this must be verified on a cold load before relying on reveals.

---

## Scope and ordering

Do these in order. **Tasks 1 and 2 are the high-leverage release.** Do not add a new illustration system, gradients, customer logos or generic SaaS cards in this pass.

### Task 1: Make the hero specific and make the free trial tangible

**Objective:** Tell visitors, in the first viewport, that they turn scattered ad replies into candidates they can choose, and what exactly “free” lets them do.

**Files:**
- Modify: `src/screens/Landing.tsx:168-195` (`Hero`)

**Step 1: Replace the generic eyebrow, headline and CTA copy.**

Use this exact copy, keeping the current layout and panel mockup:

```tsx
<span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-label font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
  Para contratar desde anuncios y mensajes
</span>
<h1 className="mt-4 text-balance text-hero font-[680] text-slate-900 sm:text-hero-lg">
  Convierte las respuestas de tu anuncio en candidatos listos para elegir
</h1>
<p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-slate-600">
  Sigue publicando en Milanuncios, WhatsApp, Instagram o donde quieras. Envía un enlace y recibe cada candidatura completa, ordenada y filtrable en un solo sitio.
</p>
```

Change the primary CTA label to `Crea tu primer puesto gratis` and preserve the demo as the secondary CTA.

**Step 2: Replace the reassurance line under the CTA.**

```tsx
<p className="mt-4 text-sm text-slate-500">1 puesto y hasta 15 candidatos gratis. Sin tarjeta ni permanencia.</p>
```

This must match `PLAN_PROCESS_LIMIT.trial` and `PLAN_CANDIDATE_LIMIT.trial`. If either pricing constant changes later, move this sentence to a small shared trial-copy constant in `src/lib/pricing.ts`; do not leave values duplicated indefinitely.

**Step 3: Ensure CTA actions do not change.**

- Primary remains a `Link` to `/login`.
- Secondary remains a `Link` to `/demo`.
- Keep the arrow and current button primitives.

**Step 4: Verify visually.**

Run:

```bash
cd /Users/mario/criba && npm run dev
```

At desktop width, verify the heading remains 3–4 readable lines maximum and that both CTA labels fit without wrapping. At 375px width, verify the primary CTA remains an easy 48px-height target and does not overflow.

---

### Task 2: Add a concise “cost of doing it manually” bridge before pricing

**Objective:** Make the visitor understand why 149 €/month is cheaper than continuing with scattered chats before seeing plan cards.

**Files:**
- Modify: `src/screens/Landing.tsx` imports at lines `17-18`
- Modify: `src/screens/Landing.tsx`, immediately before `function Pricing()` at line `816`
- Modify: `src/screens/Landing.tsx:821-831` (`Pricing`)
- Reuse: `src/lib/pricing.ts:195-223` (`COST_TRUTHS`)

**Step 1: Import the existing source of truth.**

Replace the pricing import with:

```tsx
import { COST_TRUTHS, TIERS, PLAN_CANDIDATE_LIMIT, PLAN_PROCESS_LIMIT, type Tier } from '../lib/pricing'
```

If Task 1 introduces a shared trial-copy helper, import it too.

**Step 2: Create a presentational `CostAnchor` component above `Pricing`.**

Use two equal, restrained panels. They are evidence framing, not feature cards. The first is neutral slate; the second uses a dark ink background. Do not use green/red or decorative gradients.

```tsx
function CostAnchor() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl section-x section-y">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-slate-500">Antes de comparar planes</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Contratar desordenado también tiene un coste
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
            Apúntate Fácil no sustituye dónde publicas. Evita que las respuestas se queden repartidas entre chats, llamadas y hojas de cálculo.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {COST_TRUTHS.map((truth, index) => (
            <div
              key={truth.key}
              className={index === 0
                ? 'rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-7'
                : 'rounded-2xl bg-slate-900 p-6 text-white sm:p-7'}
            >
              <h3 className={index === 0 ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-white'}>
                {truth.label}
              </h3>
              <ul className="mt-6 space-y-4">
                {truth.items.map((item) => (
                  <li key={item.lead} className="flex gap-3">
                    <Check className={index === 0 ? 'mt-0.5 size-4 shrink-0 text-slate-500' : 'mt-0.5 size-4 shrink-0 text-slate-300'} aria-hidden />
                    <p className={index === 0 ? 'text-copy-md leading-relaxed text-slate-600' : 'text-copy-md leading-relaxed text-slate-300'}>
                      <strong className={index === 0 ? 'font-semibold text-slate-900' : 'font-semibold text-white'}>{item.lead}</strong>{' '}
                      {item.text}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Step 3: Render it immediately before pricing.**

In `Landing`, change:

```tsx
<Team />
<Pricing />
```

to:

```tsx
<Team />
<CostAnchor />
<Pricing />
```

**Step 4: Audit claims before release.**

The `56 candidatos` claim needs a defendable source. Keep it only if it is based on actual internal aggregate data or an explicitly documented study. If not, replace that item with non-numeric copy, for example `Decenas de respuestas` and remove the false precision. The InfoJobs and selection-company ranges need source URLs and a “consultado en julio de 2026” footnote in the component if retained.

**Step 5: Verify visual hierarchy.**

At desktop, this bridge should fit in about one viewport, create a calm pause before pricing, and not look like a loud comparison table. At mobile, the two panels stack with readable 16px+ body text.

---

### Task 3: Make plan choice faster without changing price architecture

**Objective:** Let a visitor map themselves to the right plan in one scan.

**Files:**
- Modify: `src/lib/pricing.ts:129-183`
- Modify: `src/screens/Landing.tsx:732-779` (`PricingTierCard`)

**Step 1: Replace vague plan taglines with buyer-recognition copy.**

```ts
// Esencial
'Para contratar puntualmente sin perder respuestas'
// Pro
'Para varias contrataciones activas y trabajo en equipo'
// Multi
'Para ETTs, cadenas y equipos con varias sedes'
```

**Step 2: Promote the differentiator above the feature list.**

Keep the existing process-limit badge. Under it, add one short one-line “best for” statement only where the current plan description does not make it obvious. Do not add more bullets or reduce text size.

**Step 3: Keep all prices visible.**

The product declares “sin desde ni letra pequeña”; Multi must remain a real 499 €/month option, not a contact-sales dead end.

**Step 4: Verify pricing states.**

- Toggle monthly/annual and ensure the three price cards update.
- At desktop width, verify all three cards are fully visible and the recommended badge does not clip.
- At mobile width, switch every tier by mouse and keyboard arrow keys. Check selected tab, panel content and focus state.

---

### Task 4: Verify and fix cold-load reveal reliability

**Objective:** Ensure no important section renders invisible or faded on a first load.

**Files:**
- Inspect/possibly modify: `src/screens/Landing.tsx:41-49` (`Reveal`)
- Inspect: global CSS containing `@keyframes reveal-up`

**Step 1: Reproduce on a cold load.**

Open a fresh private/incognito session at `/`, then immediately scroll to Features and Pricing. Repeat with cache disabled if possible.

**Acceptance criterion:** all text and every pricing card becomes fully opaque within 500ms of initial page load. No content stays in the `animation-fill-mode: both` initial state.

**Step 2: If reproducible, remove delayed reveal from commercial sections.**

Static content below the fold should not depend on mounted animations. The safe fallback is to render `Features`, `CostAnchor`, `Pricing`, `Faq`, and `FinalCta` without `Reveal`, retaining only button hover/focus microinteractions. This respects reduced-motion users and prevents a conversion-critical blank section.

**Step 3: Verify.**

```bash
cd /Users/mario/criba && npx tsc --noEmit && npm run build
```

Expected: both commands exit 0. Then verify the landing in the browser at 375px, 768px and desktop width.

---

## Out of scope for this pass

- Fabricated testimonials, customer logos, counters or completion-rate claims.
- A complete redesign of the established sober visual system.
- New backend functionality or pricing/Stripe changes.
- Broad SEO work.

## Release checklist

- [ ] Hero identifies the tangible outcome and trial allowance.
- [ ] Every commercial claim is sourced or reframed without fake precision.
- [ ] Cost anchor appears before price cards and remains visually restrained.
- [ ] Monthly and annual pricing work on desktop and mobile.
- [ ] Cold-load visual test shows no faded or missing commercial content.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` passes.
- [ ] Screenshots reviewed at mobile and desktop widths.
