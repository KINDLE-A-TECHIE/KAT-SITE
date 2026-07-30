/**
 * The in-browser code auto-grader. It runs a pupil's Python against each hidden test case in the
 * platform's OWN default runtime (Pyodide, the same engine the code playground uses; Judge0 and the web
 * iframe come later) and scores the run with the pure primitives in practical-grading.ts.
 *
 * Deliberately a MINIMAL Python-only worker, not the code-playground's big turtle/pygame worker: an
 * auto-graded practical is a "read stdin, print stdout" problem, so it needs plain execution and none of
 * the visual shims. Visual work (turtle, pygame, Scratch, robotics) is RUBRIC-graded, never here.
 *
 * Browser-only (uses Worker/Blob). Each test case runs in a fresh namespace so state never leaks between
 * cases, and a runaway program is killed by terminating the worker on a per-test timeout.
 */

import { scoreCodeAnswer, type CodeTestCase, type CodeTestRun } from "@/lib/practical-grading";

/** A test case as the runner needs it: the pure scorer ignores `stdin`, but running the code needs it. */
export type GradableTestCase = CodeTestCase & { stdin?: string };

const PYODIDE_CDN_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const PYODIDE_INDEX_URL = process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL || PYODIDE_CDN_URL;
const LOAD_TIMEOUT_MS = 30_000;
// When a mirror is configured, give it a shorter window before falling back to the CDN: a blocked
// (CORS) fetch can hang rather than reject, so we must not wait the full timeout to recover.
const PRIMARY_TIMEOUT_MS = 15_000;
const RUN_TIMEOUT_MS = 10_000;
const STDOUT_CAP = 100_000;

function workerSource(indexURL: string): string {
  return `
const INDEX = ${JSON.stringify(indexURL)};
self.importScripts(INDEX + "pyodide.js");
let py = null;
const ready = (async () => { py = await self.loadPyodide({ indexURL: INDEX }); })();
ready.then(() => self.postMessage({ type: "ready" })).catch((e) => self.postMessage({ type: "loadFailed", message: String(e) }));

self.onmessage = async (e) => {
  const msg = e.data;
  try { await ready; } catch (_) { self.postMessage({ type: "result", id: msg.id, stdout: "", stderr: "load failed", errored: true }); return; }
  try {
    try { await py.loadPackagesFromImports(msg.code); } catch (_) {}
    // Point sys.stdin at a fresh StringIO holding this case's input, and capture stdout/stderr. Doing it
    // this way (not setStdin) keeps each run fully independent: input() reads from a clean buffer every
    // time, so reusing one Pyodide instance across test cases cannot leak stdin/EOF state between them.
    py.globals.set("__kat_stdin", msg.stdin || "");
    py.runPython("import sys, io; sys.stdin = io.StringIO(__kat_stdin); sys.stdout = io.StringIO(); sys.stderr = io.StringIO()");
    const ns = py.runPython("dict(__builtins__=__builtins__)");
    let errored = false;
    try { await py.runPythonAsync(msg.code, { globals: ns }); } catch (_) { errored = true; }
    ns.destroy();
    const stdout = String(py.runPython("sys.stdout.getvalue()") || "").slice(0, ${STDOUT_CAP});
    const stderr = String(py.runPython("sys.stderr.getvalue()") || "");
    self.postMessage({ type: "result", id: msg.id, stdout, stderr, errored });
  } catch (ex) {
    self.postMessage({ type: "result", id: msg.id, stdout: "", stderr: String(ex), errored: true });
  }
};
`;
}

function makeWorker(indexURL: string, timeoutMs: number = LOAD_TIMEOUT_MS): Promise<Worker> {
  const blob = new Blob([workerSource(indexURL)], { type: "application/javascript" });
  const worker = new Worker(URL.createObjectURL(blob));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("Pyodide failed to load in time."));
    }, timeoutMs);
    worker.onmessage = (e) => {
      if (e.data?.type === "ready") {
        clearTimeout(timer);
        resolve(worker);
      } else if (e.data?.type === "loadFailed") {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(e.data.message || "Pyodide load failed."));
      }
    };
    // A worker-level error (e.g. importScripts blocked, syntax error) never arrives as a message.
    worker.onerror = (err) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(err.message || "Pyodide worker error."));
    };
  });
}

/**
 * Open a Pyodide worker from the configured source, falling back to the public CDN if it fails to load.
 * loadPyodide cannot cleanly recover inside one worker after a failed internal fetch, so the fallback is
 * a FRESH worker forced to the CDN. On the school host the R2 mirror fails CORS; the CDN allows any
 * origin, so this keeps in-browser grading working everywhere instead of silently scoring code 0.
 */
async function openWorker(): Promise<Worker> {
  // No mirror configured: the CDN is the only source, so use the full load window.
  if (PYODIDE_INDEX_URL === PYODIDE_CDN_URL) return makeWorker(PYODIDE_CDN_URL);
  try {
    return await makeWorker(PYODIDE_INDEX_URL, PRIMARY_TIMEOUT_MS);
  } catch {
    return makeWorker(PYODIDE_CDN_URL);
  }
}

type RunOutcome = { stdout: string; errored: boolean } | "timeout";

function runOnce(worker: Worker, code: string, stdin: string): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      worker.removeEventListener("message", onMessage);
      resolve("timeout");
    }, RUN_TIMEOUT_MS);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "result" && e.data.id === id) {
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        resolve({ stdout: e.data.stdout || "", errored: Boolean(e.data.errored) });
      }
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, code, stdin });
  });
}

export type CodeGradeResult = Awaited<ReturnType<typeof scoreCodeAnswer>> & { runs: CodeTestRun[] };

export type CodeRun = { id?: string; stdout: string; errored: boolean };

/**
 * Run `code` once per input and return what it printed for each, WITHOUT judging it. This is what the
 * pupil take flow uses: the client runs the code and reports the outputs, and the SERVER compares them
 * to the hidden expected outputs (which never reach the browser). A runaway program is killed by
 * terminating the worker (a fresh one starts for the rest); a load failure marks every input errored.
 */
export async function runCode(
  code: string,
  inputs: { id?: string; stdin?: string }[],
): Promise<CodeRun[]> {
  if (inputs.length === 0) return [];

  let worker: Worker;
  try {
    worker = await openWorker();
  } catch {
    return inputs.map((c) => ({ id: c.id, stdout: "", errored: true }));
  }

  const out: CodeRun[] = [];
  try {
    for (let i = 0; i < inputs.length; i++) {
      const outcome = await runOnce(worker, code, inputs[i].stdin ?? "");
      if (outcome === "timeout") {
        worker.terminate();
        out.push({ id: inputs[i].id, stdout: "", errored: true });
        if (i < inputs.length - 1) worker = await openWorker();
      } else {
        out.push({ id: inputs[i].id, stdout: outcome.stdout, errored: outcome.errored });
      }
    }
  } finally {
    worker.terminate(); // idempotent, safe even if already terminated on the last case
  }
  return out;
}

/**
 * Run `code` against every test case AND score it client-side (for a teacher re-run / preview). The
 * pupil submission path deliberately does NOT use this: it runs with `runCode` and lets the server
 * score, so hidden expected outputs stay server-side.
 */
export async function gradeCode(
  code: string,
  testCases: GradableTestCase[],
  opts: { caseSensitive?: boolean } = {},
): Promise<CodeGradeResult> {
  const raw = await runCode(code, testCases.map((tc) => ({ id: tc.id, stdin: tc.stdin })));
  const runs: CodeTestRun[] = testCases.map((testCase, i) => ({
    testCase,
    actualStdout: raw[i]?.stdout ?? "",
    errored: raw[i]?.errored ?? true,
  }));
  return { ...scoreCodeAnswer(runs, opts), runs };
}
