# Pyodide Integration Audit

Audit the existing Pyodide / in-browser Python execution integration in this codebase. **Do not change any code.** This is a read-only investigation. Produce a findings report; I will decide what to act on afterwards.


## Step 1 — Map what exists

Locate and list every file involved in Python execution. For each, give the path and a one-line description of its role:

- Pyodide loader / bootstrap code
- Web Worker or worker-thread files, if any
- The editor component(s) and the console/output UI
- Any test-runner, checker, or auto-grading logic
- Prisma models and API routes that store or receive Python submissions
- `next.config.*`, middleware, and any header configuration touching COOP/COEP
- Vitest specs covering any of the above

Produce a short architecture summary — how a student's code currently travels from keystroke to stored result — before moving on.

## Step 2 — Assess against this checklist

For each item: state **Done / Partial / Missing / Not applicable**, cite the specific `file:line` evidence, and note the impact if it's not done. Be concrete. If you cannot find evidence either way, say "could not determine" rather than assuming.

### Runtime and loading
1. Is the Pyodide version explicitly pinned, or is it loading from a `dev`/unversioned CDN URL?
2. Is the runtime served from our own R2 bucket or from a third-party CDN?
3. Is it lazy-loaded only on routes that need Python, or does it load on the dashboard/shell?
4. Is there a caching strategy (service worker, HTTP cache headers) so returning students don't re-download the payload?
5. What is the actual transferred payload size on a cold load, and which packages are being pulled in?

### Execution safety and UX
6. Does Python run in a Web Worker, or on the main thread?
7. Can a runaway loop (`while True:`) be terminated? Is there a wall-clock timeout with worker `terminate()`?
8. Is stdout capped/truncated, or can a `print` in a loop exhaust memory?
9. Is `input()` supported? If so, how — SharedArrayBuffer + Atomics, a service worker, or a shim?
10. If cross-origin isolation (COOP/COEP) headers are set for `input()`: do they break the embedded Blockly / TurboWarp / PictoBlox / App Inventor iframes? Check which routes the headers apply to and which routes host those embeds. Flag any overlap as high severity.
11. Is `turtle` available? Is `matplotlib` wired to render? These matter for the Primary tier.
12. Are Python errors surfaced raw, or translated into age-appropriate messages? Is there any mapping layer for common beginner errors (NameError, IndentationError, TypeError)?

### Teaching features
13. Is there a variable inspector, step-through debugger, or any state introspection built on the JS↔Python FFI — or is it output-only?
14. Is execution state reset between runs, or does a previous run's namespace leak into the next?

### Submission pipeline and integrity
15. Do Python submissions flow into the **same** Prisma schema and submission shape as Blockly/Scratch/PictoBlox, or is there a parallel path?
16. Are test cases / expected outputs shipped to the client bundle? Search for any hardcoded expected answers, assertion sets, or grading logic in client-side code. **Flag every instance** — a student can read these from the bundle.
17. Is there any server-side verification of results, or is the client's pass/fail claim trusted as written to the database?
18. Does the API accept a submitted *result* from the client, or only *source code*? Check the route handlers and their validation schemas.

### Performance, resilience, observability
19. What happens on a low-end Android device or a slow connection — is there a loading state, a timeout, a fallback?
20. Are Pyodide load failures, execution timeouts, and worker crashes reported to Sentry, or do they fail silently?
21. Is there any offline or retry behaviour if the runtime fetch fails mid-download?

### Testing and compliance
22. What Vitest coverage exists for the execution path? List which of the above behaviours are actually tested versus untested.
23. Does student-written code leave the device at any point — logged, stored, or sent to a third party? Note anything relevant to NDPA obligations around processing minors' data.

## Step 3 — Report

Output in this order:

1. **Architecture summary** — the keystroke-to-database path as it stands today.
2. **Findings table** — checklist item, status, `file:line`, one-line impact.
3. **Prioritised gaps** — grouped as Critical / Important / Nice-to-have. Critical means integrity holes (client-trusted grading, exposed test cases), anything that can hang or crash a student's browser, or a headers conflict that breaks the existing visual-tool embeds.
4. **Recommended sequence** — the order I should tackle the gaps in, with each step scoped small enough to review as a single diff. Note any dependencies between steps.

Do not write code, do not open PRs, and do not modify files. Where a fix is non-obvious, describe the approach in two or three sentences rather than implementing it.
