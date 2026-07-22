# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Writing & Copy Style (read before writing ANY text)

Applies to everything you produce: user-facing UI copy, code comments, commit messages,
docs, PR descriptions, and chat replies.

**No em-dashes. This is a hard rule.** Never use the em-dash (`—`, U+2014) as punctuation,
anywhere. It is the single clearest AI-writing tell. Rewrite with a comma, a period, a colon,
or parentheses. If a sentence seems to need an em-dash, it is two sentences. The app `src/` was
scrubbed of em-dashes once already (commit `a32d01f`) and is currently at zero; keep it that way.

**En-dashes (`–`, U+2013) only in numeric or date ranges** (`8–19`, `Primary 1–3`, a start date
`–` an end date), never as sentence punctuation. Ordinary hyphens in compound words
(`NERDC-aligned`, `per-seat`, `curriculum-in-a-box`) are correct and fine.

**No AI-writing tells. Write like a person, not a model.** Avoid:
- The "not just X, it's Y" / "it's not about X, it's about Y" construction.
- Filler verbs and adjectives: delve, leverage, utilize, underscore, robust, seamless, elevate,
  unlock, empower, foster, harness, streamline, cutting-edge, best-in-class, game-changing.
- Puffery openers: "In today's fast-paced world", "In an era of", "Imagine a...".
- Padding phrases: "It's worth noting that", "It's important to remember", "Needless to say".
- Rule-of-three for its own sake, and starting consecutive sentences with the same scaffold.
- Title Case On Every Heading, and emoji sprinkled into UI copy or docs.
- Vague reassurance in place of a concrete claim. Say what the thing does, with real numbers and
  names (see the real-data discipline in the School product section). "No lab to build" was pulled
  for exactly this reason: it overreached, so it became "runs on the computers you already have".

**Check before you commit copy or docs.** This must print nothing:
```bash
# Any em-dash (—) in the app source is a failure. ripgrep is Unicode-safe and gitignore-aware;
# `grep -P` does NOT work in this shell's locale. Scoped to src/ (minus .bak backups), the code
# and copy this rule governs, which is currently em-dash-free.
rg -n '—' src -g '!*.bak'
```
If it prints a line, rewrite it before committing. En-dashes in ranges are allowed, so they are
deliberately not in this check. (Legacy devops files, `scripts/*.sh` and `.env.example`, still
carry em-dashes in author comments and are out of scope here.)

---

## Commands

```bash
# Development
npm run dev           # Start dev server (4 GB memory limit)
npm run build         # Generate Prisma client + Next.js build
npm run start         # Production server

# Code quality
npm run lint          # ESLint
npm run typecheck     # TypeScript (no emit)

# Tests
npm test              # Run all unit + API integration tests (Vitest)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report

# E2E tests (Playwright, requires dev server running)
npm run test:e2e      # Headless Chromium
npm run test:e2e:ui   # Interactive UI mode
npm run test:e2e:debug # Step-through debugger
# First-time only: npx playwright install chromium

# Load tests (Artillery, requires server running)
npm run load:smoke    # Pre-deploy: 10 RPS × 60 s, p95 < 500 ms
npm run load:soak     # Post-deploy: 20 RPS × 7 min, checks for leaks
# Authenticated routes: set STUDENT_TOKEN=next-auth.session-token=<value>

# Database
npm run prisma:generate   # Regenerate Prisma client after schema changes
npm run prisma:migrate    # Create and apply a new migration
npm run prisma:seed       # Seed database with demo data
```

> Tests live in `src/__tests__/lib/`. No integration tests. `typecheck`, `lint`, and `npm test` are the automated checks.

---

## Architecture Overview

KAT is a **multi-tenant Learning Management System** (LMS) targeting K-12 tech education. It is a **Next.js 15 App Router** app with:

- **Database**: PostgreSQL via Neon (pgbouncer pooling). Prisma ORM.
- **Auth**: NextAuth.js v4, JWT sessions (30-day), credentials + Google OAuth.
- **Storage**: Cloudflare R2 (S3-compatible). Files go browser → R2 presigned URL (server never touches the bytes).
- **Payments**: Paystack (primary, Africa/Nigeria). HMAC-SHA512 webhook verification.
- **Meetings**: Self-hosted Jitsi (JWT-gated). Jibri handles recording; on completion, a webhook triggers R2 upload.
- **Code execution**: Self-hosted Judge0 CE with Monaco editor.
- **Real-time messaging**: SSE for single-instance; Redis pub/sub for horizontal scaling.
- **Rate limiting**: Upstash Redis (REST-compatible, serverless-friendly).

---

## User Roles & Access

Eight roles: `SUPER_ADMIN → ADMIN → INSTRUCTOR → FELLOW → STUDENT → PARENT`, plus two that grant
nothing on B2C: `SCHOOL_STAFF`, `SCHOOL_STUDENT`.

**A role is a CAPABILITY (what you may do). It is NEVER a tenant (whose data you may touch.)**
Whose data comes from `SchoolMembership` (school staff) and `Enrollment.schoolId` (learners).
Getting this wrong was a real P0: school admins were given `INSTRUCTOR`, which on this platform can
message any student in the organization and read their submissions, children they have no standing
over. See SCHOOL-BUILD-NOTES §2b.

- `SCHOOL_STAFF`, school admins/teachers. In **no** B2C allow-list. Their authority is their
  `SchoolMembership`; `ensureSchoolMembership` never reads `User.role`.
- `SCHOOL_STUDENT`, rostered children. Its only capability is `LEARNER_ROLES` on the three shared
  curriculum routes (already licence- and enrollment-gated). Never add it to a B2C allow-list.
- **Overlap is supported**: a schoolteacher who is also a KAT parent keeps `PARENT` and holds a
  `TEACHER` membership. Do not "fix" this by making the role a tenant.

- Role is stored on the JWT and in `session.user.role`.
- Each role gets a distinct dashboard at `/dashboard/[role]/`. School roles route to the school host.
- Messaging permissions are handled by a matrix in `src/lib/rbac.ts`, not a simple hierarchy.
  Messaging never crosses the school boundary, in either direction, **not even for a SUPER_ADMIN**.
- `ensureRole()` helper used in route handlers for authorization.
- NextAuth middleware at `src/middleware.ts` only enforces authentication (logged in vs not); authorization checks happen inside route handlers.

---

## Key Data Models (Prisma)

**Curriculum hierarchy**: `Program → Curriculum → CurriculumVersion → Module → Lesson → LessonContent`

**Module gate system**: Students must pass 3 gates before advancing to the next module:
1. Knowledge assessment (quiz/exam auto-graded)
2. Capstone project (file upload, instructor review)
3. Instructor evaluation

`ModuleGateStatus` tracks state per student per module.

**Enrollment billing**: `Enrollment` → `EnrollmentPeriod` (30-day cycles). Cron at `/api/cron/` handles billing and grace period logic.

**Fellowship**: Students apply via `FellowApplication` (optionally selecting a `cohortId`). On admin approval, the user's role is promoted to `FELLOW`. That `FellowApplication.cohortId` is their cohort membership, cohorts are exclusively for fellows, not students. When querying a fellow's cohort, use `FellowApplication` (where `status = APPROVED`), there is no `Enrollment.cohortId`.

**Certificates**: Issued per program completion; public verification at `/certificate/[credentialId]`.

---

## API Conventions

- All API routes live under `src/app/api/[domain]/[action]/route.ts`.
- Input validated with **Zod** before any DB access. Errors return `{ error: string }` with appropriate HTTP status.
- 500 catch blocks call `captureError(error)` from `src/lib/sentry.ts` and never forward error details to the client.
- Cron endpoints are secured with `Authorization: Bearer <CRON_SECRET>` header.
- Paystack and Jibri webhooks are verified via HMAC (`timingSafeEqual`) before any side effects.
- `GET /api/health`, unauthenticated uptime check, returns `{ status: "ok", timestamp }`.

---

## Component Structure

- `src/components/ui/`, shadcn/ui primitives (do not edit these manually; regenerate via shadcn CLI).
- `src/components/dashboard/`, one file per feature panel; named `[Feature]Panel.tsx`.
- `src/components/marketing/`, landing page sections.

---

## Notable Patterns

**Prisma singleton**. `src/lib/prisma.ts` exports a single PrismaClient instance; always import from there, never instantiate directly.

**File uploads**, generate a presigned PUT URL server-side (R2), return it to the client, client uploads directly. Store only the R2 object key (not the full URL) in the database and construct URLs at read time using `R2_PUBLIC_URL`.

**Email**. `src/lib/email.ts` wraps Nodemailer. Will log a warning and skip silently if SMTP is not configured.

**Server-Sent Events (SSE)**, used for real-time messaging. If `REDIS_URL` is set, messages are fanned out via Redis pub/sub; otherwise they are delivered locally (single-instance only).

**ISR**, the public showcase page (`/showcase/[projectId]`) uses Incremental Static Regeneration.

**PWA**, a service worker is registered via `public/sw.js`. `NEXT_PUBLIC_ENABLE_SW_DEV=true` enables it in development for testing.

---

## Environment Variables (summary)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Neon DB (pgbouncer) |
| `DIRECT_URL` | Direct Neon connection (migrations only) |
| `NEXTAUTH_SECRET` | Session signing key |
| `NEXTAUTH_URL` | App base URL for OAuth redirects |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` | Feature flag for Google login button |
| `PAYSTACK_SECRET_KEY` | Paystack API |
| `PAYSTACK_WEBHOOK_SECRET` | Webhook HMAC key |
| `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME/PUBLIC_URL` | Cloudflare R2 |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Outbound email |
| `JITSI_DOMAIN/APP_ID/APP_SECRET` | Jitsi JWT auth |
| `JIBRI_WEBHOOK_SECRET` | Recording webhook |
| `JUDGE0_API_URL/API_KEY` | Code execution |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Rate limiting |
| `REDIS_URL` | Pub/sub for multi-instance messaging (optional) |
| `CRON_SECRET` | Bearer token for cron endpoints |
| `EMBED_TOKEN_SECRET` | Signs school iframe launch/session tokens (min 32 chars). Absent = embed off |
| `CRON_SECRET` | Also gates `/api/cron/webhook-drain` (the school webhook outbox) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (bot protection on auth forms) |
| `GEMINI_API_KEY` | Powers "Kemi" enrollment chatbot |
| `DEFAULT_ORGANIZATION_CODE/NAME/DOMAIN` | Seeded default org |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error tracking (optional in local dev) |
| `SENTRY_ORG/PROJECT/AUTH_TOKEN` | Source map uploads in CI |

See `.env.example` for the full list.

---

## Seed Accounts

After running `npm run prisma:seed`, the following demo accounts exist (password: `Passw0rd!`):

| Role | Email |
|---|---|
| Super Admin | superadmin@example.com |
| Admin | admin@example.com |
| Instructor | instructor@example.com |
| Fellow | fellow@example.com |
| Student | student@example.com |
| Parent | parent@example.com |

---

## Self-Hosted Services

- **Jitsi + Jibri**: setup scripts in `scripts/jitsi-jibri/`
- **Judge0 CE**: Docker-based, setup in `scripts/judge0/`

## Network Lab (module)

In-browser network/cybersecurity practical (ported CS4G Netsim). Module code and its own nested `CLAUDE.md` + build guide live in `src/lib/network-lab/`; read that CLAUDE.md before touching the module.

## School (B2B / NERDC) Product

### Current foundation (per 2026-07-05 audit, already shipped)
- Next.js 15 App Router; NextAuth v4 JWT (login-only middleware; per-route authz in src/lib/rbac.ts);
  Prisma/Neon (singleton src/lib/prisma.ts); Cloudflare R2 (presigned PUT, key stored); Paystack
  (HMAC-SHA512 raw-body webhook); SSE + Redis messaging; Upstash rate limiting (no-ops if unset);
  Sentry + /api/health.
- Design system SHIPPED: warm tokens --kat-ink/clay/sun/paper/pine (brand primary = --kat-clay
  #B2401D); fonts loaded via next/font (--font-display Bricolage, --font-body Fraunces, --font-mono
  JetBrains Mono); dashboards on warm shadcn HSL tokens + Tailwind orange-* accents. NO blue.
- Hardened: crypto receipt numbers (src/lib/payments/receipt.ts); validateRequiredEnv covers the
  hard-required set; an authorization route-registry test exists at
  src/__tests__/security/route-authorization.test.ts (auto-covers privileged api/* routes).
- Real-data discipline: landing surfaces only APPROVED prisma.project builds via getRealBuilds()
  with honest empty states. NO placeholder fallback anywhere user-facing.

### Purpose
KAT sells a "Coding & Robotics Curriculum-in-a-Box" licensed B2B to schools. A school buys seats;
its own teachers deliver NERDC-aligned lessons to many students. Separate from the B2C flow (a
parent buying live mentoring for one child). ONE codebase; shares the lesson/assessment/project
engine, auth, R2, payment utils, and the warm design system.

### Routing
- Served at schools.kindleatechie.com. SAME app; src/middleware.ts rewrites that host into the
  (school) route group. No second app/deployment.
  - app/(marketing)/schools/, public B2B landing + pilot request (Phase 0)
  - app/(school)/admin/       . SCHOOL_ADMIN: classes, seats, invoices, reports
  - app/(school)/teach/       . TEACHER: roster, assign lessons, mark, progress
  - app/(school)/learn/      , a student inside a school (reuses the learning engine)
  - app/(school)/embed/[schoolSlug]/, iframe-embeddable LEARNER surface for a school's own site.
    Magic-link SSO: the school's SERVER mints a 60s single-use launch token via SchoolApiKey; the
    token travels in the URL FRAGMENT (never a query string, that is a live credential) and is
    exchanged for a separate SameSite=None; Secure; Partitioned cookie. NextAuth's cookie is
    SameSite=Lax and is NOT sent in a cross-site iframe, do not try to reuse it there.
    Framing is per-school CSP frame-ancestors from SchoolAllowedOrigin (X-Frame-Options CANNOT
    express an allow-list, so next.config.ts omits it for /embed). Exact origins, no wildcards.
    No teacher embed, it would put a roster of minors on a page we do not control.

### Roles & authorization (match the existing pattern)
- Two school-scoped roles in a SchoolMembership table (NOT on global User.role): SCHOOL_ADMIN, TEACHER.
- Add ensureSchoolMembership(schoolId, allowedRoles[]) in src/lib/rbac.ts (or src/lib/school.ts),
  in the SAME style as ensureRole/ensureSuperAdmin. Call it in EVERY (school) page and mutating
  /api/school/* route. Add getActiveSchool() (resolves active school from session + subdomain/slug).
- Extend the NextAuth JWT/session with the user's schoolMemberships (schoolId + role) + activeSchoolId.
- Every new privileged school route MUST be covered by extending
  src/__tests__/security/route-authorization.test.ts (add school-route recognition + a schoolId-scope
  assertion), do not create a separate harness.

### TENANT ISOLATION (non-negotiable, P0)
- EVERY school-scoped Prisma query includes where:{ schoolId }. No exceptions.
- Never trust a schoolId from the request body/query for authz, derive allowed school(s) from the
  session, then verify the requested resource belongs to it.
- A missing schoolId filter = privilege-escalation / child-data leak = P0.

**The B2C half, the boundary only one side used to honour.** The school side always scoped; the
B2C side relied on an *implicit* tenant ("everything that isn't a school") that nothing filtered on.
That is how a KAT instructor could read a school's pupils' submissions. Use `src/lib/tenant.ts`:
- `orgScope(orgId)`. NEVER write `where: { organizationId: x ?? undefined }`. In Prisma `undefined`
  **removes the condition**, so a null-org caller matches every row in every organization. It fails
  OPEN. `orgScope` fails closed.
- `b2cUserScope`, spread it into any query that enumerates PEOPLE (contact pickers, admin lists,
  analytics), or a school's children appear in a KAT instructor's directory.
- **Scope B2C assessment/submission reads by `program.audience = B2C`.** That query keys on the
  PROGRAM, not the student's role, so a role fix alone does not close it. School work is served by
  `/api/school/results`, scoped by schoolId.
- Any learner fan-out (notifications, etc.) filters `schoolId: null`.

`src/__tests__/security/route-authorization.test.ts` fails the build on all of the above. Extend it
when you add a route, do not create a second harness.

### Curriculum content model (aligns to the KAT-NERDC-Crosswalk)
- Courses/tracks carry audience: B2C | SCHOOL and, for school content, nerdcLevel:
  PRIMARY_1_3 | PRIMARY_4_6 | JSS | SSS, plus a strand: CODING | DIGLIT tag.
- CODING units route through the platform (lessons/projects/assessment). DIGLIT units render as
  lighter slide/worksheet content. Teacher dashboard pulls audience=SCHOOL; parent dashboard pulls B2C.

### Billing (schools)
- Per-seat, per-term, INVOICE-based. Admin confirms seat count for a term → SchoolInvoice
  (amount = seats × price) → Paystack → verify via the EXISTING HMAC webhook pattern → PAID activates
  that term's SchoolLicense → access unlocks. Reuse src/lib/payments/receipt.ts for reference numbers.
- The term model is STRUCTURED, not a free-text string. SchoolClass carries `sessionLabel`;
  SchoolLicense and SchoolInvoice carry `sessionLabel` + `termNumber` (1..3) + `startsAt`
  (`@@unique([schoolId, sessionLabel, termNumber])`). A term ends `startsAt + 15 weeks`
  (`TERM_LENGTH_WEEKS` in src/lib/school-term.ts; endsAt is derived, never stored). A class is a
  cohort for a SESSION spanning its three term-modules. Parse legacy strings with `parseTerm`.
- Access is PER-MODULE: a module (its term number = `Module.sortOrder + 1`) unlocks only when the
  school holds an ACTIVE, in-window licence for that term, and seatsUsed <= seatLimit. Use
  `getLicensedTermNumbers` / `checkModuleLicenseForEnrollment` (src/lib/school-license.ts); enforce it
  in the shared curriculum routes AND the embed, not just the learn shell. Do NOT reuse the B2C
  monthly subscription path.
- School STAFF may preview a lesson when its term is licensed OR the lesson is a `Lesson.isSample`
  taster (`checkLessonPreviewLicense`); pupils never receive samples of an unlicensed term.
- Session rollover (`POST /api/school/rollover`) promotes a class's pupils into a next-session class
  via roster-sync (seat-checked); it is promotion-only (a DIFFERENT programme). Repeating the same
  programme is refused (the Enrolment `@@unique([userId, programId])` is deliberately unchanged).

### Design register
- Reuse the shipped warm tokens + fonts + shadcn primitives + orange-* accents. School surface =
  calmer, denser, more ink/less color than the kid site. No new palette. Follow the restraint the
  landing redesign established (flat rules, mixed radii by hierarchy, one signature max).

### Real data only
- No invented students/schools/testimonials in any user-facing surface. Follow the getRealBuilds()
  pattern: real records + honest empty states + zero placeholder fallback.

### Minors' data
- School students are children. No student PII in URLs/query strings/logs or the public API beyond
  what a teacher/admin of THAT school needs. Public showcase of a student's name/work requires a
  recorded parental-consent flag before display.

### Do NOT
- No second Next.js app or separate auth. No cross-school "see all students" without a super-admin
  guard. No B2C monthly subscription for schools. No duplicated lesson/assessment components. No blue
  or new fonts/palette. No placeholder data in user-facing surfaces.
- NEVER grant a B2C role (INSTRUCTOR/ADMIN/STUDENT/FELLOW) to a school-provisioned account.
- NEVER let an endpoint address a pupil by name or email (enumeration oracle). Use the school's
  opaque `Enrollment.externalRef`.
- NEVER put a launch/session token in a query string, and never widen a framing allow-list to a
  wildcard.
- NEVER create a school's children outside `src/lib/roster-sync.ts`. One path, one seat check.
- NEVER hard-delete a pupil or an API key. Deactivate / soft-revoke, a deleted child takes their
  progress and certificates with them, and a deleted key destroys the record of what it did.
- NEVER fetch a school-supplied URL without `assertSafeWebhookUrl()` (SSRF: 169.254.169.254 is our
  cloud credentials).

## Network lab
  Network Lab (in-browser network/cybersecurity practical) lives in lib/network-lab/, see its own CLAUDE.md for engine details.
