# Pyodide Integration Audit, Findings

Read-only investigation per `docs/audits/pyodide-audit-prompt.md`. No code was changed.
Date: 2026-07-23. Evidence is cited as `file:line`.

---

## 1. Architecture summary (keystroke to stored result)

There is **one** component: `src/components/dashboard/code-playground-block.tsx` (2641 lines). It
handles three execution modes and Pyodide is only one of them.

- A learner types in a Monaco editor (`@monaco-editor/react`, dynamically imported client-only,
  code-playground-block.tsx:16). Code is held in React state and mirrored to `localStorage`
  (`kat:pg:<contentId>:code`, :1014, :1211-1221). No keystroke leaves the device by itself.
- **Web mode** (HTML/CSS, or a project containing an `.html`): rendered locally in a sandboxed
  `<iframe srcdoc>` (:1130-1174, :1544-1546). Nothing leaves the device.
- **Browser-Python mode** (Pyodide): the user opts in via a toggle (`pyodideMode`, default `false`,
  :1036). On the first Run, `initPyodide()` injects `<script src=".../pyodide.js">` from the
  jsdelivr CDN and calls `loadPyodide()` (:1359-1373). Code runs with `runPythonAsync(code)` on the
  **main thread** (:1446); stdout/stderr are captured through a Python `StringIO` swap (:1441-1451)
  and shown in the output panel (:2426-2441). Python source stays on the device (packages are
  fetched from PyPI via micropip, :1388-1405).
- **Server-Python / all other languages** (Judge0): the client POSTs `{ code, stdin,
  additional_files? }` to `POST /api/curriculum/contents/[contentId]/run` (:1577). That route
  authenticates, rate-limits, checks the content is a published `CODE_PLAYGROUND`, then forwards the
  **source** to a self-hosted Judge0 CE (`/submissions?wait=true`, else async polling) and returns
  stdout/stderr/exit only (run/route.ts:73-227). It stores nothing.
- **Submission** (a separate button): the current file(s) are zipped client-side and uploaded as a
  `Project` capstone (`POST /api/projects` → presigned R2 PUT → `PATCH status:"SUBMITTED"`,
  :1777-1824). Instructors review it by hand. There is **no auto-grading and no test-case
  comparison** anywhere in the code path.

So: keystroke → React state (+ localStorage) → either in-browser (Pyodide/iframe) or self-hosted
Judge0 for a transient run → optionally a zip of source into R2 for human review. No pass/fail is
ever computed on the client and trusted.

---

## Step 1, file map

| File | Role |
|---|---|
| `src/components/dashboard/code-playground-block.tsx` | The ENTIRE editor + console UI, Pyodide bootstrap, turtle/pygame/pgzero shims, Judge0 client, peer-session + submit + invite logic. |
| `src/app/api/curriculum/contents/[contentId]/run/route.ts` | Server run route: auth, rate limit, publish gate, forwards source to Judge0. |
| `src/app/api/projects/route.ts` + `.../[projectId]/upload-url`, `/files`, `PATCH` | Submission pipeline (zip of source → R2 → Project for review). |
| `next.config.ts` | Security headers. **No COOP/COEP.** X-Frame-Options, nosniff, HSTS, etc. (:33-73). |
| `public/sw.js` | PWA service worker. Caches same-origin app shell + `/_next/static` only; does **not** touch cross-origin Pyodide (:98-125). |
| `src/lib/nerdc-crosswalk.ts` | Curriculum text only; mentions "Scratch/Blockly" as syllabus content (:34, :88, :445). No such tool is embedded anywhere. |
| Prisma `LessonContent` (type `CODE_PLAYGROUND`, `language`), `Project`, `ProjectFile` | Playground content + submission storage. No Python-result or test-case model exists. |
| Tests | **None** cover execution. Only `src/__tests__/lib/nerdc-crosswalk.test.ts` matched, unrelated. |

No dedicated Pyodide loader module, no Web Worker file, no worker-thread file exist. Everything is
inline in the one component.

---

## Step 2, checklist assessment

### Runtime and loading

| # | Item | Status | Evidence | Impact if not done |
|---|---|---|---|---|
| 1 | Version pinned vs unversioned CDN | **Done** (pin) but no SRI | `.../pyodide/v0.26.4/full/` at code-playground-block.tsx:1363,1373 | Pinned, good. No Subresource-Integrity hash on the injected script, so a jsdelivr compromise executes arbitrary JS in a logged-in session. |
| 2 | Served from our R2 vs third-party CDN | **Missing (third-party)** | jsdelivr hardcoded :1363,1373 | External dependency for a core teaching feature; an outage or a school firewall blocking jsdelivr breaks Python. No SRI (see #1). |
| 3 | Lazy-loaded only where needed | **Done** | `pyodideMode` default false :1036; script injected only inside `initPyodide` :1359, called from Run/install | Good, no cost on the dashboard/shell. |
| 4 | Caching for returning students | **Partial** | SW ignores cross-origin :98-125; relies on jsdelivr HTTP cache headers | Repeat loads are served by the browser HTTP cache (jsdelivr sets long max-age), but there is no app-owned/offline strategy; a cache eviction or first-visit-per-device re-downloads the whole runtime. |
| 5 | Cold payload size / packages pulled | **Could not determine precisely** (not measured live) | `loadPyodide` full build :1373; `loadPackagesFromImports(code)` :1438; `micropip.install` :1396 | Pyodide 0.26 `full` core is roughly 6-10 MB over the wire before any package; `numpy`/`matplotlib` add several MB each on demand. Heavy for a low-end device on mobile data. Measure with DevTools before optimising. |

### Execution safety and UX

| # | Item | Status | Evidence | Impact |
|---|---|---|---|---|
| 6 | Worker vs main thread | **Missing (main thread)** | `await py.runPythonAsync(code)` :1446; zero `new Worker` in the codebase | The UI thread is blocked for the whole run. See #7. |
| 7 | Can a runaway loop be terminated? Wall-clock timeout + `terminate()`? | **Missing** | No timeout wraps :1446; no worker to terminate; COOP/COEP absent so Pyodide's SAB interrupt buffer is unavailable | **`while True:` freezes the tab with no escape but a manual close.** For young learners this is the single worst UX/stability gap. Cannot be fixed without a Worker (or interrupt buffer + COOP/COEP). |
| 8 | stdout capped/truncated? | **Missing** | `sys.stdout.getvalue()` returns the whole buffer :1450; no size cap | `while True: print(x)` grows the `StringIO` unbounded → memory exhaustion → tab crash (compounds #7). |
| 9 | `input()` support and mechanism | **Partial / inconsistent** | stdin textarea :2225 feeds **only** the Judge0 body :1572-1574; `runPyodide` never configures stdin | In Judge0 mode `input()` reads the stdin box. In Pyodide mode the box is ignored; Pyodide's default main-thread `input()` falls back to a blocking `window.prompt()`, a different, surprising behaviour. No SharedArrayBuffer path (COOP/COEP absent). |
| 10 | COOP/COEP for `input()` breaking Blockly/TurboWarp/PictoBlox/App Inventor embeds | **Not applicable today** | No COOP/COEP in next.config.ts:33-73; no such embed exists (only curriculum text in nerdc-crosswalk.ts) | No conflict now. **Forward caution:** the JSS3 syllabus plans Scratch/Blockly (nerdc-crosswalk.ts:445). If those get embedded AND COOP/COEP is later added to enable `input()`, they will collide; solve `input()` with a Worker/service-worker shim instead of site-wide COEP. |
| 11 | `turtle` / `matplotlib` available? | **Turtle Done; matplotlib Missing** | Full canvas-backed `turtle` shim :71-361 (+ pygame :364, pgzero :745), injected pre-run :1431-1434 | Turtle/pygame/pgzero render to `#kat-turtle-canvas`. No matplotlib backend is wired; `import matplotlib` would load the package but `plt.show()` has nowhere to draw. Primary-tier plotting is unsupported. |
| 12 | Errors raw vs age-appropriate | **Missing (raw)** | `pyError = String(e)` :1448, shown raw :2429; Judge0 stderr shown raw | Beginners see full tracebacks / `NameError:`… with no friendly mapping. No translation layer for NameError/IndentationError/TypeError. |

### Teaching features

| # | Item | Status | Evidence | Impact |
|---|---|---|---|---|
| 13 | Variable inspector / step debugger / introspection | **Missing** | Output-only; FFI used only for canvas drawing (:77, :369) | No state introspection. (Nice-to-have.) |
| 14 | State reset between runs | **Missing (leaks)** | Instance reused via `pyodideRef.current` :1356; `runPyodide` re-injects shims + swaps stdout but never clears globals :1407-1465 | A previous run's variables/functions/imports persist into the next run. A student can "pass" using a name they deleted from the editor, and stale state causes confusing bugs. |

### Submission pipeline and integrity

| # | Item | Status | Evidence | Impact |
|---|---|---|---|---|
| 15 | Python uses the same submission shape as block tools | **N/A (no parallel path; no block tools)** | Submit → `Project` + zip :1777-1824 | Only one submission path (Project/capstone). No Blockly/Scratch/PictoBlox submission exists to diverge from. |
| 16 | Test cases / expected outputs in the client bundle | **None found (good)** | No `expected`/`testCase`/`correctAnswer` in the playground or run path; submit stores source only | No code auto-grading exists, so there are no answers to leak. (Note: MCQ *quizzes* are a separate system, out of this audit's scope; if any quiz ships answer keys to the client, audit that separately.) |
| 17 | Server-side verification vs trusting a client pass/fail | **Done (nothing is trusted)** | run/route.ts executes source and returns raw output; it computes no pass/fail and writes nothing | No client verdict is accepted. Human review is the grade. |
| 18 | API accepts a *result* or only *source*? | **Done (source only)** | Body validated to `{ code, stdin, additional_files }`, code required + capped 50k, run/route.ts:114-119 | No result field is accepted or stored. |

### Performance, resilience, observability

| # | Item | Status | Evidence | Impact |
|---|---|---|---|---|
| 19 | Low-end / slow-connection behaviour | **Partial** | `pyodideLoading` spinner :1038,:1357,:1384; Judge0 has timeouts (:158,:173,:190) and a 504 (:201,:223) | There is a loading state, but no Pyodide load timeout (a stalled jsdelivr fetch hangs on "loading"), no size warning, no fallback to server mode on failure. |
| 20 | Load failures / timeouts / crashes → Sentry | **Missing** | Pyodide load failure only `toast.error` + `setPyodideMode(false)` :1379-1382; run route uses `console.warn/error` :167,179,205, not `captureError` | Execution failures are invisible to Sentry. You cannot see how often Python fails to load or Judge0 errors in production. |
| 21 | Offline / retry on mid-download failure | **Missing** | `initPyodide` reject → toast, no retry :1365,:1380 | A dropped connection mid-download just fails; the student must toggle again. |

### Testing and compliance

| # | Item | Status | Evidence | Impact |
|---|---|---|---|---|
| 22 | Vitest coverage of the execution path | **Missing** | No test references Pyodide/Judge0/the run route; only `route-authorization.test.ts` checks the route's *auth* generically | Turtle-shim correctness, the Judge0 mapping, the publish gate, the code-length cap, and every behaviour above are untested. Regressions ship silently. |
| 23 | Does student code leave the device (NDPA)? | **Documented, mixed** | Pyodide runs locally (source stays); Judge0 mode POSTs source to our server → self-hosted Judge0 (run/route.ts:154); submit stores a zip in our R2 (:1807) | Server/Judge0 are self-hosted (not third-party), and the run route stores nothing and does not log the source (only Judge0 status/detail, :167,179,205). micropip fetches package names from PyPI (third-party), not student code. For NDPA: transient server processing of minors' code is defensible; document it, and note the submitted-zip retention in R2. |

---

## Step 3, prioritised gaps

### Critical (can hang/crash a child's browser, or a supply-chain hole)
1. **No runaway-loop protection (#6, #7, #8).** Main-thread execution with no timeout and an
   unbounded stdout buffer means `while True:` (or `while True: print(...)`) freezes or crashes the
   tab with no recovery. This is the top priority; it is a routine thing a beginner writes.
2. **Third-party CDN with no SRI (#1, #2).** A core feature loads executable JS from jsdelivr into an
   authenticated session with no integrity check and no fallback.

### Important (correctness, trust in results, observability)
3. **Namespace leaks between runs (#14).** Stale globals make results non-reproducible and confuse
   learners.
4. **No observability (#20).** Pyodide load failures and Judge0 errors never reach Sentry.
5. **`input()` inconsistency (#9)** and **raw tracebacks (#12).** Different behaviour per mode and
   unfriendly errors hurt the Primary/JSS beginner experience.
6. **Zero execution-path tests (#22).** Nothing guards the run route's gates or the shims.

### Nice-to-have
7. matplotlib backend (#11), app-owned Pyodide caching/offline (#4, #21), payload measurement (#5),
   a variable inspector (#13), age-appropriate error mapping layer (#12).

### Not a problem (recorded so they are not re-opened)
- No client-trusted grading and no exposed test cases (#16, #17, #18): the design is sound, source
  only, human-reviewed.
- No COOP/COEP conflict today (#10): no visual-tool embeds exist. Keep it that way, or solve
  `input()` without site-wide COEP.

---

## Step 4, recommended sequence (each step a small, reviewable diff)

1. **Move Python execution into a Web Worker with a wall-clock timeout + `terminate()`.** This is the
   keystone: it fixes #6, #7, and #8 together (a killed worker reclaims the runaway loop and its
   buffer). Cap stdout length in the worker and stream/truncate to the UI. Depends on nothing.
   Approach: a dedicated `pyodide.worker.ts` that owns `loadPyodide`, receives `{code, stdin}`,
   posts back `{stdout, stderr}`; the component arms a `setTimeout` that calls `worker.terminate()`
   and rebuilds the worker on timeout.
2. **Self-host the Pyodide runtime on R2 (or pin + add SRI).** Fixes #1/#2. Cheapest interim step is
   an SRI hash on the injected script; the fuller fix is serving `pyodide.js` + assets from our R2
   and pointing `indexURL` there. Independent of step 1 but touches the same `initPyodide`.
3. **Reset the Python namespace each run.** Fixes #14. In the worker (post step 1) this is free, a
   fresh interpreter per run, or `pyodide.runPython("globals().clear()")` plus a re-import of shims.
   Depends on step 1 for the clean seam.
4. **Wire `input()` to the stdin box in Pyodide mode, and add a Pyodide load timeout + fallback.**
   Fixes #9 and #19/#21. With a Worker (step 1) `input()` can use a SharedArrayBuffer+Atomics stdin
   *scoped to the worker* (no site-wide COEP needed), or a simpler "collect stdin upfront" shim.
   Depends on step 1.
5. **Report failures to Sentry.** Fixes #20. `captureError` in `initPyodide`'s catch and in the run
   route's `console.error` branches. Independent, small.
6. **Add an error-friendliness layer + matplotlib backend.** Fixes #12 and #11. A small mapper for
   NameError/IndentationError/TypeError; matplotlib via `matplotlib.use("module://…")` drawing to the
   existing canvas, or capture `savefig` to a PNG. Independent.
7. **Backfill Vitest coverage.** Fixes #22. Unit-test the pure helpers (`detectEntryFile`,
   `monacoLangFromFilename`, `buildWebDoc`, the language map) and the run route's gates (publish
   check, 50k cap, unsupported language, unauthorised). Do this alongside each step so new behaviour
   lands with tests.

Dependencies: step 1 unblocks 3 and 4; steps 2, 5, 6, 7 are independent and can land in any order.
Do step 1 first, it removes the only way a learner can brick their own session.
