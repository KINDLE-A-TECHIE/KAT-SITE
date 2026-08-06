# KAT for Schools. Build Notes

Engineering record for the School (B2B / NERDC) product. Covers what was built, the
decisions behind it (and what was rejected), the bugs found along the way, and the
invariants that must not be broken.

Read alongside `CLAUDE.md` (the rules) and `KAT-NERDC-Crosswalk.md` (the curriculum
source). This file is the *why*; the code is the *what*.

---

## 1. What shipped

| Area | Where |
|---|---|
| Public marketing page + NERDC compliance table | `src/app/(marketing)/schools/`, `src/components/marketing/schools/` |
| Lead intake (reuses `/partners`) + admin inbox | `src/app/api/partners/`, `src/app/dashboard/partner-inquiries/` |
| School provisioning from an approved lead | `src/app/api/super-admin/schools/provision/` |
| School-scoped RBAC | `src/lib/rbac.ts`, `src/lib/school.ts` |
| Host routing + the `(school)` route group | `src/middleware.ts`, `src/lib/school-host.ts`, `src/app/(school)/` |
| Admin surface (classes, seats, licence, roster import) | `src/app/(school)/admin/`, `src/app/api/school/classes/`, `src/app/api/school/roster/import/` |
| Teacher surface (own classes, roster, progress, course assignment) | `src/app/(school)/teach/`, `src/app/api/school/teach/` |
| Learner surface (units, lessons, licence gate) | `src/app/(school)/learn/`, `src/app/api/school/learn/` |
| NERDC curriculum (10 courses, 30 terms, 172 lessons) | `src/lib/nerdc-crosswalk.ts`, `prisma/seed-nerdc.ts` |
| Invoice billing (seats × price → Paystack → licence) | `src/lib/school-billing.ts`, `src/app/api/school/billing/` |
| Termly progress + NERDC-coverage report (PDF/CSV) | `src/lib/school-coverage.ts`, `src/lib/school-report.ts`, `src/app/(school)/admin/reports/` |
| Teacher handover + attestation basis (§7b) | `src/lib/school-teacher-history.ts` |
| B2C/B2B tenant boundary (§2b) | `src/lib/tenant.ts`, `src/lib/roles.ts` |
| Iframe embed + magic-link SSO (§2c) | `src/lib/school-embed.ts`, `src/lib/school-api-key.ts`, `src/app/(school)/embed/`, `src/app/api/school/embed/` |

**Data model added:** `School`, `SchoolMembership`, `SchoolClass`, `SchoolLicense`,
`SchoolInvoice`, `SchoolApiKey`, `SchoolClassUnit` (delivery attestation), `SchoolClassTeacher`
(who taught when), `SchoolAllowedOrigin` (embed framing allow-list), `EmbedTokenUse` (single-use
launch nonces); enums `SchoolRole`, `NerdcLevel`, `CourseAudience`, `Strand`,
`SchoolLicenseStatus`, `SchoolInvoiceStatus`, `AttestationBasis`. Extended:
`Enrollment.schoolId` + `schoolClassId` (null = B2C) + `externalRef` (the school's opaque pupil
id), `Program.audience/nerdcLevel/strand`, `Module.strand`, `SchoolClass.programId`,
`PartnerInquiry.status/schoolId`, `UserRole.SCHOOL_STAFF/SCHOOL_STUDENT`.

---

## 2. Decisions worth knowing (and what was rejected)

### There is no `PilotRequest` model, on purpose
A school pilot lead is a **`PartnerInquiry` with `type = SCHOOL`**. A separate model would
have duplicated the intake form, the API and the admin inbox that already existed. We added
`APPROVED` to `PartnerInquiryStatus` and a `schoolId` FK (which is both the audit trail and
the guard against double-provisioning).

### One course per **class year**, terms are **Modules**
`Program` = a class year (Primary 5, JSS 3, SS 2…), `Module` = a term, `Lesson` = a topic.

This is the only shape that works, because **strand varies by term** (Primary 6 T1 is
digital literacy, T2 is coding). A program-level strand cannot express that, hence
`Module.strand`.

Rejected: one program per NERDC level. It would have put Primary 4 and Primary 6 students in
the same course.

### School memberships are **live**, not baked into the JWT
`session` callback re-reads `SchoolMembership` from the DB every request (deduped per
request with React `cache()`), and they are deliberately **absent from the JWT**.

Why: revoking a teacher must take effect immediately, this is the tenant boundary for
children's data. A 30-day JWT would have kept a removed teacher inside a school for weeks.

Rejected: a short-TTL token copy. It reintroduces exactly the staleness we removed *and* is
more complex than the login-time design it replaces, the worst corner of the trade space.
If this ever becomes a measured bottleneck, the answer is a Redis cache with **explicit
invalidation on membership writes**, never a stale copy.

### A class's course is **locked once students enrol**
`Enrollment.programId` anchors every lesson completion, module gate and assessment a child
has. Re-pointing the class at another course would strand that progress (and can collide
with `@@unique([userId, programId])`). Enforced in `src/lib/school-course.ts`, shared by the
teacher *and* admin routes so it can't be enforced in one and forgotten in the other.

### B2C and school sessions are **separate** (by design)
NextAuth issues host-only cookies, so a session on `kindleatechie.com` is not sent to
`schools.kindleatechie.com`. That's the desired behaviour: school staff and B2C parents are
different people. Consequence: **Google OAuth is hidden on the school host**. Google's
redirect URI is bound to `NEXTAUTH_URL` (the apex), so a Google sign-in started on the
school host returns to the apex and sets the cookie *there*. School staff use credentials.

### Content integrity: structure yes, teaching material no
The seed creates courses, terms, units, lesson titles and strand tags, all real, from the
schemes of work. It does **not** invent lesson prose, slide/worksheet URLs, or quiz
questions. Fabricated quiz questions would gate real children's progress on fiction.

**Consequence:** CODING module gates stay `NOT_STARTED` and DIGLIT lessons are
titled-but-empty until real content is authored in the existing builder. That is honest, not
broken.

### Scratch is on the platform (self-hosted)
The schemes specify Scratch/Blockly for the block-coding units, and both now run on the platform.
**Blockly** is an in-app block that generates Python on the existing Pyodide runtime. **Scratch** is a
SELF-HOSTED vanilla scratch-gui on `scratch.kindleatechie.com` (Cloudflare Pages), embedded by iframe
with a postMessage bridge: pupils build in the familiar editor, save/open their `.sb3` from its File
menu (bytes go browser -> R2, only the key is stored), and can record the stage to a `.webm` saved to
their account. `SCRATCH` questions are AUTO-graded by static analysis of the saved `.sb3` against an
authored checklist. So block-coding units can be authored as `BLOCKLY` or `SCRATCH` content, not only
the Python playground. The Python playground (turtle/pygame shims) still covers text coding at SSS.

---

## 2b. The B2C/B2B boundary (P0, fixed 2026-07-13)

**The bug I shipped and then found.** Provisioning gave a school's first admin the global role
`INSTRUCTOR`; roster import gave children `STUDENT`. Both are real B2C capabilities, and school and
B2C share one `Organization`, so the platform could not tell a school admin from a KAT instructor.
A school admin could **message any B2C child**, **read B2C children's submissions**, and author B2C
curriculum. In reverse, **school children were visible and messageable to every KAT instructor.**

**Root cause: authorization was a capability check (`role`) with no tenant scope behind it.** The
school side always had scope discipline (`where: { schoolId }`, test-enforced). The B2C side relied
on an *implicit* tenant that nobody filtered on. A boundary only one side honours is not a boundary.

**A role is a CAPABILITY, what you may do. It is never a tenant, whose data you may touch.**
Whose data comes from `SchoolMembership` (staff) and `Enrollment.schoolId` (learners).

### Layer 1, capability (compiler-enforced)
- `SCHOOL_STAFF`, school admins/teachers. In **no** B2C allow-list; grants nothing. Authority comes
  from `SchoolMembership`, which never reads `User.role`.
- `SCHOOL_STUDENT`, rostered children. Added to `LEARNER_ROLES` on exactly the **three** shared
  curriculum routes `/learn` uses (already licence- and enrollment-gated). Absent from challenges,
  grades, transcript, assessments: a school's children are not KAT customers.
- `DASHBOARD_ROUTES` is `Record<UserRoleValue, string>`, so adding enum members made **`tsc`
  enumerate every site that had to decide**. The compiler found the gaps, not memory.

**Overlap is supported, deliberately.** A schoolteacher who is also a KAT parent keeps `PARENT` and
holds a `TEACHER` membership, no second account. (An earlier plan made the role the tenant, which
would have forbidden exactly that. Teachers are parents; the model was wrong.)

### Layer 2, scope (does the real work)
- **`audience: CourseAudience.B2C`** on B2C assessment/submission reads. *This is the one the role
  fix cannot do*, that query keys on the **program**, never on the student's role. School work is
  served by `/api/school/results`, scoped by `schoolId`.
- **`orgScope()`** (`src/lib/tenant.ts`) replaces `organizationId: x ?? undefined`, which **FAILED
  OPEN**: in Prisma `undefined` *removes* the condition, so a null-org caller matched every row in
  every organization. A latent bug independent of schools.
- **`b2cUserScope`** on people-enumerating queries; messaging refuses school accounts in **either**
  direction, **including for a `SUPER_ADMIN`**.

### Layer 3, enforcement
`route-authorization.test.ts` now also fails the build when a provisioning route grants a B2C role,
when the fail-open org idiom appears, when the people-directory omits `b2cUserScope`, or when a B2C
assessment read omits the audience scope. **Each rule was proven non-vacuous by planting its
violation**, one first attempt passed against a route that *imported* the scope and never applied
it, and was tightened to require the spread.

---

## 2c. The embed (iframe SSO into a school's own site)

Shipped at `/embed/[schoolSlug]` on the school host. **Learner only**, a teacher embed would render
a roster of minors onto a page whose security we do not control.

**Shape borrowed from LTI 1.3**, the actual ed-tech standard: signed launch token, single-use nonce
(`jti`), `iss`/`aud`, roles resolved **at launch**, not trusted from the token. Adopting real LTI
later is an addition, not a migration.

**We sign; the school does not.** The school authenticates with a `SchoolApiKey` (already modelled,
now used. Stripe shape: SHA-256 hash + display prefix) and we mint. No shared signing secret at the
school's end means no alg-confusion, no `alg:none`, no clock skew, no key in someone's PHP file.

**Two tokens, and conflating them would be the whole vulnerability:**
- **LAUNCH** (`aud kat:embed:launch`), 60 s, **single-use**, travels in the **URL fragment**. A
  fragment never reaches a server: not our logs, not a `Referer`, not the school's analytics. A
  query string would put a live credential in all three.
- **SESSION** (`aud kat:embed:session`), 30 min, HttpOnly cookie, never in a URL.

**Every claim is re-checked at redemption.** A signature proves the token is ours; it does not prove
the pupil still attends the school or that the licence is still paid.

**Cookie**: `SameSite=None; Secure; Partitioned` (CHIPS), **`Path=/`**. Path=/embed *looks* tighter
but is a bug, it is never sent to `/api/school/embed/*`, so the cookie probe would fail and every
browser would take the Safari fallback. The cost of `Path=/` is CSRF exposure, paid for by
`assertEmbedOrigin()` on the one mutating endpoint. **NextAuth's cookie stays `SameSite=Lax`**,
embedding does not weaken the B2C product.

**Framing**: `X-Frame-Options` **cannot express an allow-list** (`ALLOW-FROM` is dead), so
next.config.ts omits it for `/embed` and middleware sets per-school `CSP: frame-ancestors` from
`SchoolAllowedOrigin`. **Exact origins only**, the OAuth 2.0 Security BCP bans wildcards, and
`https://*.school.edu.ng` would let any forgotten subdomain frame a live child session. **No origins
configured ⇒ `'none'` ⇒ unframeable.** CORS is irrelevant here; it governs XHR, not framing.

**Safari.** A partitioned third-party cookie works in Chrome/Edge/Firefox. Safari's Storage Access
API grant has historically required prior first-party interaction with our domain, which a pupil
launching from their school portal, who has never visited us directly, simply fails. So the launcher
probes whether the cookie actually stuck (it is HttpOnly; the only honest test is to ask the server)
and, if not, offers a **top-level tab** using a **fresh handoff token** minted at redemption, the
original is spent by then, which is the point of single-use.

**`Enrollment.externalRef`**, the school's own opaque pupil id, from an optional `student_id` CSV
column. The mint endpoint **never** accepts a name or an email: that would be an enumeration oracle
for the school's roll.

Verified against two schools sharing a host: replay **401**, cross-school redeem **401**, school B
minting for school A's pupil **404**, forged key **401**, launch-token-as-cookie renders **no pupil
data**, CSRF from an unlisted origin **403**, a school with no origins **404 + frame-ancestors
'none'**, and non-embed pages still carry `X-Frame-Options`.

---

## 2d. Public API v1 (schools with their own IT/SMS), see API.md

`/api/v1/*`: roster sync, classes, per-pupil progress, results, progress webhook. Auth = `SchoolApiKey`
(Bearer). **schoolId always comes from the KEY**, no endpoint accepts one.

**Scoped keys** (`SchoolApiScope`): `ROSTER_WRITE` creates child accounts and `EMBED_MINT` signs in as
any pupil. Neither may ride along on a read-only reporting key a school pastes into a BI tool, the
embed's keys previously *were* omnipotent, and this closes that. **Revocation is soft**: a hard delete
destroys the record of what a leaked key did.

**One child-creation path.** `src/lib/roster-sync.ts` is shared by the v1 endpoint and the CSV
importer; the harness fails the build if either creates users directly.

**Deletion**: never. Pupils are **DROPPED** (SCIM/OneRoster do the same). `deactivate_missing` is
opt-in, and >20% of a class needs `force`. Clever's safety valve exists because it has already gone
wrong for somebody.

**Webhooks**: outbox + cron (`/api/cron/webhook-drain`), Standard Webhooks HMAC-SHA256, thin payloads
(refs only, no names), exponential backoff, auto-disable after 10 failures. **SSRF-filtered on the
RESOLVED IP** and `redirect: "manual"`, a hostname blocklist is defeated by an A record pointing at
`169.254.169.254`.

### Deployment (Vercel)
- `/api/cron/webhook-drain` runs **every 5 minutes** (`vercel.json`). It shipped UNSCHEDULED, the
  outbox would have filled in production and no school would ever have received a webhook, with
  nothing failing to say so. A harness rule now fails the build on any cron route that exists in
  code but is absent from `vercel.json`.
- **Vercel cron limits:** Hobby allows 2 crons at daily granularity. This is the 3rd, at */5,
  **it requires Pro**. Confirm the plan, or the schedule silently will not run as written.
- `CRON_SECRET` must be set in the Vercel project, or the drain returns 500.

### SSRF residual risk, actual exposure on Vercel
Deployment is **Vercel serverless**, not EC2 (the AWS SDK is only for Cloudflare R2). So:
- **No EC2 metadata service.** There is no `169.254.169.254` credentials endpoint to steal,
  IMDSv2 hardening is moot here.
- **No VPC / private network** on standard Vercel, so a blind SSRF has nothing internal to reach.
  Neon is public TLS + password (not reachable by a JSON POST); Upstash is token-authenticated and
  our token is never sent to a webhook URL.
- The drain records `HTTP <status>` and **never reads the response body**, so the vector is a
  blind, POST-only, status-code oracle. A harness rule locks that: the day someone adds
  `await res.text()` "to improve the error message", blind becomes full.
- **Revisit only if** you move to Vercel Secure Compute (VPC) or self-host, then egress filtering
  and IP-pinning become worth the cost.

### Three bugs the live test found (all fixed)
1. **A dropped pupil could never come back.** The next sync saw an enrollment on the right class and
   skipped them, leaving a real child DROPPED forever. `deactivate_missing` was a one-way door.
2. **Deactivation never freed the seat.** `reserveSeats` only increments, so `licence.seatsUsed`
   drifted upward permanently and a school would run out of seats it was paying for and not using.
3. **`reconcileSeats` counted DROPPED pupils as occupying seats**, so even reconciliation could not
   have fixed (2).

---

## 2d. Commercial model, the API and SSO are NOT separately billed

**Deliberate, and enforced by the code that already exists.** The seat licence is the only meter:

| Path | Licence-gated? |
|---|---|
| Roster sync (creates pupils) | **yes**. `checkClassLicense` inside `syncRoster` |
| Magic-link SSO (a pupil entering a lesson) | **yes**. `checkEnrollmentLicense` in `redeemLaunchToken` |
| Lesson completion | **yes** |
| Reading classes / progress / results | **no**, open even when a term lapses |

Every child the API can create costs a seat; every child SSO can sign in is already a paid seat. So
the API cannot extract value that was not sold. **A separate API charge would be charging twice for
the same seats**, and a school with an IT department is exactly the school that notices.

**Reads stay open when a term lapses, on purpose.** A school that has not renewed can still pull its
own historical progress. Withholding *teaching* is legitimate leverage; withholding *a school's own
records about its own children* is a hostage situation, and it would travel fast through a WhatsApp
group of Lagos head teachers.

**Do NOT build:**
- An arbitrary-amount `SchoolInvoice` for "integration fees". `SchoolInvoice` is `seats ×
  pricePerSeat` computed server-side precisely so a school cannot price itself; an arbitrary-amount
  invoice type reopens that hole. Professional-services fees are a contract line and a bank
  transfer, not a SaaS meter.
- A "no extra charge" claim on the schools landing hero. Most schools in this market have **no MIS at
  all**; the claim speaks to a buyer who barely exists, and it commits pricing on the least
  reversible surface before a single school has integrated. The quiet "read the developer docs" link
  is the right weight. It is stated in the DOCS instead, where the person who cares is reading.

**Revisit the model only when something costs money per-unit AND scales independently of seats**,
enormous webhook volume, or a white-label. Nothing does today. Rate limits (600/min per key) protect
the *infrastructure*; the seat gate is what protects the *revenue*. They are different threats.

---

## 2e. CI, and the migration baseline (2026-07-13)

### The migrations did not describe the database
Rebuilding a database from the 33 migrations, from zero, produced a schema needing **139 corrective
SQL statements** to match `schema.prisma`. Missing enums (`ProjectStatus`, `GateStatus`…), stale
`cohortId` columns and FKs. The DB had been evolved partly by `db push` / manual SQL over time.

**What that actually meant:** production **could not be rebuilt from its own migration history**. No
disaster recovery, no staging clone, no new environment. The database was correct; the *history of
how it got there* was fiction.

**Fixed by baselining** (Prisma's documented procedure), which touched **zero rows**:
- The 33 broken migrations are archived to `prisma/_migrations-archive-2026-07-13/` and
  **gitignored**, a history that cannot be replayed is not history, and leaving it in the repo
  invites someone to trust it.
- A single `00000000000000_init` now reproduces `schema.prisma` **exactly** (verified: deploy to a
  scratch database → `migrate diff` → empty).
- `migrate dev` works again; it had been demanding a full reset.

**A reset was offered and REFUSED.** The dev database holds **67 lesson-content blocks hand-authored
between 27 Mar and 12 Jul**, plus projects and a testimonial that **no seed reproduces** (`seed.ts`
writes 1 content block; it writes zero projects). "Not live" means no customers, it does not mean no
irreplaceable data. Always count the rows before believing "it can be reset".

### CI (`.github/workflows/ci.yml`)
Five jobs: `typecheck & lint`, **`security`** (its own job. "security ✗" is unmissable in the checks
list where "test ✗" gets scrolled past), `unit tests`, `next build`, and **`cross-tenant isolation`**
against a throwaway Postgres built from the migration chain.

`next build` is **not** redundant with `typecheck`: it is the only thing that catches App Router
violations (a `route.ts` exporting a non-handler passes local typecheck against a stale
`.next/types`, then fails from a cold checkout, that exact bug shipped here once).

### The cross-tenant leak test (`src/__tests__/integration/cross-tenant.test.ts`)
Seeds two schools and asserts School A can never reach School B, across every school and v1 endpoint.

- **Real Prisma.** The other API tests (`__tests__/api/*`) all `vi.mock("@/lib/prisma")`, they would
  pass with **every** `where: { schoolId }` deleted, because there is no database to leak from. Only
  the *session* is mocked here.
- **Every negative has a positive control.** A suite where everything 404s passes vacuously.
- **Proven non-vacuous:** three real tenant filters were deleted (`v1/classes`, `v1/students/…`,
  `school/classes` PATCH) and the suite went red on all three, plus the raw-body backstop.
- It **hard-fails, never skips, when `CI` is set and no `DATABASE_URL` is present.** A security test
  that silently skips manufactures confidence, which is worse than having none. (It *did* silently
  skip at first, vitest never loaded `.env.local`.)
- **Not covered:** `middleware.ts` (B2C-host 404s, per-school CSP). Handlers are called in-process.

### YOU must turn on branch protection
A workflow that is not a **required check** fails nothing. Settings → Rules → Rulesets → require
`security`, `unit tests`, `next build`, `cross-tenant isolation` on `main` and `dev`. Until then, a
red ✗ is merely advisory.

---

## 3. Invariants, break these and you leak children's data

1. **Every school-scoped query filters by `schoolId`.** No exceptions.
2. **`schoolId` is derived from the session, never from the request.** No route accepts a
   body/query `schoolId`. The Zod schemas deliberately have no such field.
3. **Scope writes in the `WHERE` clause**, e.g.
   `updateMany({ where: { id, schoolId } })`. A foreign id then matches zero rows and 404s,
   cross-tenant writes become *structurally impossible*, not merely checked.
4. **Teacher routes scope by `schoolId` AND `teacherId`.** `schoolId` alone lets a teacher
   read a colleague's class.
5. **No student PII in URLs, logs, or analytics.** The roster CSV goes in the POST *body*;
   import errors are reported by **row number**; telemetry carries counts only. Class ids in
   URLs are fine, student ids and names are not.
6. **The licence gate lives in the shared curriculum APIs**, not just the `/learn` page,
   see §4.

`src/__tests__/security/route-authorization.test.ts` enforces 1–3 mechanically: it treats
`school` as a privileged segment, requires a recognized guard in every handler, asserts every
school handler references `schoolId`, and asserts no school route reads `schoolId` off the
request. It was verified to *fail* on a deliberately unscoped route, it is not vacuous.

---

## 4. Bugs found (and why they mattered)

These were all found by driving the running app, not by reading code. Several would have
passed a code review.

### `instrumentation.ts` was never loaded → `validateRequiredEnv()` was dead code
Next.js looks for `instrumentation.ts` **inside `src/`** when the project has a `src/`
directory. It was at the repo root, so `register()` never ran: the "fail fast on
misconfiguration" guarantee documented in `src/lib/env.ts` was **not in effect**, and the
Sentry server/edge configs were never imported. Moved to `src/instrumentation.ts`.

> `npm run build` will now fail fast if a required env var is missing. That is intended, but
> if a deploy has been quietly missing one, this is the change that surfaces it.

### A page-only licence gate is decorative
Gating `/learn` alone left `/api/curriculum/lessons/…`, `/complete` and `/progress/…`
callable directly, a school with a lapsed licence could still read content. The check now
lives in those **shared** routes (`src/lib/school-license.ts`), short-circuiting on
`schoolId === null` so B2C is untouched. Verified by expiring a licence and confirming the
raw APIs 403 while a B2C learner still gets 200.

### Prisma transaction timeout in the roster import
Per-row upserts inside an interactive transaction blew the 5 s limit on **two** students
(`Transaction already closed… 5213 ms passed`). At ~4 round-trips per child, a 500-row roster
meant ~2,000 round-trips holding a transaction open for minutes. Rewritten as bulk
`createMany` with `skipDuplicates`, a fixed handful of queries regardless of roster size.
**Raising the timeout would have masked it.**

### The NERDC seed took 8+ minutes and timed out
Same root cause (~650 sequential round-trips), plus: `Promise.all` changed nothing because
`DATABASE_URL` carries **`connection_limit=1`** (correct for serverless), every query
serialises through one connection. Fixed by bulk-diffing *and* pointing the seed at
**`DIRECT_URL`**, which exists for exactly this. **8 min → 7.4 s.**

### The login page ignored `callbackUrl`
Middleware sent `?callbackUrl=`; the login page read `?redirect=`. The callback was silently
dropped and **everyone landed on `/dashboard`** after login, so a teacher never reached
`/teach`. `src/lib/safe-redirect.ts` now honours both, with an open-redirect guard (the
post-login nav is `window.location.assign`, so `https://evil.com` would have been an open
redirect).

### `withAuth`'s `authorized` callback runs *before* the middleware function
School paths on the **B2C** host were returning `307 → /login` instead of `404`, leaking
that those routes exist. `authorized` now returns `true` for school paths on non-school hosts
so the middleware's 404 wins.

### `redirect()` inside `try/catch` is swallowed
Next's `redirect()` works by *throwing* `NEXT_REDIRECT`. Calling it inside a `try` whose
`catch` swallows errors silently cancels the redirect. Keep `redirect()` **out** of guarded
`try` blocks.

### CODING units rendered identically to DIGLIT units
`getModuleGatesForUser` only returns rows for modules a student has *already started*, so a
fresh coding unit reported `gates: null`, exactly like a slides unit. The entire
CODING/DIGLIT distinction was invisible. Un-started CODING units now default to
`NOT_STARTED` gates.

### `"Okafor, Chidi"` was stored as `firstName: "Okafor,"`
The CSV parser correctly preserved the quoted field; the naive whitespace split mangled it.
`"Last, First"` is the standard roster convention, that's *why* it's quoted. Handled in
`src/lib/roster.ts` with tests.

### Anonymous callers got 403 instead of 401
`requireActiveSchool` checked `activeSchoolId` before checking whether a session existed at
all, so "not signed in" was reported as "not allowed". Still denied, but it defeated the
401/403 mapping in the routes.

### The roster importer's course fallback became ambiguous
Once three courses shared `PRIMARY_4_6`, its `findFirst({ nerdcLevel })` would have **enrolled
a Primary 4 class into the Primary 6 course**. It now refuses (422) rather than guessing.

---

## 5. Design rules that are easy to get wrong

- **Never delete a `Lesson` in the seed.** `Lesson → LessonProgress` cascades: pruning a
  removed topic would silently destroy children's progress. The seeder only creates/updates.
- **The roster importer refuses to guess a child's identity.** Idempotency key is
  `(schoolId, normalized name)` via a deterministic synthetic email
  (`student.<hash>@roster.invalid`. RFC 2606 reserved, can never receive mail). If a
  same-named student is already enrolled in a *different* class, the row is an **error**, not
  a silent move, merging two children is far worse than making an admin disambiguate.
- **Over-seat imports are rejected wholesale**, not truncated. A partially imported roster is
  worse than a rejected one.
- **`Module.strand` falls back to `Program.strand`** when null.
- **`(school)` route-group paths have no URL prefix** (`/admin`, `/teach`, `/learn`,
  `/home`), so the middleware must **404 them on the B2C host**, that's what keeps the
  school app invisible on `kindleatechie.com`.
- **`src/lib/nerdc-crosswalk.ts` must stay dependency-free** (no prisma, no `server-only`),
  it is imported by both the Node seed script and a client component. That's what makes the
  `/schools` compliance table and the seeded curriculum one source that cannot drift.

---

## 6. Testing / local development

- **School host in dev:** browse `http://schools.localhost:3000`, any `schools.*` host is
  treated as the school surface, no hosts-file edit needed. For curl, send `x-school-host: 1`.
- **Turnstile blocks curl logins.** To drive authenticated flows in tests, mint a session
  cookie directly:
  ```ts
  import { encode } from "next-auth/jwt";
  const cookie = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { sub: userId, role.. } });
  // send as: next-auth.session-token=<cookie>
  ```
  Omit `sessionId` and the revocation check is skipped.
- **Seeding:** `npm run prisma:seed` (goes through `DIRECT_URL`; idempotent, re-running
  writes nothing).
- **Gotcha:** folders starting with `_` are **private** in the App Router and are not routable.
  A probe route at `src/app/api/_probe/` will 404.
- **Gotcha:** `instrumentation.ts` is loaded **once at server start** and is not hot-reloaded.
  Restart the dev server after editing it.

---

## 7. Not done (deliberately)

| Item | Note |
|---|---|
| **Teacher invites** | A school admin cannot yet invite teachers; memberships are created directly. |
| **Assessments / quizzes** | Not seeded (would be fabricated). CODING module gates stay `NOT_STARTED` until authored. |
| **Slides / worksheets for DIGLIT** | Lessons exist and are titled; content is attached via the existing content builder. |
| **Class deletion** | Skipped, deleting a class with enrolled students has real consequences worth designing separately. |
| **Embed over HTTP** | Impossible by design: `SameSite=None` requires `Secure`, so the embed needs a real HTTPS origin. It cannot be exercised end-to-end in a browser on `http://localhost` (curl does not enforce this, which is how the tests ran). |
| **Cross-host SSO** | Explicitly rejected; the two surfaces keep independent sessions. |
| **Teacher embed** | Deliberately not built: it would render a roster of minors onto a page whose security we do not control. Revisit only once origins are proven in the field. |
| **Safari embed (verified on a real device)** | The top-level fallback is built and is treated as load-bearing, but the third-party-cookie path was never exercised on an actual iPad. Fifteen minutes on real hardware before a school relies on it. |
| **Per-school subdomains** | The school host is one host for the whole B2B app; the tenant comes from the session. `getActiveSchool(schoolId?)` already takes an explicit id, so middleware can hand it a slug-resolved school later. |

---

## 7b. Teacher handover (a class changes hands mid-term)

**Nothing is "transferred", and that is the design.**

- **Student progress** is keyed by `userId`. It belongs to the *students* and stays with the class.
  There was never anything to move.
- **Delivery attestations** (`SchoolClassUnit`) are keyed by `schoolClassId + moduleId`, so they
  already outlive the teacher who made them.
- **Attestations are NEVER re-attributed.** The whole value of `markedById` is that a *named human*
  stands behind the claim. Re-signing an outgoing teacher's units in the incoming teacher's name
  would falsify the compliance record the report exists to be. An incoming teacher *may* attest an
  earlier unit, but it is recorded under **her own** name, because she is vouching, not claiming
  she taught it.

**What was added**

| Piece | Why |
|---|---|
| `SchoolClassTeacher` (history) | `SchoolClass.teacherId` is only the *current* pointer and was silently overwritten. A class that changed hands read as though the incoming teacher taught the whole term. Carries a denormalized `schoolId` so every query on it filters by `schoolId` directly, per the tenant rule. |
| `SchoolClassUnit.markedByName` | `markedById` is `SetNull` on user delete, deleting a teacher left an **unattributed** delivery claim standing on a regulator-facing document. The name *is* the claim, so it is snapshotted, not joined. |
| **The handover guard** (`409 UNATTESTED_UNITS`) | Reassignment revokes the outgoing teacher's access instantly (teach routes scope by `teacherId`). Any unit she taught but never ticked becomes permanently un-attestable *by her*, and the class then reports "not delivered" for teaching that genuinely happened. The loss cannot be undone honestly, so it is surfaced **before** the change: the admin sees the exact units at risk and must send `confirmHandover: true`. The easy path is the honest one, ask the teacher to attest, *then* hand over. |

The report prints **"Taught by: Ngozi Okafor (12 Sep – 3 Nov), Ada Balogun (3 Nov – present)"** and
each unit keeps its own *attested by*. An inspector reconciles the two: who **held** the class,
against who **vouched** for each unit.

### Attestation basis, first-hand vs second-hand

A successor inherits units she did not teach. A boolean `delivered` gave her only dishonest moves:
sign her predecessor's name (**forgery**), or let real teaching read as "not delivered"
(**understatement**). Restoring the departed teacher's login is *not* the fix, she has left and
will not log in, and re-granting an ex-employee access to a live roster of children is a privacy
regression traded for a tickbox.

So `SchoolClassUnit.basis` (`AttestationBasis`) records **what claim is being made**:

- **`FIRST_HAND`**. "I taught this." The default, and the only option on a class that never
  changed hands.
- **`SUCCESSOR`**. "My predecessor taught this, and I am recording it." A weaker claim, signed
  under the **successor's own** name. `taughtByName` (the predecessor credited) is **derived
  server-side from the teacher history**, never accepted from the request, or a teacher could
  credit anyone at all. A SUCCESSOR claim on a class with no predecessor is **422**.

The report never blends them: `totals.unitsFirstHand` and `totals.unitsSuccessor` are separate,
second-hand rows render amber ("Second-hand") rather than the green first-hand tick, and the CSV
carries a **Basis** column. Same discipline as keeping delivery apart from engagement.

The teacher UI only asks when it must, the choice dialog appears solely on a class that has
actually changed hands, so the common case stays one click.

**Irreducible residue:** if a teacher vanishes leaving no lesson notes, *nobody can honestly attest
what nobody witnessed.* The system keeps saying so rather than manufacturing a signature.

Verified end-to-end (real logins, real routes): 409 lists exactly the un-attested units → tenant
isolation 404s a foreign admin → `confirmHandover` succeeds → the outgoing teacher is locked out
(404) → **unit 1 remains attested to Ngozi** → Ada's unit is attested to Ada → re-saving the same
teacher adds no history row → **deleting Ngozi's account clears the FK but the report still names
her.**

### Known consequence of the honest-content rule
A real school's `/learn` and `/teach` will show **real zeros and honest empty states** until
curriculum content is authored. This is correct behaviour, not a regression. It was verified
against a purpose-built test course (one CODING + one DIGLIT unit), which was then deleted.

---

## 8. Curriculum shape (as seeded)

10 courses · 30 terms (11 CODING / 19 DIGLIT) · 172 lessons · 65 code playgrounds.

The **coding spine**, the deep-build units KAT owns, is locked by a test
(`src/__tests__/lib/nerdc-crosswalk.test.ts`), so an edit can't silently demote a coding unit
to slides:

| Course | Unit |
|---|---|
| Primary 5 | Term 3. Thinking Like a Coder (block coding) |
| Primary 6 | Term 2. Coding & Computational Thinking |
| JSS 3 | Term 2. Programming & Digital Ethics |
| SS 1 | Term 2. From Blocks to Python |
| SS 1 | Term 3. Programming Logic |
| SS 2 | Term 2. Web Design (HTML & CSS) |
| SS 2 | Term 3. Databases, SQL & SDLC |
| SS 3 | Term 2. AI, Robotics & Tech Entrepreneurship |

Everything else is digital-literacy, delivered light. Coding first appears at Primary 5 Term 3
also asserted by a test.
