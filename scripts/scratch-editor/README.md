# Self-hosted Scratch editor (Phase 3a)

KAT embeds a **self-hosted Scratch editor** on a KAT-controlled origin, never a public one (a page with
minors on it must be first-party, framable under our CSP, and not dependent on a third party). This
directory is the recipe to stand that editor up and the bridge that lets the KAT app load and save
projects through it.

**Base: vanilla `scratchfoundation/scratch-gui`, NOT TurboWarp.** Verified 2026-07-30 by reading both:
TurboWarp deliberately refuses to run in an iframe (`render-interface.jsx` bails to an `<InvalidEmbed/>`
screen when `window.parent !== window`), so it fights embedding and would need patching every upstream
release, plus a trademark rebrand. Vanilla scratch-gui has **no embed guard** and is built to be reused, so
it embeds cleanly. It only lacks TurboWarp's JS compiler, which a school editor does not need.

What ships in the KAT repo (done, verified):

- `src/lib/scratch.ts`: the parent-side contract, the `NEXT_PUBLIC_SCRATCH_EDITOR_URL` feature flag, the
  editor origin, and the `postMessage` protocol (`SCRATCH_MSG`, `parseScratchInbound`, `loadMessage`,
  `saveMessage`, `isTrustedScratchMessage`). Unit-tested in `src/__tests__/lib/scratch.test.ts`.
- `bridge.js`, `_headers`, `_redirects`: the editor-side artifacts you deploy (below).

Building and deploying the editor runs in **your** infra (a large Node build + a Cloudflare account). The
beginner-friendly path is to let Cloudflare Pages build from a GitHub fork (steps 1-4), so you never build
locally.

## 1. Fork the GUI

Fork `https://github.com/scratchfoundation/scratch-gui` to your GitHub, then clone your fork. (The
save/load API this bridge uses is confirmed against scratch-gui 5.3.0 / scratch-vm 5.0.300:
`vm.saveProjectSb3()` resolves to a `.sb3` Blob, and `vm.loadProject(arrayBuffer)` opens one.)

> NOTE: this standalone `scratch-gui` repo is ARCHIVED (read-only). It still forks, builds, and embeds
> exactly as described, so it is a fine **prototype** base to validate whether Scratch is worth it. It will
> not get upstream fixes, so it is NOT a permanent foundation. Once Scratch proves its worth, migrate to the
> maintained monorepo `@scratch/scratch-gui` (from `scratchfoundation/scratch-editor`), which is a LIBRARY,
> not a standalone app: you would write a thin host that creates the VM and mounts `<GUI vm={vm}>`, then add
> the same `KatVmExposer` + `bridge.js`. The bridge, the postMessage contract, and the VM save/load API are
> identical on both, so only this build step changes.

## 2. Add the bridge + expose the VM (no embed patch needed)

Vanilla scratch-gui embeds as-is, so there is no anti-embed guard to remove. Two small additions, both
touching `src/playground/render-gui.jsx` (the file whose default export mounts the editor):

**(a)** Add `src/playground/kat-vm-exposer.jsx` (the VM lives in the Redux store, so a tiny connected
component surfaces it):

```jsx
import {Component} from 'react';
import {connect} from 'react-redux';
class KatVmExposer extends Component {
    componentDidMount () { window.__katVM = this.props.vm; }
    componentDidUpdate () { window.__katVM = this.props.vm; }
    render () { return null; }
}
export default connect(state => ({vm: state.scratchGui.vm}))(KatVmExposer);
```

**(b)** In `render-gui.jsx`, import the bridge and the exposer, and render the exposer INSIDE the GUI
composition so it sits within `AppStateHOC`'s store `Provider`:

```jsx
import KatVmExposer from './kat-vm-exposer.jsx';
import './bridge.js';
// ...
// wrap GUI + the exposer together, then compose as the file already does:
const GuiWithBridge = props => (
    <React.Fragment>
        <GUI {...props} />
        <KatVmExposer />
    </React.Fragment>
);
const WrappedGui = compose(AppStateHOC, HashParserHOC)(GuiWithBridge);
```

Optionally drop the `window.onbeforeunload = () => true` line in that file so the iframe does not trigger a
"leave site?" prompt.

`bridge.js` reads the KAT origin from `?parent=<origin>` and only obeys messages from it. It handles `LOAD`
(fetch a `.sb3` and `vm.loadProject`) and `SAVE` (`vm.saveProjectSb3()` then `PUT` the bytes straight to
the presigned R2 URL the KAT page hands it), and reports `READY`/`DIRTY`/`SAVED`/`SAVE_FAILED` back up. It
also exposes `window.__katBridge.save() / .open()` and sends `REQUEST_SAVE` / `REQUEST_LOAD` up (the File
menu calls these; see 2b). The message strings mirror `src/lib/scratch.ts` exactly, keep them in sync.

**Branding.** scratch-gui is BSD-licensed, but the Scratch name and cat logo are trademarks with usage
guidelines (https://scratch.mit.edu/trademark). Follow them for anything a pupil sees.

## 2b. Wire the editor's File menu to KAT storage

So pupils save/open through the editor's OWN File menu (the place they already know) instead of a button on
the KAT page, patch `src/components/menu-bar/menu-bar.jsx`. `bridge.js` already exposes
`window.__katBridge.save() / .open()`; the menu just calls them.

**(a)** Add two bound handlers. In the `bindAll(this, [ ... ])` list, add `'handleKatSave'` and
`'handleKatOpen'`, then add the methods (next to `handleClickSave`):

```jsx
handleKatSave () {
    if (window.__katBridge) window.__katBridge.save(); // -> REQUEST_SAVE -> KAT mints a presigned URL
    this.props.onRequestCloseFile();
}
handleKatOpen () {
    if (window.__katBridge) window.__katBridge.open(); // -> REQUEST_LOAD (reload last save, with a confirm)
    this.props.onRequestCloseFile();
}
```

**(b)** Replace the File dropdown's "Load from your computer" + "Save to your computer" `<MenuSection>`
with two sections: KAT Save/Open first, the real file download/upload kept as a secondary export/import
(so nothing is lost, and `sharedMessages` + `SB3Downloader` stay used):

```jsx
{/* KAT: primary Save / Open go to the pupil's KAT storage via the bridge. */}
<MenuSection>
    <MenuItem onClick={this.handleKatSave}>{'Save'}</MenuItem>
    <MenuItem onClick={this.handleKatOpen}>{'Open my project'}</MenuItem>
</MenuSection>
{/* KAT: the real offline file download/upload, kept as a secondary export/import. */}
<MenuSection>
    <MenuItem onClick={this.props.onStartSelectingFileUpload}>
        {this.props.intl.formatMessage(sharedMessages.loadFromComputerTitle)}
    </MenuItem>
    <SB3Downloader>{(className, downloadProjectCallback) => (
        <MenuItem
            className={className}
            onClick={this.getSaveToComputerHandler(downloadProjectCallback)}
        >
            {'Download a copy'}
        </MenuItem>
    )}</SB3Downloader>
</MenuSection>
```

Result File menu: New / **Save** / **Open my project**, then a divider, then Load from your computer / Download a copy.
The KAT side (Phase 3b) answers `REQUEST_SAVE` / `REQUEST_LOAD` by minting a presigned URL scoped to that
pupil's own content, then replies with the existing `SAVE` / `LOAD`. `bridge.js` shows an in-editor toast on
save, so it works in full screen too.

## 2c. Stage video recorder

Pupils can record the STAGE to a `.webm` video with the project's own sounds and (optionally) mic narration,
then download it. Self-contained like the bridge/exposer, so it touches no vendored component.

**Add `src/playground/kat-recorder.jsx`** (a connected component that reads the VM from the store and renders
its own floating "Record video" control), and **mount it in `render-gui.jsx`** next to `KatVmExposer`:

```jsx
import KatRecorder from './kat-recorder.jsx';
// ...
const GuiWithBridge = props => (
    <React.Fragment>
        <GUI {...props} />
        <KatVmExposer />
        <KatRecorder />
    </React.Fragment>
);
```

How it works: `vm.renderer.canvas.captureStream(30)` for video; taps `vm.runtime.audioEngine.inputNode` into
a `MediaStreamDestination` (WITHOUT muting playback, the inputNode stays connected to the speakers) for the
project's sounds, plus an optional `getUserMedia` mic source, all merged into one `MediaStream` ->
`MediaRecorder`. On stop it shows a preview + Download. Caps at 3 minutes. Output is `.webm` (VP8/9 + Opus),
the only format `MediaRecorder` emits reliably; transcode to MP4 later if needed. Needs a secure context
(https / localhost), which the editor already is. It DOWNLOADS the file; saving a recording to R2 like the
`.sb3` is a later step. If the stage ever records blank frames on a given browser (a WebGL
`preserveDrawingBuffer` quirk), the fallback is copying the stage onto a 2D canvas per frame and capturing
that instead.

## 3. Connect the fork to Cloudflare Pages (it builds for you)

In the Cloudflare dashboard: Workers & Pages, Create, Pages, Connect to Git, pick your fork. Build command
`npm run build`, output directory `build`. Pages runs the build in its own environment, so you do not build
locally. Put `_headers` and `_redirects` (from this directory) in the fork's `static/` folder (or the build
output) so headers + SPA routing apply.

## 4. Custom domain

In the Pages project, Custom domains, add e.g. `scratch.kindleatechie.com`. Cloudflare wires the DNS
because the domain is already on Cloudflare. Do not set `X-Frame-Options` on the editor; KAT frames it, and
framing is gated by the KAT app's CSP `frame-src` allow-list (step 6).

## 5. Allow the editor origin to write to R2 (for direct saves)

The editor `PUT`s `.sb3` bytes to a presigned R2 URL. Add the editor's custom domain to the R2 bucket's
CORS allow-list for `PUT` (and `GET`, so it can load saved projects back). Exact origin, no wildcard.

## 6. Turn it on in the KAT app

Set `NEXT_PUBLIC_SCRATCH_EDITOR_URL=https://scratch.kindleatechie.com` and add that exact origin to the KAT
app's CSP `frame-src`/`child-src` in `next.config.ts`. Absent = Scratch stays off.

## 7. Round-trip smoke test

With the flag set, the KAT app can frame the editor at
`${NEXT_PUBLIC_SCRATCH_EDITOR_URL}/?parent=<KAT-origin>`, wait for a `READY` message, send `LOAD` (blank or
a starter `.sb3` URL), then `SAVE` with a presigned URL + key, and expect `SAVED{key}` back with the object
present in R2. The KAT-side block that does this ships in **Phase 3b**; the presigned-PUT route it calls is
also 3b.

## Maintenance

A fork tracking upstream scratch-gui. Re-pull, re-apply the two additions in step 2 (no embed patch to
maintain), rebuild (Pages does this on push), redeploy. `COOP`/`COEP` in `_headers` stay off unless you
later want a feature that needs SharedArrayBuffer.
