# CLAUDE.md, KAT Network Lab (module)

Nested module context. Read the ROOT `CLAUDE.md` (at `src/../CLAUDE.md`, repo root) first;
this file only adds what is specific to Network Lab and DEFERS to the root on every shared
convention (writing style, no em-dashes, no blue, testing layout, imports, tenant isolation).

This document was reconciled against the real repo on 2026-07-16. Anything the repo does not
yet have is marked **OPEN QUESTION** rather than invented. Do not resolve those by guessing.

---

## What this module is

An in-browser network and cybersecurity practical. Students build and launch packets, watch
them travel between devices, and complete objective-based levels (routing, spoofing, denial of
service, man-in-the-middle, censorship evasion, plus new DNS and HTTP levels). It is the
hands-on companion to the theory lessons on networks and cybersecurity.

It replaces a legacy PHP/Phaser simulator (CS4G Netsim, MIT licensed) with a React/Next.js
implementation inside the existing KAT platform. No new infrastructure: it deploys on the
current Vercel project, saves progress through the platform's existing lesson-progress layer,
and reuses platform auth and roles.

The 13 original levels are ported verbatim in mechanics; instruction text is rewritten in KAT's
voice with Nigerian device names. Two new levels (DNS, HTTP) extend the same engine.

---

## Where things actually live (verified)

| Concern | Real location |
|---|---|
| Engine + module logic | `src/lib/network-lab/` (this folder). Pure TS, no DOM. |
| Levels data | `src/lib/network-lab/levels.json` (already here). |
| Tests | `src/__tests__/lib/network-lab/*.test.ts`. Root convention: tests live under `src/__tests__/lib/`, NOT co-located. Do not add a co-located `__tests__` folder. |
| Playable block component | `src/components/**` (e.g. a new `NetworkLabBlock`, sibling to `src/components/dashboard/code-playground-block.tsx`). It is MOUNTED by the lesson viewer, it is not a page. |
| Where it renders (B2C) | inside `src/components/dashboard/lesson-viewer.tsx` (switches on `content.type`). No new route. |
| Where it renders (school) | inside `src/components/school/embed-lesson-body.tsx` and the `(school)/learn` lesson page. No new route. |
| API routes | `src/app/api/[domain]/[action]/route.ts`. |
| Brand tokens | `src/app/globals.css` `:root` (`--kat-*`) and `tailwind.config.js` (`colors.kat.*`, so `bg-kat-clay` works). |

Network Lab needs **no route of its own**. It renders wherever a lesson renders, through the
content-type branch, so there is no `(platform)` group to create (the drafts guessed one). Do not
create route folders in this pass.

---

## Stack and placement (verified)

- **Framework:** Next.js `^15.2.0` App Router, React `^19.2.0`. Same repo and deployment.
- **Language:** TypeScript strict. No JavaScript files. No `any` in engine code.
- **Rendering:** the simulation runs client-side. The playable shell is a client component
  (`"use client"`). No server compute during gameplay.
- **Animation:** React state + `requestAnimationFrame`. Do NOT reintroduce Phaser, jQuery, or any
  game framework. The original used them and they are deliberately removed.
- **Styling:** the platform Tailwind (`^3.4.19`) + the warm design tokens. Use `bg-kat-clay`,
  `text-kat-ink`, etc., or the `--kat-*` custom properties. Do not hardcode arbitrary hex.
- **ORM:** Prisma `^6.4.1` via the singleton `import { prisma } from "@/lib/prisma"`. Never
  instantiate PrismaClient directly.
- **Auth:** NextAuth `^4.24.11`. See the next section.

---

## Auth and roles (verified, use these exact helpers)

- **Session:** `getServerAuthSession()` from `@/lib/auth` returns the session;
  `session.user` carries `{ id, role, ... }` plus `schoolMemberships` and `activeSchoolId`.
- **Current DB user:** `getCurrentUser()` / `requireCurrentUser()` from `@/lib/current-user`
  (selects `id, email, firstName, lastName, role, organizationId`).
- **B2C role gate:** `ensureRole(user, roles)` from `@/lib/rbac`. Learner roles in the codebase
  are `UserRole.STUDENT` and `UserRole.FELLOW` (see the completion route below).
- **School (B2B) roles:** these live on `SchoolMembership`, NOT on `User.role`. Use
  `ensureSchoolMembership(user, schoolId, roles)` (`@/lib/rbac`), and
  `getActiveSchool()` / `requireActiveSchool([roles])` (`@/lib/school`). School learners have no
  membership; they are gated by enrollment via `ensureSchoolStudent(schoolId)` (`@/lib/school`).
  `SchoolRole` values are `SCHOOL_ADMIN` and `TEACHER`.
- **Tenant isolation is a hard rule (root CLAUDE.md).** Any school-scoped query filters by a
  session-derived `schoolId`, never one from the request. This is build-enforced by
  `src/__tests__/security/route-authorization.test.ts`. If this module adds a school-scoped API
  route, extend that test.

---

## Progress and completion (verified, this is the important part)

There is **no "milestone event" and no importable `completeLesson()` helper**. The drafts
assumed one; it does not exist. Completion is a `LessonProgress` row, written by an HTTP route.

**The model:**
```prisma
model LessonProgress {
  id          String   @id @default(cuid())
  userId      String
  lessonId    String
  completedAt DateTime @default(now())
  @@unique([userId, lessonId])
}
```
Completion is keyed on a real `Lesson` row. There is no per-level or per-milestone table.

**The two real completion paths (they diverge, there is no shared helper):**

1. B2C, `POST /api/curriculum/lessons/[lessonId]/complete`
   (`src/app/api/curriculum/lessons/[lessonId]/complete/route.ts`):
   - `getServerAuthSession()`; restricts to `LEARNER_ROLES = [STUDENT, FELLOW]`.
   - verifies `prisma.enrollment.findUnique({ where: { userId_programId } })`.
   - `prisma.lessonProgress.upsert({ where: { userId_lessonId }, create: {...}, update: {} })`.
   - awards a module `UserBadge` when every lesson in the module is complete.
   - does NOT call `emitLessonCompleted`.

2. School (inside the iframe), `POST /api/school/embed/complete`
   (`src/app/api/school/embed/complete/route.ts`):
   - identity from the embed cookie via `readEmbedSession`; CSRF via `assertEmbedOrigin`.
   - license-gated via `checkEnrollmentLicense`.
   - same `prisma.lessonProgress.upsert(...)`.
   - THEN `await emitLessonCompleted(session.userId, lesson.id)`.
   - does NOT award badges.

**The webhook emitter (school-only), real signature:**
```ts
// src/lib/school-webhook.ts
export async function emitLessonCompleted(userId: string, lessonId: string): Promise<void>
```
It looks up the user's school enrollment and enqueues a `lesson.completed` webhook. For a B2C
learner (no `schoolId`) it returns immediately, it is a no-op.

**How Network Lab completion works (DECIDED 2026-07-17).** Network Lab is a lesson content type,
mounted on a lesson exactly like `CODE_PLAYGROUND`. It is NOT a standalone progress system and it
needs no route of its own.

- Add `NETWORK_LAB` to the `LessonContentType` enum. A `LessonContent` row of that type carries
  the level id (in `body`, mirroring how `CODE_PLAYGROUND` stores starter code in `body` plus
  `language`). The author picks that level with a **level-picker dropdown** in the content editor
  (the available levels from `levels.json`), the same authoring slot where `CODE_PLAYGROUND` asks
  for a language and starter code. The lesson viewer then renders exactly the picked level.
- The lesson viewer mounts it. `src/components/dashboard/lesson-viewer.tsx` switches on
  `content.type` and renders `<CodePlaygroundBlock .../>` for `CODE_PLAYGROUND`; add a
  `content.type === "NETWORK_LAB"` branch that mounts a `NetworkLabBlock` (passing `contentId`,
  the level id, and `userId`). Do the same in the school iframe renderer
  `src/components/school/embed-lesson-body.tsx`. Add the authoring tab in
  `src/components/dashboard/content-create-form.tsx` and the review branch in
  `src/components/dashboard/content-review-panel.tsx`, following `CODE_PLAYGROUND`.
- Completion is UNCHANGED. A lesson containing a `NETWORK_LAB` block is completed through the
  existing routes (`POST /api/curriculum/lessons/[lessonId]/complete` for B2C,
  `POST /api/school/embed/complete` for school), which upsert `LessonProgress` and, on the school
  side, emit `emitLessonCompleted`. Do NOT add a third completion site. On level win, the block
  calls the lesson's existing complete action; it does not invent its own.

Result: badges, module gates, the student progress view, and the teacher NERDC coverage report
all work with no new plumbing, because a Network Lab lesson is just a lesson. The `NETWORK_LAB`
content also inherits the content-review workflow (`ContentReviewStatus`) for free.

**Completion is noted for every lesson (requirement).** Finishing the activity records the lesson
complete: on level win the block calls the lesson's existing complete action, which writes
`LessonProgress`. This is the same behaviour the code-playground refactor is to adopt, completing
the interactive block should note the lesson, so treat "interactive block done, therefore lesson
completion recorded" as the shared rule for both blocks, not a Network-Lab-only trick.

**In-progress packet drafts (DIRECTION: server-side, shared with the code-playground refactor).**
`CODE_PLAYGROUND` currently keeps a student's unfinished code in `localStorage`
(`code-playground-block.tsx`: `kat:pg:${contentId}:code`). That is being changed: drafts move
IN-APP (server-side) so they survive a device switch. Network Lab is a peer interactive block, so
it uses the SAME server-side store, it does not build a parallel one. Proposed shared shape, one row
per (user, interactive block):
```prisma
model LessonBlockDraft {
  id        String   @id @default(cuid())
  userId    String
  contentId String   // the LessonContent this interactive block belongs to
  state     Json     // block-specific: code for CODE_PLAYGROUND, PlayerPacket[] for NETWORK_LAB
  updatedAt DateTime @updatedAt
  @@unique([userId, contentId])
}
```
Debounced upsert on edit through a small authenticated route, scoped to the caller's own `userId`
(a school pupil's drafts are theirs alone; never read a userId from the request). Gameplay state
only, no PII, no secrets. **DEPENDENCY / SEQUENCING:** this store lands with the code-playground
refactor. Network Lab draft persistence waits on it, and must not ship a second draft table. If
Network Lab is built before that refactor, either land `LessonBlockDraft` as part of it or leave
drafts in-memory for the session, do NOT reintroduce a lab-only localStorage or a lab-only table.

---

## Instruction copy (DECIDED: RICH_TEXT blocks, not MDX)

The repo has **no MDX / remark / contentlayer dependency**. Lesson content is DB rows:
```prisma
model LessonContent { type LessonContentType; title String; body String?; url String?;
  reviewStatus ContentReviewStatus @default(PENDING_REVIEW); ... }
```
Because Network Lab is now a lesson content type (above), instruction copy is authored as ordinary
`RICH_TEXT` `LessonContent` blocks on the SAME lesson, above or below the `NETWORK_LAB` block,
edited through the existing content editor and review workflow. No MDX, no per-level content files.
Primary vs SS1 wording differences are handled by placing each level's lesson in the appropriate
curriculum (see the track gating open question), not by a content-level variant switch.

---

## The engine model (unchanged, this is the whole thing)

Four pure concepts. Keep them small and DOM-free.

### Device
A canvas node: `id` (its IP/name), `image`, position (`x`,`y` as 0..1 fractions), `ports`, and
optionally a `script` (behaviour) and flags (`player`, `secret`, `capacity`, `rules`).

### Link
An edge between two device ports: `{ src, srcport, dst, dstport }`. Routing is port-based; a
device with no matching port rule falls back to its first link. The origin engine guarded
`getRemotePort` so scripts cannot read animation internals, preserve that boundary.

### Packet
```ts
type Packet = {
  network?:     { srcip?: string; dstip?: string };
  transport?:   { proto?: string; ttl?: number };
  application?: { type?: string; key?: string };
};
```
Students edit these fields in a side panel and launch from any `player: true` device. A packet
animates source to destination over roughly 3s (scaled by game speed). On arrival, the
destination device's script fires.

### Level
Declarative JSON: `devices`, `links`, a `timeline` of auto-fired packets to observe, and
`triggers` (win conditions). When every trigger is `completed`, the level is won.

**Trigger types:** `packet` (a device received a packet whose specified header fields match,
case-insensitive and trimmed; optional `times` requires N; optional `payload` narrows) and
`flood` (a `capacity` device's flood meter reaches max; port the meter arithmetic exactly).

### Device scripts (port these nine faithfully)
Pure functions that may only cause effects through `sendPacket`:

| Script | Behaviour |
|---|---|
| `ping` | Replies to ICMP/echo by swapping src/dst back to sender |
| `manualRouter` | Forwards by rules; decrements TTL; ICMP error at TTL 0; answers ICMP to itself |
| `modem` | NAT: rewrites outgoing src to one address, maps replies back (table keyed by proto) |
| `switch` | Learns src to port over time; forwards by learned table (powers Spoofs 2 timing) |
| `firewall` | Drops packets whose src is on a blocklist |
| `broadcast` | Replicates a "Broadcast"-addressed packet to all machines (Smurf, DoS 3) |
| `encryption` | Models the key-exchange protocol Eve subverts (Attacks 1, MITM) |
| `tappedRouter` | A router Eve controls: observe and spoof (Attacks 1) |
| `proxy` | Rewrites packets addressed to itself onward to the blocked destination (Attacks 2) |

New for the web unit (Phase 4): `dnsServer` and `webServer`. Same pure-function shape.

---

## Levels

`levels.json` in this folder holds the 13 original levels, converted to JSON, ordered, with `id`
and `unit`, and the level01 link bug fixed. Unit order and intended audience:

- **basics** (level01 to 05): Primary 5 to 6 (reworded) and SS1.
- **spoofs** (spoofs01 to 02): SS1.
- **dos** (dos01 to 03): SS1.
- **attacks** (attacks01 to 03): SS1.
- **web** (new: dns01, http01): both tracks. Specs in the build guide.

The "Primary 5 to 6" and "SS1" columns are **authoring guidance, not code**. The lab does not gate
by track or `nerdcLevel`. Which levels a student sees follows from what the author picks per
`NETWORK_LAB` block and which program (a class, its modules are that class's terms) the lesson is
placed in. So a Primary class gets only the levels authored into its program, and SS1 gets whatever
is authored into its own. No track logic lives in this module.

---

## Brand (verified: warm only, NO blue)

- Primary: `--kat-clay` `#B2401D` (`bg-kat-clay`). Hover/pressed: `--kat-clay-deep` `#8F3316`.
- Ink `--kat-ink` `#1A1714`, paper `--kat-paper` `#F4EEE2`, sun `--kat-sun` `#F2B705`,
  pine `--kat-pine` `#1F5C4A` (success/verified).
- **NO blue, navy, or slate.** This is a hard, build-enforced rule
  (`src/__tests__/design/design-tokens.test.ts` fails on any blue hex or blue token, app-wide).
  The earlier drafts said "navy/blue accents" and "contrast on clay/navy", that is wrong for this
  repo. Use clay/ink/paper/sun/pine only. For a warm secondary accent use Tailwind `orange-*`
  (primary orange buttons are `orange-700`, hover `orange-800`, for AA contrast).
- Never surface any provider/library credit in student-facing UI. The MIT NOTICE for the origin
  engine lives in a repo file and source comments only, never on screen.

---

## Conventions and guardrails (defer to root CLAUDE.md)

- **No em-dashes anywhere in `src/`** (this file included). Build-checked with a ripgrep scan of
  `src/` for the em-dash character.
  The original drafts were full of them; keep the corrected versions clean.
- **No blue anywhere** (above).
- TypeScript strict; no `any` in engine code.
- Pure engine, thin React shell: all simulation logic in `src/lib/network-lab/`, testable without
  a DOM. UI only renders state and dispatches actions.
- **Tests go in `src/__tests__/lib/network-lab/`** (Vitest `4.1.6`). A level is correct if its
  intended solution satisfies its triggers and no trivial/empty solution does. Coverage `include`
  is `src/lib/**/*.ts`, so engine code is measured automatically.
- Imports use the `@/` alias and named imports. Routes return via `fail` / `ok` from `@/lib/http`
  and validate input with Zod before any DB access.
- Mobile/tablet first: the original was desktop-only. This port must be responsive (canvas
  scales; side panel stacks under the canvas on narrow screens).
- Accessibility: keyboard-operable editor and pause/play; sufficient contrast (warm palette);
  respect the global `prefers-reduced-motion` block in `globals.css` for the packet animation.
- No external network calls from the engine. Everything is local simulation.

---

## Definition of done (per phase)

Types compile under strict mode; the module's Vitest tests in `src/__tests__/lib/network-lab/`
pass; affected levels are completable end-to-end on desktop and a narrow viewport; and completing
a lesson that carries a `NETWORK_LAB` block writes the real `LessonProgress` row so it appears in
the existing progress view and (for school pupils) the teacher coverage report.
