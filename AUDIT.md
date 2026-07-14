# KAT. Codebase Audit & Frontend Design Review

**Date:** 2026-07-05
**Scope:** Full-stack review of the KAT LMS (Next.js 15 App Router) + a design audit of the public marketing frontend against the "credible maker studio for African kids/teens" brief.
**Status:** Review only. No UI code changed. Design-token plan and critique below are pending sign-off.

---

## 1. Executive Summary

KAT is a mature, multi-tenant Next.js 15 LMS with a genuinely broad feature set (curriculum gates, fellowship, payments, meetings, code execution, messaging). The backend is in good shape and has recently been hardened (Sentry, `/api/health`, env validation, rate limiting, Vitest + Playwright + Artillery). The security fundamentals. HMAC webhook verification with `timingSafeEqual`, Zod validation, R2 presigned uploads, RBAC via a messaging matrix, are implemented correctly where sampled.

The **frontend marketing surface is the weakest link against its own brief.** It reads as a competent but generic blue SaaS landing page and hits nearly every "AI-default" tell the brief warns about. There is also a concrete **bug: the intended display/body fonts (Space Grotesk / Manrope) are declared in CSS variables but never actually loaded**, so the site silently renders in system fonts.

| Area | Grade | Notes |
|---|---|---|
| Architecture & structure | A− | Clean App Router domain layout, Prisma singleton, RBAC helper pattern |
| Security | B+ | Correct primitives; a few gaps noted below |
| Testing & observability | B | Unit + E2E + load + Sentry present; thin unit coverage (`src/__tests__/lib/` only) |
| Frontend design (vs brief) | C− | Generic trust-blue SaaS; multiple AI tells; broken font loading |
| Accessibility / quality floor | B | Reduced-motion + focus ring utilities exist; gaps in contrast & tap targets |

---

## 2. Architecture Overview (how it works)

- **Rendering:** Next.js 15 App Router. Public marketing page (`src/app/page.tsx` → `LandingPage`) is server-rendered and hydrates client sections. Six role dashboards live under `/dashboard/[role]/`.
- **Auth:** NextAuth v4, JWT sessions (30-day), credentials + Google OAuth. `src/middleware.ts` only gates `/dashboard/*` for *authentication*; **authorization is enforced per-route** via `ensureRole()` / `ensureAuthenticated()` in `src/lib/rbac.ts`.
- **Data:** PostgreSQL (Neon + pgbouncer) via Prisma. Singleton client in `src/lib/prisma.ts`.
- **Storage:** Cloudflare R2, browser → presigned PUT. DB stores the object key only; URLs built at read time.
- **Payments:** Paystack. Webhook (`src/app/api/payments/webhook/route.ts`) verifies HMAC-SHA512 over the raw body before any DB write, and guards state transitions on `PaymentStatus.PENDING`.
- **Real-time:** SSE for messaging, Redis pub/sub fan-out when `REDIS_URL` is set.
- **Rate limiting:** Upstash Redis, gracefully no-ops when unconfigured (`if (limiter)` guards).
- **Observability:** Sentry (client/server/edge configs + `instrumentation.ts`), `/api/health`, `/api/cron/db-ping`.

---

## 3. Backend & Security Findings

Severity: 🔴 high · 🟠 medium · 🟡 low / polish

- 🟠 **Middleware does not enforce role, only login.** This is by design (per CLAUDE.md), but it means every `/dashboard/[role]` page and every mutating API route *must* call `ensureRole`. This is a standing correctness risk, one missed `ensureRole` in a route handler is a privilege-escalation hole. Recommend an automated test that asserts every route under `api/(admin|super-admin|instructor)` imports and calls `ensureRole`, plus a lint rule or a route-registry test.
- 🟠 **`canMessageUser` issues 2 DB round-trips per authorization check** (`Promise.all` of two `findUnique`), plus a third for mentorship. For a messaging hot path this is fine at current scale but will show up under the Artillery soak test; consider caching role/org on the JWT (already partially there via `session.user.role`) to avoid re-fetching the sender.
- 🟡 **Webhook comment is misleading.** `export const dynamic = "force-dynamic"` is commented as "Disable body parsing so we can read the raw body". `force-dynamic` doesn't do that; reading `await request.text()` is what preserves the raw body. Harmless, but the comment should be corrected so nobody "fixes" it wrongly.
- 🟡 **`generateReceiptNumber()` uses `Math.random()`** for the receipt suffix. Collisions are astronomically unlikely at 6 base36 chars, but `paymentReceipt` has a unique constraint on `receiptNumber` and the `upsert` won't retry on a collision, it would throw. Use `crypto.randomUUID()`-derived suffix for guaranteed uniqueness.
- 🟡 **`validateRequiredEnv()` omits several vars the app hard-depends on** (`NEXTAUTH_URL`, `PAYSTACK_SECRET_KEY`, `R2_PUBLIC_URL`). It validates 6 of them; consider covering the full "app won't function" set, or documenting why the others are optional.
- 🟡 **Legacy Vite artifacts still in the repo:** `index.html`, `src/index.css` (which `@import`s Google Fonts Inter), `tsconfig.app.json`, `tsconfig.node.json`, `dist/`. These are dead in an App Router build and are a source of confusion (see the font bug in §4). Recommend deleting.

*Depth note:* backend was sampled (middleware, rbac, payments webhook, env, ratelimit), not exhaustively read. The above are representative, not a complete list.

---

## 4. Frontend Design Audit vs. Brief

**Brief restated:** KAT should read as a *credible maker studio for African kids/teens (8–19)*, not generic SaaS, not a cartoonish kids' site. Restrained everywhere, bold on ONE signature element. Maintain a responsive/accessible quality floor.

### 4.1 🔴 Blocking bug: the brand fonts are never loaded

`globals.css` defines `--font-space-grotesk` and `--font-manrope`, and components apply them via `[font-family:var(--font-space-grotesk)]`. But **nothing loads these fonts**, there is no `next/font` import, no `@font-face`, no Google Fonts `<link>` in `layout.tsx`. The only web-font import in the repo is `src/index.css` (legacy Vite, not imported by App Router) pulling **Inter**. Meanwhile `tailwind.config.js` sets `fontFamily.sans: ['Inter', …]` and `<body className="font-sans">`.

**Net effect on a real user:** headings fall through `Space Grotesk → Inter → Segoe UI` and land on **Segoe UI** (Windows) / system default; body falls through `font-sans → Inter` → also system default, because Inter isn't loaded in the App Router either. The site the team *designed* (Space Grotesk / Manrope) is not the site that *ships*. Any font decision in the token plan below must include an actual loading mechanism (`next/font/google` or self-hosted `@font-face`).

### 4.2 AI-default tells, verdict per item

| Tell | Present? | Where | Verdict |
|---|---|---|---|
| Stat row under hero | **Yes** | `stats-bar.tsx` directly follows hero; **duplicates** the 4.9 / pass-rate / enrollments already shown *inside* the hero | **Replace.** Redundant and generic. Fold the real numbers into one place; if kept, make it the signature (see §5). |
| 01/02/03 numbering | **Yes (×2)** | `how-it-works-section.tsx` steps `01/02/03` *and* `features-section.tsx` prints `0{index+1}` on every card | **Replace/thin.** Keep numbering in *one* place (the process), drop it from feature cards. |
| 3-card icon feature grid | **Yes** | `features-section.tsx`, 6 cards (2×3) each with a colored icon chip | **Replace.** Textbook SaaS. Reframe as maker outcomes, not feature bullets. |
| rounded-2xl bordered cards | **Yes, everywhere** | `.kat-card`, features, stats, how-it-works, hero preview | **Restrain to one radius system.** Deliberate is fine, but the uniform `rounded-2xl + border + soft shadow` on *everything* is the tell. Vary hierarchy. |
| Gradient-blob backgrounds | **Yes (×2, stacked)** | `landing-page.tsx` renders 3 radial blobs **and** `globals.css body` paints 3 more | **Replace.** Two blob systems compound the generic feel. Kill both; replace with the signature surface. |
| Ghost + solid button pair | **Yes** | Hero: solid gradient "Enroll" + outline "View Tracks"; pattern repeats | **Justify but restyle.** A primary + secondary CTA is legitimate UX; the *gradient-fill + outline* execution is the tell. Keep two actions, change the treatment. |
| Default fonts | **Yes (by accident)** | See §4.1 | **Replace.** Actually load a distinctive, non-Inter/Geist/Poppins pairing. |
| Trust-blue | **Yes, entirely** | `#132B5E / #1E5FAF / #4DB3E6`, the whole palette is corporate blue + a blue-cyan gradient | **Replace as the primary.** This is the single biggest "generic SaaS" signal. Blue can stay as a supporting/UI color, but it should not be the brand's whole identity. |

### 4.3 Other observations

- **The hero "dashboard preview" mockup** (fake student dashboard with window chrome) is the current de-facto signature, but a product screenshot is itself a SaaS trope, and it shows a *dashboard*, not *making*. Consider repurposing the boldness budget into something that says "kids build real things."
- **Everything competes for attention:** gradient text on multiple headings, gradient buttons, gradient sidebar highlight, colored icon chips in 6 hues, amber stars, emerald badges. The brief asks for restraint everywhere and boldness in *one* place; currently boldness is sprayed across the page.
- **`framer-motion` page-transition wrapper** in `providers.tsx` runs on every navigation, verify it's inside the reduced-motion guard (the CSS `@media (prefers-reduced-motion)` block zeroes `transition-duration`, but framer's JS animations are driven by JS, not CSS, so they are **not** covered by that media query). This is an accessibility gap.

---

## 5. Design-Token Plan (proposed, pending sign-off)

Each choice is justified against "credible maker studio for African kids/teens, not SaaS, not cartoonish."

### 5.1 Color, 5 named hexes

Move off all-blue. Anchor on a warm, grounded, distinctly-not-corporate palette with one high-energy maker accent.

| Token | Hex | Role | Why |
|---|---|---|---|
| `--kat-ink` | `#1A1714` | Text / near-black | Warm off-black (not slate-900 blue-black). Reads as print/editorial, not dashboard. |
| `--kat-clay` | `#C64B27` | **Primary / brand** | Terracotta/clay, warm, African-earth reference, energetic without being childish. Replaces trust-blue as the identity color. |
| `--kat-sun` | `#F2B705` | Accent (sparingly) | Warm gold for highlights/CTAs-in-context. Confident, not neon. |
| `--kat-paper` | `#F4EEE2` | Background surface | Warm paper/canvas instead of cold `#F5F7FA`. Signals "studio/workbench," not "app chrome." |
| `--kat-pine` | `#1F5C4A` | Secondary / success | Deep green for balance, secondary CTAs, "verified/passed" states. |

Blue is *retired as the brand color* and kept only as a neutral UI utility if needed. Semantic states: reuse `--kat-pine` for success, `--kat-sun`→amber for warning, a restrained brick for danger.

**Contrast check to run before shipping:** clay `#C64B27` on paper `#F4EEE2` and white, verify ≥ 4.5:1 for text, ≥ 3:1 for large text/UI. Clay is likely used for fills + large type, ink for body.

### 5.2 Type, display + body + mono (none are Inter/Geist/Poppins)

| Slot | Face | Why |
|---|---|---|
| **Display** | **Clash Display** (or **Bricolage Grotesque** as a Google-hosted alt) | Characterful, slightly editorial grotesk with personality, reads "creative studio," not "SaaS." Distinct letterforms carry the single-signature boldness. |
| **Body** | **Fraunces** *(soft, optical serif)*, or if a sans is required, **Hanken Grotesk** | A warm serif for body copy is a strong anti-SaaS move and stays credible/legible for teens + parents. Choose one direction and commit. |
| **Mono** | **JetBrains Mono** | We teach code, a real, opinionated mono in code/label contexts reinforces "maker," and is a legitimate signature surface for numbers/labels. |

**Non-negotiable:** whichever faces are chosen must be **actually loaded** via `next/font` (self-hosting the variable fonts), fixing the §4.1 bug is part of this plan, not separate from it.

### 5.3 Layout concept

**"Workbench / build log," not "SaaS landing."**
- A visible structural grid with a **left rule/margin and monospace section labels** (`01 · INTAKE`, `02 · BUILD`, `03 · SHIP`), numbering used *once*, as an editorial device, not on cards.
- Asymmetric hero (not centered-hero-with-stat-row); content left, an artifact of *student work* right (a real project card / build), not a fake dashboard.
- Sections separated by rules and generous whitespace on warm paper, rather than floating rounded cards on gradient blobs. Cards, where used, get flatter treatment (hairline rule, minimal shadow, mixed radii by hierarchy).

### 5.4 ONE signature element (spend the boldness here)

**The "Build Log" ticker / maker-marquee:** a bold, oversized, horizontally-scrolling (reduced-motion: static) strip in Clash Display + JetBrains Mono showing *real things kids shipped*. "TEMI, 11 · shipped a maze game" / "AISHA, 15 · deployed a portfolio API." It is the emotional core (kids build real things), it is genuinely distinctive, and it absorbs the entire boldness budget so the rest of the page can stay restrained.

*Alternative if a marquee is too much:* an oversized numbered "build log" hero panel with a hand-annotated project artifact.

### 5.5 Quality floor (must hold through the redesign)

| Requirement | Current state | Action |
|---|---|---|
| Responsive to mobile | Mostly OK; `kat-page` + safe-area handling is thoughtful | Keep; verify signature element degrades to static on small screens |
| Visible keyboard focus | `.kat-focus-ring` exists but is opt-in; shadcn Button/Input have rings | Audit non-shadcn interactive elements; ensure every one has a visible focus style |
| Reduced motion | CSS `@media` guard exists **but does not cover framer-motion JS** (page transitions, any `motion.*`) | Gate framer animations behind `useReducedMotion()`; make the signature marquee static under reduced-motion |
| Color contrast | Trust-blue passes; new warm palette **unverified** | Run contrast checks on clay/sun/paper combos before merge |

---

## 11. Backend hardening (§3/§6.8, shipped)

- **Authorization route-registry test**. `src/__tests__/security/route-authorization.test.ts`. Walks every `route.ts` under `src/app/api`, selects those with a privileged path segment (`admin`/`super-admin`/`instructor`), and asserts **every exported HTTP handler** (`GET/POST/PUT/PATCH/DELETE`) contains a recognized authorization guard. Notes: (a) matched to the codebase's *real* vocabulary. `ensureRole` / `ensureSuperAdmin` / inline `!== UserRole.*` / `ADMIN_ROLES.includes`, since the routes don't literally call `ensureRole`; (b) two invite-`accept` routes are token-authorized and explicitly allowlisted, and the allowlist itself is guarded (each entry must exist and reference a hashed token, so it can't be used to skip a role gate); (c) it fails vacuously-safe (asserts >0 privileged files found). **Verified it actually catches a regression** by dropping in an unguarded `api/admin/__probe` route → test failed with a precise message → removed. Any future `api/admin/*` or `api/instructor/*` route is auto-covered.
  - *Lint rule:* deferred. Expressing "every handler body calls a guard" needs a custom AST ESLint plugin; `no-restricted-syntax` can't scope to function bodies. The per-method test is a stronger, more precise guarantee, so a weaker lint duplicate isn't worth the maintenance. Recommended future cleanup: consolidate the guards onto a single `ensureRole`/`ensureSuperAdmin` import so a lint rule (or the test) can key on one symbol.
- **`generateReceiptNumber()`**, was duplicated verbatim in 3 payment routes using `Math.random()`. Centralized into `src/lib/payments/receipt.ts` using a `crypto.randomUUID()`-derived 8-hex suffix (collision-resistant; `receiptNumber` is UNIQUE and callers `upsert` without retry). All three routes now import it.
- **`validateRequiredEnv()`**, widened to also require `NEXTAUTH_URL`, `R2_PUBLIC_URL`, `PAYSTACK_SECRET_KEY` (all present in the current env, so startup is unaffected); added a documented list of feature-gated vars explaining why the rest are optional. Added the missing **R2 block + `PAYSTACK_WEBHOOK_SECRET`** to `.env.example`.
- **Webhook comment**, corrected: `force-dynamic` opts out of caching; the raw body is preserved by `await request.text()` (App Router doesn't pre-parse the body, nothing to "disable").

Verified: full Vitest suite **207 passing** (incl. the new 8), `tsc --noEmit` clean, `eslint` clean.

**`canMessageUser` JWT-caching (optional perf), investigated, not warranted.**
Measured `canMessageUser` latency directly against the live DB (40 iterations/case) rather than the stock soak, because (i) the function is only reachable via `POST /api/messages`, which sits behind a 10-req/10s-per-user limiter, so a single-user soak can't drive it, and (ii) the soak's scenarios never call it.

Results (local machine → remote Neon, so absolute numbers are **WAN-round-trip-bound, not production**): 3-round-trip case (student→fellow) avg ~2864 ms; 2-round-trip cases ~1400–1560 ms. Latency scales **linearly with round-trip count** → the cost is 100% network round-trips (indexed `findUnique`s, no query-compute concern), and each round-trip here is ~300–1400 ms of WAN latency (≈1–5 ms in a co-located prod deploy).

Conclusion: the optimization removes exactly **one** round-trip (the sender lookup), so its value is `1 × (app↔DB RTT)`, negligible in a normal co-located deployment, and where app↔DB latency is high the correct fix is co-location, not micro-caching one of three lookups. The per-user rate limiter also caps this path, so it's never a throughput hot spot. **Not implementing;** it isn't worth the JWT-staleness trade-off (stale role/org on an authorization check). A representative Artillery soak, if desired, should run from the deployed/CI environment (co-located with Neon), the token-mint + `/api/messages` scenario plumbing is proven and ready to wire in.

---

## 12. Real-data wiring for the signature sections (shipped)

The marquee/hero/testimonials only beat a template if the people and projects are **real**. They previously used invented data (`Temi, 11 · maze game`, `Adaeze O.`, etc.), which is the exact "generic template" failure. Fixed by making all three **data-driven, with honest empty states and zero placeholder fallback**:

- **Build-Log marquee** + **hero artifact** now render from `getRealBuilds()` in `page.tsx`. `prisma.project` where `status = APPROVED` (the same gate `/showcase` uses), mapping real `student.firstName` + `title` + `program`. Marquee returns `null` when there are none; the hero artifact shows the latest real build as a maker "manifest" (project / builder / track / approved), or a **non-attributed** empty state ("Real builds ship here…"), never an invented name.
- **Testimonials**, removed the invented `TESTIMONIALS` fallback entirely; the section renders only real `APPROVED` testimonials from the DB and **hides itself** when there are none.
- Deleted the now-dead invented arrays (`TESTIMONIALS`, `SCHEDULE_ROWS`, `SIDEBAR_ITEMS`) from `landing-tokens.ts`.
- Verified in-browser: with the current DB the hero correctly surfaces the real row, which is itself **QA gibberish** (`Add jhhbvervbbbb` by `Sade`), and the one approved testimonial is the keyboard-mash `Peter Parent`.

**⚠️ Data action required (owner, not code):** the only remaining "placeholder" is now *in the database*, not the app. Delete/clean the QA rows and approve real student projects + real parent testimonials, the landing page will surface them automatically. Nothing on the page is fabricated anymore; it is a faithful mirror of the DB.

Verified: `tsc --noEmit` clean, `eslint` clean.

---

## 6. Prioritized Recommendations

1. **Fix font loading** (🔴), load the chosen faces via `next/font`; delete legacy `index.css`/`index.html`/`dist`.
2. **Re-platform the brand color** off trust-blue onto the warm palette (§5.1).
3. **Kill both gradient-blob systems**; adopt the paper + rule layout.
4. **De-duplicate the stats** (hero vs stats-bar) and reduce `01/02/03` to a single editorial use.
5. **Reframe the 6-card feature grid** into maker outcomes; drop per-card numbering.
6. **Build the one signature element** and keep everything else restrained.
7. **Close accessibility gaps:** framer reduced-motion, focus visibility on custom controls, contrast.
8. **Backend polish:** receipt-number generation, `validateRequiredEnv` coverage, route-level `ensureRole` test harness, webhook comment.

---

---

## 7. Implementation Status (landing page, shipped in this pass)

Approved directions: **Fraunces** body · **landing page only** · **Build-Log marquee** signature.
Display face substituted to **Bricolage Grotesque** (Google-hosted; Clash Display isn't on Google Fonts and no font files were available to self-host).

| Item | Done |
|---|---|
| Fonts actually loaded via `next/font` (`--font-display` Bricolage, `--font-body` Fraunces, `--font-mono` JetBrains Mono), fixes §4.1 | ✅ `layout.tsx`, `globals.css`, `tailwind.config.js` |
| Trust-blue retired → warm clay/sun/paper/pine/ink palette; new tokens promoted to `:root` | ✅ `landing-tokens.ts`, `globals.css` |
| Both gradient-blob systems removed → warm paper + faint blueprint grid | ✅ `landing-page.tsx` |
| Redundant stat-row deleted (`stats-bar.tsx` removed); numbers live once, in the hero | ✅ |
| `01/02/03` reduced to a single editorial use (how-it-works); per-feature-card numbering dropped | ✅ |
| 6-hue icon-chip grid → flat, rule-divided, monochrome maker grid (features + events) | ✅ |
| Gradient text/buttons → solid clay; ghost+solid CTA pair → solid + text-link | ✅ hero, header, cta, how-it-works |
| Signature **Build-Log marquee**, oversized display + mono, static under reduced-motion (`motion-reduce:*`) | ✅ `build-log-marquee.tsx` |
| Hero fake dashboard → a shipped **build artifact** (code + "Shipped by Temi, 11") | ✅ |
| framer-motion page transition now respects `useReducedMotion()` | ✅ `providers.tsx` |
| All below-fold sections converted (tracks, pricing, fellowship, testimonials, faq, enrollment-chat, footer) | ✅ |
| Verification | ✅ `tsc --noEmit` clean · `eslint` clean on changed files |

**Contrast QA, done (WCAG AA):** All palette pairings verified with a computed contrast script. One adjustment made: brand clay darkened `#C64B27 → #B2401D` so small clay text on paper (4.10 → 4.99) and the paper-on-clay button label (4.10 → 4.99) clear AA, while still passing 3.0 large-text on ink (3.10). Three dark-background small-text spots repointed (marquee meta/label → `white/50–55`, hero syntax token → `#E8825A`, weekly-reviews badge → `#7a5f00`). **17/17 combinations pass.**

## 8. Dashboard palette extension (follow-up pass, shipped)

Extended the warm palette off the landing page into the app itself:

- **shadcn HSL tokens retuned** (`:root` + `.dark`) from trust-blue to warm clay/paper/stone, this repoints every primitive (buttons, inputs, cards, dropdowns, rings, muted text, borders) across all dashboards in one place.
- **Global utility classes warmed**: body radial gradients, `.kat-chip`, `.kat-focus-ring`, and all `.kat-date-input` blue accents (hex, rgba, and inline SVG picker strokes, light + dark).
- **Tailwind `kat.*` palette** + `shadow-kat/kat-lg` navy → ink.
- **Hardcoded utilities mapped** across 63 dashboard files + 19 auth/public pages: `blue|sky|indigo|cyan-*` → `orange-*` (warm clay family; `amber` left free for warnings), and `#1E5FAF/#132B5E/#0D1F45/#4DB3E6` → clay/ink/light-clay. **~600 utility occurrences + 86 hex literals, 0 remaining.**
- One already-customized `ui/select.tsx` primitive warmed (its bespoke sky focus ring would otherwise be a blue tell in every dropdown).
- Removed a dead `challenges-panel.tsx.bak`.
- Verified: `tsc --noEmit` clean, `eslint` clean on the full converted surface.

*Note:* dashboard accent utilities map to Tailwind `orange` (same lightness steps), which is slightly more vivid than the muted brand clay used for chrome/tokens. If any specific accent reads too hot, it can be nudged to `orange-700/800` individually, the brand primary itself (buttons/rings) is the exact clay via the tokens.

## 9. In-browser visual QA (dev server + Playwright/Chromium)

Ran the dev server and captured real screenshots (landing desktop/full/mobile, login, register).

**Confirmed working:** brand fonts actually load (Bricolage display / Fraunces serif body / JetBrains mono); warm clay/paper/ink palette throughout; hero build-artifact; Build-Log marquee; flat monochrome feature grid; `01/02/03` on ink; clay progress bars; warm login/register split panels and shadcn form primitives. Mobile is responsive and stacked. No trust-blue in the chrome.

**Fixed during QA:** three stray custom blue hexes the family-swap didn't catch (`#162D5E`, `#1A4F8F`, `#1A52A0`, pre-shadcn primary-button base/hover) across 16 dashboard + auth files → warm.

## 10. Logo recolor + warm-neutral (stone) pass, shipped

- **Logo mark warmed** (owner-approved: ink base): `public/kindle-a-techie.svg`, orange flame + sparks kept; the three blue petal gradients remapped to a warm ink ramp (`#7A6D5E → #1A1714`) and the `#0B1A3B` navy cutouts → warm near-black `#12100D`. Verified in-browser on both light footer and dark login panel.
- **Full slate → stone pass** (owner-approved): every cool `slate-*` neutral → warm `stone-*` across **164 files**, plus slate hex literals (`#0F172A/#334155/#475569/#64748B/#E2E8F0/#F8FAFC/…` → stone equivalents) and `globals.css`. Used a word-boundary swap (`\bslate-`) to avoid corrupting `-translate-*` utilities, verified no `transtone` breakage. `tsc` + `eslint src` clean.

**Known remaining (minor):**
- **Raster app icons** (`public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) are still the old blue mark, they're PNGs, need regenerating from the updated SVG (design-tool step, not code).
- ~~Legacy dead `src/index.css` still holds slate/Inter, recommend deleting~~ **Done:** deleted the legacy Vite artifacts (`src/index.css`, `index.html`, `tsconfig.app.json`, `tsconfig.node.json`, `dist/`); `tsconfig.json` was self-contained so `tsc`/build unaffected.
- Monaco code-editor theme colors (`#1E1E1E/#252526/#2D2D2D`) intentionally left (editor chrome).
- Auth-gated dashboards validated by code + the shadcn primitives shown on login/register, not screenshotted (login needs Turnstile/DB).

**Verified:**
- `npm run build` (production `next build`) **passes**, full route manifest emitted, `next/font/google` fetch succeeds (Bricolage/Fraunces/JetBrains resolve in prod), Prisma generate + build-time type/lint checks clean.

**Follow-up:**
- Regenerate the PNG app icons from the recolored SVG (design-tool step).
- Optional: trim `/dashboard/messages` first-load JS (442 kB, emoji-mart/SSE, pre-existing).
- Dashboards (`/dashboard/*`) intentionally untouched, still on the old blue/Inter system; a later pass can inherit the now-global `--kat-*` tokens.
- Backend polish items in §3 remain open.

*Design token plan and critique (§4–5) were presented and approved before any UI code was written.*
