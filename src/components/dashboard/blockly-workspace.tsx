"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Blocks, Code2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDraft, putDraft } from "@/lib/lesson-block-draft";

// Same Monaco integration the code playground and assessment editor use (client-only, no SSR).
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-[26rem] w-full animate-pulse rounded-lg bg-stone-900" />,
});

/**
 * The reusable Blockly editor: injects a self-hosted Blockly workspace, generates PYTHON from the blocks,
 * and (unless allowCode is false) lets the pupil switch to an editable Monaco seeded with that Python.
 * It owns NO run button, output, or completion, it only reports the current effective code through
 * `onCodeChange` so the parent decides what to do with it (a lesson block RUNS it; an assessment SUBMITS
 * it). Shared by BlocklyBlock (lessons) and the assessment take editor, so the injection lives in one place.
 *
 * Pin media (block icons) to the installed version. CDN default, mirror to /public or R2 for full offline
 * later (Phase 4), the same pattern as the Pyodide index URL.
 */
const BLOCKLY_MEDIA_URL = "https://cdn.jsdelivr.net/npm/blockly@12.5.1/media/";

// A general-purpose category toolbox: enough to teach sequence, variables, loops, conditionals, maths,
// text and simple functions. Callers can override it via the `toolbox` prop.
const DEFAULT_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Logic",
      categorystyle: "logic_category",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
      ],
    },
    {
      kind: "category",
      name: "Loops",
      categorystyle: "loop_category",
      contents: [
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 10 } } } } },
        { kind: "block", type: "controls_whileUntil" },
        { kind: "block", type: "controls_for", inputs: { FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } }, TO: { shadow: { type: "math_number", fields: { NUM: 10 } } }, BY: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
      ],
    },
    {
      kind: "category",
      name: "Math",
      categorystyle: "math_category",
      contents: [
        { kind: "block", type: "math_number", fields: { NUM: 0 } },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "math_random_int", inputs: { FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } }, TO: { shadow: { type: "math_number", fields: { NUM: 100 } } } } },
      ],
    },
    {
      kind: "category",
      name: "Text",
      categorystyle: "text_category",
      contents: [
        { kind: "block", type: "text" },
        { kind: "block", type: "text_print", inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "" } } } } },
        { kind: "block", type: "text_join" },
      ],
    },
    { kind: "sep" },
    { kind: "category", name: "Variables", categorystyle: "variable_category", custom: "VARIABLE" },
    { kind: "category", name: "Functions", categorystyle: "procedure_category", custom: "PROCEDURE" },
  ],
};

export function BlocklyWorkspace({
  toolbox,
  startBlocks,
  allowCode = true,
  draftKey,
  onCodeChange,
}: {
  toolbox?: unknown;
  startBlocks?: unknown;
  /** When false, the "Switch to Python" handoff is hidden and it stays pure blocks. Default true. */
  allowCode?: boolean;
  /** When set, the workspace is debounce-saved to the shared LessonBlockDraft store under this key. */
  draftKey?: string;
  /** Fires with the current effective Python (generated in blocks mode, typed in code mode). */
  onCodeChange?: (code: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Blockly's own types are loaded dynamically, so the workspace + generator are held loosely typed.
  const workspaceRef = useRef<{ dispose: () => void; clear?: () => void } | null>(null);
  const generateRef = useRef<(() => string) | null>(null);
  const resizeRef = useRef<(() => void) | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hold the callback in a ref so the inject effect never re-runs just because the parent re-rendered.
  const onCodeChangeRef = useRef(onCodeChange);
  onCodeChangeRef.current = onCodeChange;

  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  // Dual mode: "blocks" (Blockly) or "code" (Monaco, seeded from the blocks). Text is session-only.
  const [mode, setMode] = useState<"blocks" | "code">("blocks");
  // `code` is always the CURRENT effective code, generated in blocks mode or typed in code mode.
  const [code, setCode] = useState("");
  const [codeDirty, setCodeDirty] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const emit = useCallback((next: string) => {
    setCode(next);
    onCodeChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let workspace: { dispose: () => void; addChangeListener: (cb: () => void) => void } | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void (async () => {
      let Blockly: typeof import("blockly");
      let pythonGenerator: (typeof import("blockly/python"))["pythonGenerator"];
      try {
        Blockly = await import("blockly");
        ({ pythonGenerator } = await import("blockly/python"));
      } catch (err) {
        console.error("Blockly import failed:", err);
        if (!cancelled) setLoadError(true);
        return;
      }
      if (cancelled || !hostRef.current) return;

      try {
        // The pupil's saved workspace wins (draft), then the author's starter blocks, else an empty canvas.
        const draft = draftKey ? await getDraft<Record<string, unknown>>(draftKey) : null;
        if (cancelled || !hostRef.current) return;

        const ws = Blockly.inject(hostRef.current, {
          toolbox: ((toolbox as object | undefined) ?? DEFAULT_TOOLBOX) as never,
          media: BLOCKLY_MEDIA_URL,
          trashcan: true,
          move: { scrollbars: true, drag: true, wheel: true },
          zoom: { controls: true, wheel: false, startScale: 1 },
        });
        workspace = ws;
        workspaceRef.current = ws;

        const initial = draft ?? (startBlocks as Record<string, unknown> | undefined);
        if (initial) {
          try {
            Blockly.serialization.workspaces.load(initial, ws);
          } catch {
            /* a bad saved state must not wipe the activity; start empty instead */
          }
        }

        const regenerate = () => {
          try {
            return pythonGenerator.workspaceToCode(ws);
          } catch {
            return "";
          }
        };
        generateRef.current = regenerate;
        emit(regenerate());

        ws.addChangeListener(() => {
          if (cancelled) return;
          // Block edits only change the generated code while the pupil is in blocks mode; in code mode
          // their typed text is the answer and must not be clobbered.
          if (mode !== "code") emit(regenerate());
          if (!draftKey) return;
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            try {
              void putDraft(draftKey, Blockly.serialization.workspaces.save(ws));
            } catch {
              /* ignore a transient serialize/save failure; the next edit retries */
            }
          }, 800);
        });

        resizeRef.current = () => Blockly.svgResize(ws);
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => Blockly.svgResize(ws));
          resizeObserver.observe(hostRef.current);
        }
        Blockly.svgResize(ws);

        if (!cancelled) setReady(true);
      } catch (err) {
        console.error("Blockly init failed:", err);
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (resizeObserver) resizeObserver.disconnect();
      if (workspace) workspace.dispose();
      workspaceRef.current = null;
      generateRef.current = null;
      resizeRef.current = null;
    };
    // Re-inject only if the block identity/config changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, toolbox, startBlocks]);

  const switchToCode = useCallback(() => {
    // `code` already holds the generated Python (kept current by the change listener); just reveal it.
    setCodeDirty(false);
    setMode("code");
  }, []);

  // Text cannot be reliably parsed back into blocks, so returning DISCARDS typed edits (behind a confirm)
  // and regenerates from the unchanged blocks, which stayed the source of truth the whole time.
  const backToBlocks = useCallback(() => {
    if (codeDirty && typeof window !== "undefined" && !window.confirm("Go back to blocks? Your typed changes will be lost.")) {
      return;
    }
    setMode("blocks");
    if (generateRef.current) emit(generateRef.current());
    requestAnimationFrame(() => resizeRef.current?.());
  }, [codeDirty, emit]);

  const reset = useCallback(async () => {
    const ws = workspaceRef.current;
    if (!ws?.clear) return;
    const Blockly = await import("blockly");
    ws.clear();
    if (startBlocks) {
      try {
        Blockly.serialization.workspaces.load(startBlocks as Record<string, unknown>, ws as never);
      } catch {
        /* ignore */
      }
    }
    if (generateRef.current) emit(generateRef.current());
  }, [startBlocks, emit]);

  if (loadError) {
    return (
      <p className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-900">
        The block editor could not load. Check your connection and refresh the page.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {allowCode ? (
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-sm dark:border-stone-800 dark:bg-stone-900">
          <button
            type="button"
            onClick={backToBlocks}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
              mode === "blocks"
                ? "bg-white text-orange-700 shadow-sm dark:bg-stone-800 dark:text-orange-400"
                : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            <Blocks className="size-3.5" /> Blocks
          </button>
          <button
            type="button"
            onClick={switchToCode}
            disabled={!ready}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
              mode === "code"
                ? "bg-white text-orange-700 shadow-sm dark:bg-stone-800 dark:text-orange-400"
                : "text-stone-500 hover:text-stone-700 disabled:opacity-50 dark:hover:text-stone-300"
            }`}
          >
            <Code2 className="size-3.5" /> Python
          </button>
        </div>
      ) : null}

      {/* Blockly injects its SVG here. It stays mounted (so the blocks survive a trip to Python) and is
          just hidden in code mode. A fixed height is required for the canvas to render. */}
      <div className={mode === "code" ? "hidden" : "overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800"}>
        <div ref={hostRef} className="h-[26rem] w-full" />
      </div>

      {mode === "code" ? (
        <div className="overflow-hidden rounded-xl border border-stone-800">
          <MonacoEditor
            height="26rem"
            language="python"
            theme="vs-dark"
            value={code}
            onChange={(v) => {
              setCodeDirty(true);
              emit(v ?? "");
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              autoClosingBrackets: "never",
              autoClosingQuotes: "never",
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {mode === "blocks" ? (
          <Button variant="outline" size="sm" onClick={() => void reset()} disabled={!ready} className="gap-1.5">
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        ) : null}
        {!allowCode ? (
          <Button variant="ghost" size="sm" onClick={() => setShowCode((s) => !s)} disabled={!ready} className="gap-1.5 text-stone-500">
            <Code2 className="size-3.5" /> {showCode ? "Hide Python" : "Show Python"}
          </Button>
        ) : null}
      </div>

      {!allowCode && showCode ? (
        <pre className="overflow-x-auto rounded-lg bg-stone-900 p-3 text-xs leading-relaxed text-stone-100 dark:bg-stone-950">
          <code>{code || "# Add some blocks to see the Python they make."}</code>
        </pre>
      ) : null}
    </div>
  );
}
