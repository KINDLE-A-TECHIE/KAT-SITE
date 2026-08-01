# KAT Network Lab, Build Guide

A phased plan for building the in-browser network and cybersecurity practical into the KAT
platform. Written to be executed with Claude Code, one phase per session. Pair this with the
module `CLAUDE.md` (context) and `levels.json` (the converted levels).

Reconciled against the real repo on 2026-07-16. Guessed paths and mechanisms have been replaced
with verified ones. Things the repo does not yet have are marked **OPEN QUESTION**, resolve those
with the product owner before building past them, do not invent a solution.

Target stack (verified): Next.js `^15.2.0` App Router on Vercel, TypeScript strict, Tailwind
`^3.4.19`, Vitest `4.1.6`, Postgres via Prisma `^6.4.1` (`@/lib/prisma` singleton), NextAuth
`^4.24.11`. School roles (`SCHOOL_ADMIN`, `TEACHER`) live on `SchoolMembership`, not `User.role`.

Read the module `CLAUDE.md` and the ROOT `CLAUDE.md` first. This guide DEFERS to both on writing
style (no em-dashes), palette (no blue), test layout (`src/__tests__/lib/`), imports, and tenant
isolation.

---

## Outcome

- A branded Network Lab experience inside the platform, no new hosting.
- 13 ported levels (networks + network-security) plus 2 new web-layer levels (DNS, HTTP).
- Progress saved through the platform's real `LessonProgress` layer (see Phase 3). Network Lab is
  a lesson content type mounted like `CODE_PLAYGROUND` (DECIDED 2026-07-17), so badges, gates,
  the student progress view, and teacher NERDC coverage all work with no new plumbing.
- Two audience configurations: Primary 5 to 6 (basics + web) and SS1 (full set + picoCTF capstone
  linked out). This is purely an authoring choice: the author picks a level per `NETWORK_LAB` block
  and places the lesson in the right program (a class). The lab has no track logic of its own.

---

## Phase 0, scaffold and types

**Goal:** a typed, empty engine and a route that renders a placeholder level.

1. Module code goes in `src/lib/network-lab/` (this folder already exists). Network Lab needs NO
   route of its own: it is a lesson content type (DECIDED, see Phase 3) mounted by the lesson
   viewer, exactly like `CODE_PLAYGROUND`. The playable UI is a `NetworkLabBlock` component under
   `src/components/**`, rendered by `src/components/dashboard/lesson-viewer.tsx` (B2C) and
   `src/components/school/embed-lesson-body.tsx` (school). There is NO `(platform)` route group;
   the drafts guessed one. For Phase 0, just render the block standalone on a scratch page to see
   a topology; do not wire it into a lesson or create route folders yet.
2. Define the core types in `src/lib/network-lab/types.ts`:
   ```ts
   export type Packet = {
     network?:     { srcip?: string; dstip?: string };
     transport?:   { proto?: string; ttl?: number };
     application?: { type?: string; key?: string };
   };
   export type DeviceScriptName =
     | "ping" | "manualRouter" | "modem" | "switch" | "firewall"
     | "broadcast" | "encryption" | "tappedRouter" | "proxy"
     | "dnsServer" | "webServer";           // last two are new (web unit)
   export type Device = {
     id: string; image?: string;
     x: number; y: number;                  // 0..1 canvas fractions
     ports?: number;
     player?: boolean; secret?: boolean;
     capacity?: number;                     // present on flood targets
     rules?: unknown;                       // router/nat/firewall state
     script?: DeviceScriptName;
   };
   export type Link = { src: string; srcport: number; dst: string; dstport: number };
   export type TimelineEvent = { type: "packet"; at: number; from: string; payload: Packet };
   export type Trigger =
     | { type: "packet"; device: string; payload?: Packet; times?: number }
     | { type: "flood"; device: string };
   export type Level = {
     id: number; unit: string; name?: string;
     devices: Device[]; links: Link[];
     timeline: TimelineEvent[]; triggers: Trigger[];
     nextLevel?: number;
   };
   export type PlayerPacket = { from: string; payload: Packet; repeat?: number };
   ```
3. Load `levels.json` typed as `Record<string, Level>`.
4. Render one level's devices and links as static SVG/HTML on the route. No animation yet.

**Claude Code prompt:**
> Read the module CLAUDE.md and the root CLAUDE.md. Scaffold Phase 0 in src/lib/network-lab:
> add types.ts exactly as specified, load levels.json typed, and render level id 1's devices
> (labelled icons at their x/y fractions) and links (lines) in a client component. Strict
> TypeScript, no any, no Phaser or jQuery. Warm palette only (no blue). Put the test in
> src/__tests__/lib/network-lab/levels.test.ts asserting levels.json parses and every level has
> at least one trigger. Do not decide the route mount point; leave a placeholder page.

**Done when:** the placeholder renders level 1's topology; `levels.json` is fully typed; the test
in `src/__tests__/lib/network-lab/` passes.

---

## Phase 1, the simulation engine (pure, no UI)

**Goal:** a headless engine that runs a level to completion, testable without a DOM.

Build in `src/lib/network-lab/engine/`:

1. **Router/link resolution:** port `getDefaultRecipient`, `getPortRecipient`, and the guarded
   `getRemotePort` from the origin source. Port-based; fall back to first link.
2. **Packet lifecycle:** a `dispatch(fromId, portNum, packet)` that resolves the recipient and, on
   arrival, (a) evaluates triggers and (b) invokes the recipient's device script. In the headless
   engine arrival is immediate; animation timing lives in the UI layer (Phase 2).
3. **Trigger evaluation:** port `satisfiesTrigger` faithfully.
   - `packet`: destination matches; if `payload` given, every specified layer/field matches
     case-insensitively and trimmed; `times` decrements a counter.
   - `flood`: port the capacity/drain meter math exactly (the cadence, the cap, the decay). This
     is subtle, copy the arithmetic, then test it.
   - The level is won when every trigger has `completed`.
4. **Device scripts:** implement all nine in `engine/scripts.ts` as pure functions
   `(device, packet, portNum, api) => void`, where `api.sendPacket` is the only side-effect
   channel. Behaviours to preserve are listed in the module CLAUDE.md table.

**Claude Code prompt:**
> Read the module CLAUDE.md and Phase 1. Implement the headless engine in
> src/lib/network-lab/engine: link resolution, packet dispatch, trigger evaluation (packet +
> flood), and all nine device scripts as pure functions using only api.sendPacket for side
> effects. Port the flood meter arithmetic exactly. Then add Vitest tests in
> src/__tests__/lib/network-lab/engine.test.ts: for each of the 13 levels feed its intended
> solution and assert it reaches "won"; assert the flood and switch-timing math match expected
> values. No DOM, no any.

**Done when:** every one of the 13 levels can be driven to "won" in a headless test with its
intended solution, and the flood/switch tests pass.

---

## Phase 2, canvas, animation and the packet editor (UI)

**Goal:** the playable, responsive front end over the Phase 1 engine.

1. **Canvas:** render devices at `x/y` fractions and links as lines; scale to container.
   Responsive: on narrow screens the info/editor panel stacks under the canvas (the original's
   fixed 70/30 desktop split is not carried over).
2. **Animation:** a packet is a dot tweening src to dst over roughly 3s, driven by
   `requestAnimationFrame`, scaled by a game-speed setting (normal/fast) and a pause toggle.
   Respect the global `prefers-reduced-motion` block in `globals.css`. On tween complete, call the
   engine's arrival handler.
3. **Inspection:** pause, then click a device to see its info (respect the `secret` flag, show
   "secret" instead of the id) or click a packet to see its headers by layer.
4. **Packet editor:** a side panel to add/edit launcher packets: a "from" dropdown (player devices
   only) and inputs for the network/transport/application fields. Launch fires `dispatch`. Support
   the `repeat` field for flood levels.
5. **Win:** on level won, show the branded completion screen (warm clay palette, flame-and-wings)
   and a "next level" action.

**Claude Code prompt:**
> Read the module CLAUDE.md and Phase 2. Build the React UI over the headless engine: responsive
> canvas, rAF packet animation with pause and normal/fast speed (honour prefers-reduced-motion),
> click-to-inspect devices and packets (honour the secret flag), and a packet editor panel.
> Wire launch and win to the engine. Warm palette only (no blue); use bg-kat-clay and the kat
> tokens. Must work on a 380px-wide viewport with the panel stacked under the canvas. No jQuery,
> no Phaser.

**Done when:** all 13 levels are completable by hand on desktop and a narrow viewport,
pause/inspect/edit/launch work, and completion shows the branded screen.

---

## Phase 3, progress, roles and instruction copy

**Goal:** persistence and audience fit through the platform's REAL systems. Read this phase
against the module CLAUDE.md "Progress and completion" section. Network Lab is a lesson content
type mounted like `CODE_PLAYGROUND` (DECIDED 2026-07-17); there is no milestone event.

1. **Make Network Lab a content type.** Add `NETWORK_LAB` to the `LessonContentType` enum. A
   `LessonContent` row of that type carries the level id in `body` (mirroring how `CODE_PLAYGROUND`
   stores starter code in `body` plus `language`). Then:
   - render it: add a `content.type === "NETWORK_LAB"` branch that mounts `<NetworkLabBlock .../>`
     in `src/components/dashboard/lesson-viewer.tsx` (B2C) and
     `src/components/school/embed-lesson-body.tsx` (school), exactly beside the existing
     `CODE_PLAYGROUND` branch.
   - author it: add the tab in `src/components/dashboard/content-create-form.tsx` and the review
     branch in `src/components/dashboard/content-review-panel.tsx`, following `CODE_PLAYGROUND`.
     Where `CODE_PLAYGROUND` asks the author for a language and starter code, `NETWORK_LAB` shows a
     **level picker**: a dropdown of the available levels from `levels.json` (level01, level02, ...
     dns01, http01). The chosen level id is saved to `body`. This is the whole of "which level shows
     here"; the author picks it per block, and the lesson viewer renders exactly that level.
   The content-review workflow (`ContentReviewStatus`) then applies for free.

2. **Completion is UNCHANGED, it is the lesson's.** A lesson carrying a `NETWORK_LAB` block is
   completed through the existing routes, which already do the right thing:
   - B2C: `POST /api/curriculum/lessons/[lessonId]/complete` (learners `STUDENT`/`FELLOW`; upserts
     `LessonProgress` by `userId_lessonId`; awards the module badge; verifies enrollment).
   - School (iframe): `POST /api/school/embed/complete` (embed-cookie identity; license-gated;
     upserts `LessonProgress`; then `await emitLessonCompleted(userId, lessonId)`).

   Do NOT add a third completion site. On level win, `NetworkLabBlock` calls the lesson's existing
   complete action, the same one every other lesson uses. Adding a fourth `lessonProgress.upsert`
   that forgets `emitLessonCompleted` would silently drop school webhooks (the two existing routes
   already diverge: B2C awards a badge and does not emit; school emits and does not award a badge).
   The school emitter's real signature, for reference only:
   ```ts
   // src/lib/school-webhook.ts
   export async function emitLessonCompleted(userId: string, lessonId: string): Promise<void>
   ```

3. **Save/load in-progress drafts (DIRECTION: server-side, shared store).** `LessonProgress` cannot
   hold a student's unfinished packet launchers. `CODE_PLAYGROUND` keeps them in `localStorage`
   today (`code-playground-block.tsx`: `kat:pg:${contentId}:code`), but that is being moved IN-APP
   so drafts survive a device switch. Network Lab uses the SAME server-side store, not a parallel
   one. Proposed shared shape (one row per user + interactive block):
   ```prisma
   model LessonBlockDraft {
     id        String   @id @default(cuid())
     userId    String
     contentId String   // the LessonContent this interactive block belongs to
     state     Json     // code for CODE_PLAYGROUND, PlayerPacket[] for NETWORK_LAB
     updatedAt DateTime @updatedAt
     @@unique([userId, contentId])
   }
   ```
   Debounced upsert on edit via a small authenticated route, scoped to the caller's own `userId`.
   **This depends on the code-playground refactor that introduces the shared store; sequence it
   after (or land `LessonBlockDraft` as part of it).** Do NOT ship a lab-only table or lab-only
   localStorage. `LessonProgress` stays the single source of truth for "did this count".

4. **Instruction copy = RICH_TEXT blocks on the same lesson (DECIDED).** No MDX. Author the
   per-level instructions as ordinary `RICH_TEXT` `LessonContent` blocks above/below the
   `NETWORK_LAB` block, through the existing content editor. Rewrite in KAT's voice, localise
   device names (Chidi, Amaka, Tunde, Ngozi, Emeka, Ada), and replace "Google" with a neutral
   "Search Server". Primary vs SS1 wording is handled by which curriculum the level's lesson sits
   in, not a content-level variant switch (see track gating below).

5. **Track gating is authoring, not code (DECIDED).** The lab does NOT gate by track, grade,
   `nerdcLevel`, or audience. Which levels a student sees is entirely a consequence of two things
   KAT staff already control by hand: the level the author picked for each `NETWORK_LAB` block, and
   which program (a class; its modules are that class's terms) the author placed that lesson in.
   Want a Primary class to see only basics and web? Author only those levels into that class's
   program. Want SS1 to see everything? Author all of them into theirs. The "Primary / SS1" columns
   in the level inventory are guidance for whoever builds the curriculum, not a runtime switch. No
   `nerdcLevel` logic, no audience branch, and nothing new in this module.

**Claude Code prompt:**
> Read the module CLAUDE.md and Phase 3, and the "Progress and completion" section especially.
> Add NETWORK_LAB to LessonContentType and mount NetworkLabBlock from the content-type branch in
> lesson-viewer.tsx and embed-lesson-body.tsx, exactly like CODE_PLAYGROUND; add the authoring tab
> and review branch too. Do NOT add a new completion route or emit a milestone event; on level win
> call the lesson's existing complete action so the current routes upsert LessonProgress (and, on
> school, emit emitLessonCompleted). Persist launcher drafts server-side in the shared
> LessonBlockDraft store (scoped to the caller's own userId); this depends on the code-playground
> refactor that introduces it, do NOT ship a lab-only table or lab-only localStorage.
> Author instructions as RICH_TEXT LessonContent blocks, not MDX. Reuse existing progress/teacher
> views, do not build new dashboards.

**Done when:** drafts save and restore per student; a won level writes a real `LessonProgress`
row that shows in the existing progress view and (for school pupils) the teacher coverage report;
Primary and SS1 see the correct units and copy.

---

## Phase 4, new web-layer levels (DNS + HTTP)

**Goal:** close the "how the internet works" gap using the same engine. New JSON levels plus two
new device scripts, no new mechanics.

### New device scripts

**`dnsServer`:** on receiving a packet whose `application.type === "dns_query"` addressed to it,
reply to the sender with `application.type: "dns_answer"` and the resolved address in
`application.key` (looked up in the device's `rules` map of name to address). Teaches: names are
not addresses; a lookup precedes connection.

**`webServer`:** on receiving a packet whose `application.type === "http_request"` addressed to
it, reply with an `http_response` packet back to the sender (optionally echoing a requested path
in `application.key`). Teaches: request then response, client vs server.

Add both to `DeviceScriptName` and implement them as pure functions like the other nine.

### `dns01`, "Finding the address" (both tracks)

- **Devices:** a player computer (Chidi), a `dnsServer` (rules `{ "katlearning": "10.0.0.5" }`),
  and the destination server at `10.0.0.5`.
- **Concept:** you cannot reach a site by name directly, ask the DNS server for its address, then
  send your real packet there.
- **Triggers (two, in order):**
  1. `packet` at the `dnsServer` with `application: { type: "dns_query", key: "katlearning" }`.
  2. `packet` at the destination `10.0.0.5` with a normal packet.
- **Win:** both triggers `completed`.

### `http01`, "Asking a server for a page" (both tracks; SS1 can go deeper)

- **Devices:** player computer (Amaka), a `manualRouter` in the middle, a `webServer`.
- **Concept:** the web is request/response.
- **Triggers:**
  1. `packet` at the `webServer` with `application: { type: "http_request" }`.
  2. `packet` back at the player device with `application: { type: "http_response" }` (fired by the
     `webServer` script).
- **Win:** both `completed`.
- **SS1 extension (optional `http02`):** introduce HTTPS by reusing the `encryption` concept from
  Attacks 1, an eavesdropping router can read an `http_request` but not an encrypted one.

**Claude Code prompt:**
> Read the module CLAUDE.md and Phase 4. Add two pure device scripts, dnsServer and webServer,
> and add them to DeviceScriptName. Author dns01 and http01 as JSON with the specified devices,
> links, and triggers, plus Primary and SS1 instruction copy (per the resolved content approach).
> Add Vitest tests in src/__tests__/lib/network-lab/ that drive each new level to "won". Place
> both in a new "web" unit shown to both tracks.

**Done when:** dns01 and http01 are completable in-browser, their tests pass, and both appear in
the web unit for Primary and SS1.

---

## Phase 5, polish, QA and rollout

1. **Content pass:** curriculum review of every instruction block for age-appropriateness and KAT
   voice; confirm device names localised; confirm no external brand names remain.
2. **Accessibility and mobile:** keyboard-operable editor and pause/play; warm-palette contrast
   check (no blue); full run-through on a tablet-width viewport; honour `prefers-reduced-motion`.
3. **Level integrity tests:** for every level, assert the intended solution wins AND a trivial
   empty solution does not (guards against accidental wins like the original level01 link bug,
   already fixed in `levels.json`).
4. **Teacher view check:** complete a lesson carrying a `NETWORK_LAB` block as a test school pupil;
   confirm it surfaces in the `TEACHER`/`SCHOOL_ADMIN` coverage report through the real
   `LessonProgress` write and `emitLessonCompleted`.
5. **SS1 capstone link:** add a "real-world challenge" card linking SS1 students to a picoCTF
   classroom, positioned after the attacks unit.
6. **Rollout is authoring, no feature flag needed (DECIDED).** A program is a class (its modules are
   that class's terms), so a program is never shared across classes. To pilot, author the Network
   Lab lessons only into the program(s) you are piloting and publish them; publishing the lesson is
   the rollout, and because program equals class it is already class-granular. Widen the pilot by
   authoring the lessons into more programs. (Invariant to keep: `SchoolClass.programId` is not
   unique in the schema, so this relies on the build practice of one program per class. If that ever
   breaks, revisit.)

---

## Level inventory (shipped in `levels.json`)

| id | key | unit | Teaches | Primary | SS1 |
|----|-----|------|---------|:------:|:---:|
| 1 | level01 | basics | Interface; inspect devices and packets | yes | yes |
| 2 | level02 | basics | Build and send a packet; src/dst | yes | yes |
| 3 | level03 | basics | Protocols; ICMP ping/echo | yes | yes |
| 4 | level04 | basics | Routers and routing tables | yes | yes |
| 5 | level05 | basics | Modems / NAT / home network | yes | yes |
| 6 | spoofs01 | spoofs | Spoofing a source address | | yes |
| 7 | spoofs02 | spoofs | Switches; stealing a packet by timing | | yes |
| 8 | dos01 | dos | Denial of Service (flooding) | | yes |
| 9 | dos02 | dos | Firewalls and DDoS | | yes |
| 10 | dos03 | dos | Broadcast / Smurf amplification | | yes |
| 11 | attacks01 | attacks | Man-in-the-middle + encryption keys | | yes |
| 12 | attacks02 | attacks | Proxies and censorship evasion | | yes |
| 13 | attacks03 | attacks | TTL and traceroute | | yes |
| new | dns01 | web | DNS: names to addresses | yes | yes |
| new | http01 | web | HTTP request/response | yes | yes |

Cyber-hygiene topics (passwords, phishing, safe browsing) are intentionally NOT built as
simulator levels. They are better delivered as short interactive lessons in the existing lesson
engine, sitting alongside this module.

---

## Attribution note (repo only, never in UI)

The engine's mechanics derive from an MIT-licensed open-source simulator. Keep a `NOTICE` file in
the module root carrying the original MIT copyright line. Student-facing screens show only KAT
branding.
