# Self-hosted Scratch / TurboWarp editor (Phase 3a)

KAT embeds a **self-hosted, custom TurboWarp build** on a KAT-controlled origin, never the public
turbowarp.org (a page with minors on it must be first-party, framable under our CSP, and not dependent on
a third party). This directory is the recipe to stand that editor up and the bridge that lets the KAT app
load and save projects through it.

What ships in the KAT repo (done, verified):

- `src/lib/scratch.ts` — the parent-side contract: the feature flag, the editor origin, and the
  `postMessage` protocol (`SCRATCH_MSG`, `parseScratchInbound`, `loadMessage`, `saveMessage`,
  `isTrustedScratchMessage`). Unit-tested in `src/__tests__/lib/scratch.test.ts`.
- `NEXT_PUBLIC_SCRATCH_EDITOR_URL` in `.env.example` — unset means Scratch blocks are off.
- `bridge.js`, `_headers`, `_redirects` — the editor-side artifacts you deploy (below).

Building and deploying the editor itself runs in **your** infra (a large Node build + a Cloudflare
account), so it is not run from the app. The steps:

## 1. Get the GUI source

```bash
git clone https://github.com/TurboWarp/scratch-gui
cd scratch-gui
npm ci
```

## 2. Add the bridge (one wiring line)

Copy `bridge.js` into the GUI's playground entry directory and import it once from the entry that mounts
the GUI (e.g. `src/playground/render-gui.jsx`), **after** the GUI mounts. In that same entry, expose the
running VM so the bridge can reach it:

```js
// next to where the GUI is created/mounted:
window.__katVM = vm;      // the scratch-vm instance the GUI already builds
import "./bridge.js";     // starts the KAT bridge
```

`bridge.js` reads the KAT origin from a `?parent=<origin>` query param (the KAT iframe sets it) and only
obeys messages from that origin. It handles `LOAD` (fetch a `.sb3` and `vm.loadProject`) and `SAVE`
(`vm.saveProjectSb3()` -> `PUT` the bytes straight to the presigned R2 URL the KAT page hands it), and
reports `READY` / `DIRTY` / `SAVED` / `SAVE_FAILED` back up. The message strings mirror
`src/lib/scratch.ts` exactly — keep them in sync.

## 3. Build

```bash
npm run build           # produces build/ (a static SPA)
```

## 4. Deploy to Cloudflare Pages on a KAT custom domain

Deploy `build/` to Cloudflare Pages and put `_headers` and `_redirects` (from this directory) in the
output so headers + SPA routing are correct. Point a first-party custom domain at it, e.g.
`scratch.kindleatechie.com`. Do **not** set `X-Frame-Options` on the editor — KAT frames it, and framing
is gated by the KAT app's CSP `frame-src` allow-list, not by the editor.

`COOP`/`COEP` are optional and off by default (see `_headers`): they are only needed for TurboWarp's
compiler / SharedArrayBuffer, and they make cross-origin subresources need CORP/CORS. Enable them only if
you want the compiler.

## 5. Allow the editor origin to write to R2 (for direct saves)

The editor `PUT`s `.sb3` bytes to a presigned R2 URL. Add the editor's custom domain to the R2 bucket's
CORS allow-list for `PUT` (and `GET`, so it can load saved projects back). Exact origin, no wildcard.

## 6. Turn it on in the KAT app

Set `NEXT_PUBLIC_SCRATCH_EDITOR_URL=https://scratch.kindleatechie.com` and add that exact origin to the
KAT app's CSP `frame-src`/`child-src` in `next.config.ts`. Absent = Scratch stays off.

## 7. Round-trip smoke test

With the flag set, the KAT app can frame the editor at
`${NEXT_PUBLIC_SCRATCH_EDITOR_URL}/?parent=<KAT-origin>`, wait for a `READY` message, send `LOAD` (blank or
a starter `.sb3` URL), then `SAVE` with a presigned URL + key, and expect a `SAVED{key}` back with the
object present in R2. The KAT-side block that does this ships in **Phase 3b**; the presigned-PUT route it
calls is also 3b.

## Maintenance

This is a custom build tracking upstream TurboWarp. Re-pull, re-apply the two wiring lines, rebuild, and
redeploy when you take an upstream update. The bridge and headers here are version-independent; only the
`getVM()` wiring depends on the GUI's entry.
