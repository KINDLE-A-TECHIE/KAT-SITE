"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Loader2, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlocklyWorkspace } from "@/components/dashboard/blockly-workspace";
import { GridWorldView } from "@/components/dashboard/grid-world-view";
import { TurtleWorldView } from "@/components/dashboard/turtle-world-view";
import { ScratchAnswer } from "@/components/school/scratch-answer";
import { runCode } from "@/lib/pyodide-grader";
import { matchOutput } from "@/lib/practical-grading";
import { wrapForWorld, wrapForWorldTrace, isWorldId, type WorldId } from "@/lib/blockly-worlds";

// The same Monaco editor the lessons use, so a coding exam feels like the lessons. Client-only.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-stone-900" />,
});

type Option = { id: string; label: string; value: string };
type TestCase = { id: string; stdin: string; hidden: boolean; expectedStdout: string | null };
type Criterion = { label: string; description: string | null; maxPoints: number };
type Question = {
  id: string;
  prompt: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN_ENDED" | "CODE" | "RUBRIC" | "SCRATCH";
  points: number;
  options?: Option[];
  codeLanguage?: string;
  starterCode?: string;
  /** When set, this CODE question is answered with Blockly (blocks that generate the graded Python). */
  blocklyConfig?: string | null;
  testCases?: TestCase[];
  rubric?: Criterion[];
  /** SCRATCH questions: the checklist the pupil's project is graded against (labels + points, shown). */
  scratchChecks?: { label: string; points: number }[];
};

/** A Blockly question's config JSON (toolbox/startBlocks/allowCode/world/strict); a bad value falls back to defaults. */
function parseBlockly(raw: string | null | undefined): { toolbox?: unknown; startBlocks?: unknown; allowCode?: boolean; world?: string; strict?: boolean } {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** The block world for a question, if it is a world-graded Blockly question (else undefined). */
function questionWorld(q: Question): WorldId | undefined {
  const w = parseBlockly(q.blocklyConfig).world;
  return isWorldId(w) ? w : undefined;
}

/**
 * The program to actually run for a CODE answer: wrapped in the world runtime when it is a world question.
 * `strict` (from the config) grades on the exact stroke/step order, matching how the reference was captured.
 */
function runnableCode(q: Question, code: string): string {
  const world = questionWorld(q);
  if (!world) return code;
  return wrapForWorld(world, code, { strict: parseBlockly(q.blocklyConfig).strict === true });
}
type Answer = { selectedOptionId?: string; responseText?: string; code?: string; sb3Key?: string };
type Result = { status: string; autoScore: number; totalScore: number };

/**
 * A school pupil sits one test/exam. Renders each question by type and submits. For a CODE question the
 * pupil's code is run in-browser against the test inputs (via runCode) and only the OUTPUTS are sent; the
 * server compares them to the hidden expected outputs, so no answer key is ever in the page.
 */
export function AssessmentTake({
  assessmentId,
  apiPath = "/api/school/learn/assessments",
  backHref = "/learn/assessments",
  embed = false,
}: {
  assessmentId: string;
  apiPath?: string;
  backHref?: string;
  // In the embed, a SCRATCH answer saves via the embed-authed scratch routes (passed down to ScratchAnswer).
  embed?: boolean;
}) {
  const [phase, setPhase] = useState<"loading" | "error" | "taking" | "submitting" | "done">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [sampleResult, setSampleResult] = useState<Record<string, string>>({});
  // Replay traces for world questions: one trace per test case (grid can have several mazes) + a run
  // counter so pressing Run replays each time.
  const [replay, setReplay] = useState<Record<string, { traces: string[]; runId: number }>>({});
  const [replayRunning, setReplayRunning] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`${apiPath}?assessmentId=${assessmentId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.error ?? "This assessment is not available.");
        setPhase("error");
        return;
      }
      setTitle(data.title);
      setQuestions(data.questions ?? []);
      const init: Record<string, Answer> = {};
      for (const q of data.questions ?? []) if (q.type === "CODE") init[q.id] = { code: q.starterCode ?? "" };
      setAnswers(init);
      setPhase("taking");
    })();
  }, [assessmentId, apiPath]);

  const setAnswer = (qid: string, patch: Answer) =>
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));

  // Let the pupil check their code against the VISIBLE sample cases before submitting (feedback only).
  const checkSamples = async (q: Question) => {
    const samples = (q.testCases ?? []).filter((t) => !t.hidden && t.expectedStdout != null);
    if (samples.length === 0) return;
    setSampleResult((p) => ({ ...p, [q.id]: "running" }));
    const runs = await runCode(runnableCode(q, answers[q.id]?.code ?? ""), samples.map((t) => ({ id: t.id, stdin: t.stdin })));
    const byId = new Map(runs.map((r) => [r.id, r]));
    const passed = samples.filter((t) => {
      const r = byId.get(t.id);
      return r && !r.errored && matchOutput(r.stdout, t.expectedStdout ?? "");
    }).length;
    setSampleResult((p) => ({ ...p, [q.id]: `${passed}/${samples.length} sample tests passed` }));
  };

  // Run a world question's blocks for a REPLAY (not grading): the trace wrapper prints a step trace the
  // world view animates. Grid reads its maze from stdin, so pass it; turtle has no stdin.
  const runReplay = async (q: Question) => {
    const world = questionWorld(q);
    if (!world) return;
    setReplayRunning((p) => ({ ...p, [q.id]: true }));
    try {
      // The one program runs against every maze (grid) or once (turtle, no stdin); one trace per case.
      const cases = q.testCases ?? [];
      const inputs =
        world === "grid" && cases.length > 0 ? cases.map((t, i) => ({ id: String(i), stdin: t.stdin })) : [{ id: "0", stdin: "" }];
      const runs = await runCode(wrapForWorldTrace(world, answers[q.id]?.code ?? ""), inputs);
      const traces = inputs.map((_, i) => runs.find((r) => r.id === String(i))?.stdout?.trim() ?? "");
      if (traces.some((t) => t.length > 0)) {
        setReplay((p) => ({ ...p, [q.id]: { traces, runId: (p[q.id]?.runId ?? 0) + 1 } }));
      } else {
        toast.error("Could not run your blocks. Add some blocks and try again.");
      }
    } finally {
      setReplayRunning((p) => ({ ...p, [q.id]: false }));
    }
  };

  const submit = async () => {
    setPhase("submitting");
    try {
      const payload = [];
      for (const q of questions) {
        const a = answers[q.id] ?? {};
        if (q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") {
          payload.push({ questionId: q.id, selectedOptionId: a.selectedOptionId ?? null });
        } else if (q.type === "CODE") {
          const code = a.code ?? "";
          // World questions run wrapped (the runtime prints the graded state); the pupil's raw code is
          // still what we store as responseText for a teacher re-run.
          const runs = await runCode(runnableCode(q, code), (q.testCases ?? []).map((t) => ({ id: t.id, stdin: t.stdin })));
          payload.push({
            questionId: q.id,
            responseText: code,
            codeRuns: runs.map((r) => ({ testCaseId: r.id ?? "", stdout: r.stdout, errored: r.errored })),
          });
        } else if (q.type === "SCRATCH") {
          // The answer is the R2 key of the pupil's saved .sb3; the server fetches and grades it.
          payload.push({ questionId: q.id, responseText: a.sb3Key ?? "" });
        } else {
          payload.push({ questionId: q.id, responseText: a.responseText ?? "" });
        }
      }
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, answers: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Could not submit your work.");
        setPhase("taking");
        return;
      }
      setResult(data);
      setPhase("done");
    } catch {
      toast.error("Something went wrong submitting your work.");
      setPhase("taking");
    }
  };

  if (phase === "loading") return <Skeleton className="h-72 w-full rounded-lg" />;

  if (phase === "error") {
    return (
      <div className="rounded-lg border border-dashed border-stone-200 py-16 text-center dark:border-stone-800">
        <ClipboardCheck className="mx-auto mb-3 size-10 text-stone-300 dark:text-stone-600" />
        <p className="font-medium text-stone-600 dark:text-stone-300">{errorMsg}</p>
        <Link href={backHref} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-kat-clay hover:underline">
          <ArrowLeft className="size-3.5" /> Back to tests
        </Link>
      </div>
    );
  }

  if (phase === "done") {
    const graded = result?.status === "GRADED";
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-[var(--kat-pine)] px-6 py-12 text-center text-white">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-white/15">
          <CheckCircle2 className="size-7 text-[var(--kat-sun)]" />
        </div>
        <p className="mt-4 font-display text-2xl font-bold">Submitted!</p>
        <p className="mt-2 text-sm text-white/80">
          {graded
            ? `You scored ${result?.autoScore} on the auto-marked questions.`
            : "Your teacher will mark the written and practical parts, then your result is ready."}
        </p>
        <Link href={backHref} className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[var(--kat-pine)] transition hover:bg-white/90">
          Back to tests
        </Link>
      </div>
    );
  }

  const submitting = phase === "submitting";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition hover:text-kat-clay dark:text-stone-400">
          <ArrowLeft className="size-3.5" /> Tests
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-stone-900 dark:text-stone-100">{title}</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Answer every question, then submit. You can only submit once.
        </p>
      </div>

      {questions.map((q, i) => (
        <div key={q.id} className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium text-stone-900 dark:text-stone-100">
              <span className="mr-1.5 font-bold">{i + 1}.</span>
              {q.prompt}
            </p>
            <span className="shrink-0 text-xs text-stone-400">{q.points} marks</span>
          </div>

          <div className="mt-3">
            {(q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") && (
              <div className="space-y-2">
                {(q.options ?? []).map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2 text-sm transition hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/40">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id]?.selectedOptionId === o.id}
                      onChange={() => setAnswer(q.id, { selectedOptionId: o.id })}
                      className="accent-orange-600"
                    />
                    <span className="text-stone-800 dark:text-stone-200">{o.label}</span>
                  </label>
                ))}
              </div>
            )}

            {q.type === "OPEN_ENDED" && (
              <textarea
                value={answers[q.id]?.responseText ?? ""}
                onChange={(e) => setAnswer(q.id, { responseText: e.target.value })}
                rows={5}
                placeholder="Write your answer here…"
                className="w-full rounded-lg border border-stone-200 bg-white p-3 text-sm dark:border-stone-800 dark:bg-stone-950"
              />
            )}

            {q.type === "CODE" && (
              <div className="space-y-2">
                {(q.testCases ?? []).some((t) => !t.hidden && t.expectedStdout != null) && (
                  <div className="rounded-lg bg-stone-50 p-2.5 text-xs text-stone-600 dark:bg-stone-800/40 dark:text-stone-300">
                    <p className="mb-1 font-semibold">Example:</p>
                    {(q.testCases ?? []).filter((t) => !t.hidden && t.expectedStdout != null).map((t) => (
                      <p key={t.id} className="font-mono">
                        input <span className="text-stone-500">{JSON.stringify(t.stdin)}</span> → output{" "}
                        <span className="text-stone-500">{JSON.stringify(t.expectedStdout)}</span>
                      </p>
                    ))}
                  </div>
                )}
                {questionWorld(q) === "grid" && (
                  // Show the maze(s) the blocks must solve (drawn from each test case's grid config). The
                  // layout is the puzzle, not the answer, so it is fine for the pupil to see it. One program
                  // must solve every maze; after a Run, each view animates the robot along its own trace.
                  <div className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
                    <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                      {(q.testCases?.length ?? 0) > 1 ? "Your mazes (one program must solve them all)" : "Your maze"}
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {(q.testCases ?? []).map((tc, i) => (
                        <div key={tc.id} className="min-w-[8rem]">
                          {(q.testCases?.length ?? 0) > 1 ? (
                            <p className="mb-1 text-[11px] font-medium text-stone-400">Maze {i + 1}</p>
                          ) : null}
                          <GridWorldView config={tc.stdin} trace={replay[q.id]?.traces?.[i]} runId={replay[q.id]?.runId} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {q.blocklyConfig != null ? (
                  // Block-answered: the workspace keeps the answer's `code` in sync with the generated
                  // Python, so check-samples, submit and server grading run exactly as for a typed answer.
                  // A `world` question grades the drawing/state the blocks produce, not a printout.
                  <BlocklyWorkspace
                    world={questionWorld(q)}
                    toolbox={parseBlockly(q.blocklyConfig).toolbox}
                    startBlocks={parseBlockly(q.blocklyConfig).startBlocks}
                    allowCode={parseBlockly(q.blocklyConfig).allowCode !== false}
                    onCodeChange={(c) => setAnswer(q.id, { code: c })}
                  />
                ) : (
                  <div className="overflow-hidden rounded-lg border border-stone-800">
                    <MonacoEditor
                      height="18rem"
                      language={q.codeLanguage || "python"}
                      theme="vs-dark"
                      value={answers[q.id]?.code ?? ""}
                      onChange={(v) => setAnswer(q.id, { code: v ?? "" })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        // Beginner-friendly and paste-safe: no surprise auto-inserted brackets/quotes.
                        autoClosingBrackets: "never",
                        autoClosingQuotes: "never",
                      }}
                    />
                  </div>
                )}
                {questionWorld(q) ? (
                  // World questions grade the picture/state the blocks make; there are no printed examples.
                  // Run to watch it (turtle draws below; the maze animates above), then submit.
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void runReplay(q)}
                        disabled={submitting || replayRunning[q.id]}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-60 dark:border-stone-800 dark:text-stone-300"
                      >
                        {replayRunning[q.id] ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                        Run
                      </button>
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        Run to watch your blocks, then submit. Your work is marked automatically.
                      </span>
                    </div>
                    {questionWorld(q) === "turtle" ? (
                      <TurtleWorldView trace={replay[q.id]?.traces?.[0]} runId={replay[q.id]?.runId} />
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void checkSamples(q)}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-60 dark:border-stone-800 dark:text-stone-300"
                    >
                      {sampleResult[q.id] === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                      Check against examples
                    </button>
                    {sampleResult[q.id] && sampleResult[q.id] !== "running" ? (
                      <span className="text-xs text-stone-500 dark:text-stone-400">{sampleResult[q.id]}</span>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {q.type === "RUBRIC" && (
              <div className="space-y-2">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Your teacher marks this practical while you build or present it. What they look for:
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-stone-700 dark:text-stone-300">
                  {(q.rubric ?? []).map((c, k) => (
                    <li key={k}>
                      {c.label} <span className="text-stone-400">({c.maxPoints} marks)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {q.type === "SCRATCH" && (
              <div className="space-y-2">
                {(q.scratchChecks ?? []).length > 0 && (
                  <div className="rounded-lg bg-stone-50 p-2.5 text-xs dark:bg-stone-800/40">
                    <p className="mb-1 font-semibold text-stone-600 dark:text-stone-300">What gets checked:</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-stone-600 dark:text-stone-300">
                      {(q.scratchChecks ?? []).map((c, k) => (
                        <li key={k}>
                          {c.label} <span className="text-stone-400">({c.points} marks)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <ScratchAnswer
                  questionId={q.id}
                  savedKey={answers[q.id]?.sb3Key ?? null}
                  onSavedKey={(key) => setAnswer(q.id, { sb3Key: key })}
                  embed={embed}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-lg bg-kat-clay px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-kat-clay-deep disabled:opacity-70"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        {submitting ? "Marking your work…" : "Submit"}
      </button>
    </div>
  );
}
