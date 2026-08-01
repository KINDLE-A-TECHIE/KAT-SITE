"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlocklyWorkspace } from "@/components/dashboard/blockly-workspace";
import { runPythonForOutput } from "@/lib/pyodide-grader";

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
 * Config rides LessonContent.body as optional JSON: { prompt?, toolbox?, startBlocks?, allowCode? }. Blank
 * body = the default toolbox, an empty canvas, and the Python switch on.
 */

type BlocklyConfig = {
  prompt?: string;
  toolbox?: unknown;
  startBlocks?: unknown;
  allowCode?: boolean;
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

  const codeRef = useRef("");
  const completedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [outputError, setOutputError] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setOutput(null);
    const result = await runPythonForOutput(codeRef.current);
    setRunning(false);
    setOutput(result.stdout + (result.stderr ? (result.stdout ? "\n" : "") + result.stderr : ""));
    setOutputError(result.errored);
    // Participation completion: they built/wrote and ran something. A runtime that could not load is not a run.
    const loadFailed = result.stderr.startsWith("The Python runtime could not load");
    if (!completedRef.current && !loadFailed) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [onComplete]);

  return (
    <div className="space-y-3">
      {config.prompt ? (
        <p className="text-sm text-stone-600 dark:text-stone-300">{config.prompt}</p>
      ) : null}

      <BlocklyWorkspace
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

      {output !== null ? (
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
