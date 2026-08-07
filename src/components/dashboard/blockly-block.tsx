"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BlocklyWorkspace } from "@/components/dashboard/blockly-workspace";
import { GridWorldView } from "@/components/dashboard/grid-world-view";
import { TurtleWorldView } from "@/components/dashboard/turtle-world-view";
import { runPythonForOutput, runCode } from "@/lib/pyodide-grader";
import { wrapForWorldTrace, isWorldId, DEFAULT_GRID_STDIN, type WorldId } from "@/lib/blockly-worlds";

/**
 * BLOCKLY lesson block: the shared BlocklyWorkspace (self-hosted Blockly that generates Python, with an
 * optional switch to a Monaco Python editor) plus a Run button and output. It is the block-coding on-ramp
 * for the CODING strand at the younger levels, before text Python.
 *
 * Mounted by the lesson viewer from the BLOCKLY content type, the same way CODE_PLAYGROUND mounts
 * CodePlaygroundBlock. On the first Run (in either mode) it calls the lesson's `onComplete` (participation
 * completion, like the other interactive blocks). The workspace is debounce-saved to the shared
 * LessonBlockDraft store (keyed by contentId); typed Python is session-only (blocks are what persist).
 *
 * Config rides LessonContent.body as optional JSON: { prompt?, toolbox?, startBlocks?, allowCode?, world?,
 * grid? }. Blank body = the default toolbox, an empty canvas, and the Python switch on. A `world`
 * ("turtle" | "grid") turns this into a VISUAL practice block: the blocks drive the world runtime and Run
 * ANIMATES the result (turtle draws; a grid robot moves through the maze) instead of printing text. Lessons
 * are practice, so a world block is never graded; grid reads its maze from `grid` (a maze config; a default
 * maze is used if omitted).
 */

type BlocklyConfig = {
  prompt?: string;
  toolbox?: unknown;
  startBlocks?: unknown;
  allowCode?: boolean;
  world?: string;
  /** For a grid world: the maze the runtime reads, as a JSON string OR a GridConfig object. Default if absent. */
  grid?: unknown;
};

function parseConfig(body: string | null): BlocklyConfig {
  if (!body || !body.trim()) return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" ? (parsed as BlocklyConfig) : {};
  } catch {
    // A malformed config must never break the activity, fall back to defaults.
    return {};
  }
}

export function BlocklyBlock({
  contentId,
  body,
  onComplete,
}: {
  contentId: string;
  body: string | null;
  onComplete?: () => void;
}) {
  const config = parseConfig(body);
  const world: WorldId | undefined = isWorldId(config.world) ? config.world : undefined;
  // The grid runtime reads its maze from stdin. Use the authored maze, or a default so `{"world":"grid"}`
  // alone still works.
  const gridStdin =
    world === "grid"
      ? typeof config.grid === "string" && config.grid.trim()
        ? config.grid // the maze as a JSON string (from the authoring picker)
        : config.grid && typeof config.grid === "object"
          ? JSON.stringify(config.grid) // a hand-authored GridConfig object
          : DEFAULT_GRID_STDIN
      : "";

  const codeRef = useRef("");
  const completedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null); // non-world: text output
  const [outputError, setOutputError] = useState(false);
  const [replay, setReplay] = useState<{ trace: string; runId: number } | null>(null); // world: animated trace

  const complete = useCallback(() => {
    if (!completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [onComplete]);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      // ── World: run the trace wrapper and animate it. Never graded (a lesson is practice). ──
      if (world) {
        const runs = await runCode(wrapForWorldTrace(world, codeRef.current), [{ id: "0", stdin: gridStdin }]);
        const trace = runs[0]?.stdout?.trim() ?? "";
        if (trace.length > 0) {
          setReplay((p) => ({ trace, runId: (p?.runId ?? 0) + 1 }));
          complete(); // they built and ran something
        } else {
          toast.error("Could not run your blocks. Add some blocks and try again.");
        }
        return;
      }

      // ── Program output: run and show stdout/stderr. ──
      setOutput(null);
      const result = await runPythonForOutput(codeRef.current);
      setOutput(result.stdout + (result.stderr ? (result.stdout ? "\n" : "") + result.stderr : ""));
      setOutputError(result.errored);
      // A runtime that could not load is not a run.
      if (!result.stderr.startsWith("The Python runtime could not load")) complete();
    } catch {
      toast.error("Could not run. Please try again.");
    } finally {
      setRunning(false); // never leave the button stuck, even if a run rejects
    }
  }, [world, gridStdin, complete]);

  return (
    <div className="space-y-3">
      {config.prompt ? (
        <p className="text-sm text-stone-600 dark:text-stone-300">{config.prompt}</p>
      ) : null}

      {/* Grid: show the maze (and animate the robot along it after a Run) above the blocks. */}
      {world === "grid" ? (
        <div className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
          <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">Your maze</p>
          <GridWorldView config={gridStdin} trace={replay?.trace} runId={replay?.runId} />
        </div>
      ) : null}

      <BlocklyWorkspace
        world={world}
        toolbox={config.toolbox}
        startBlocks={config.startBlocks}
        allowCode={config.allowCode !== false}
        draftKey={contentId}
        onCodeChange={(c) => {
          codeRef.current = c;
        }}
      />

      <div>
        <Button onClick={() => void run()} disabled={running} className="gap-1.5">
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Run
        </Button>
      </div>

      {/* Turtle: the drawing animates below the blocks after a Run. */}
      {world === "turtle" ? (
        <TurtleWorldView trace={replay?.trace} runId={replay?.runId} />
      ) : null}

      {/* Program-output blocks show text; world blocks show the animation above/below instead. */}
      {!world && output !== null ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">Output</p>
          <pre
            className={`overflow-x-auto rounded-lg p-3 text-sm leading-relaxed ${
              outputError
                ? "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                : "bg-stone-100 text-stone-800 dark:bg-stone-800/60 dark:text-stone-200"
            }`}
          >
            <code>{output || "(no output)"}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}
