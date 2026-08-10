import { captureError } from "@/lib/sentry";

/**
 * Judge0 CE execution engine, shared by the in-app run route and the school embed run route so both send
 * identical submissions and map results the same way. Each caller does its OWN auth + content + rate-limit
 * checks first; this module only runs already-authorized code and never reads a session.
 */

// Judge0 CE language IDs, matched to the languages returned by GET /languages on this instance.
export const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  python: 71, javascript: 63, typescript: 74, java: 62, c: 50, cpp: 54, csharp: 51, go: 60, rust: 73,
  kotlin: 78, swift: 83, php: 68, ruby: 72, scala: 81, r: 80, bash: 46, sql: 82, lua: 64, perl: 85,
  haskell: 61, clojure: 86, elixir: 57, erlang: 58, fsharp: 87, commonlisp: 55, ocaml: 65, groovy: 88,
  d: 56, objectivec: 79, assembly: 45, python2: 70, fortran: 59, pascal: 67, cobol: 77, basic: 47,
  vbnet: 84, prolog: 69, octave: 66,
};

export type Judge0Result = {
  stdout: string;
  stderr: string;
  compileOutput: string;
  exitCode: number;
  status: string;
  time: string | null;
  memory: number | null;
};

export type Judge0Outcome =
  | { ok: true; result: Judge0Result }
  | { ok: false; status: number; error: string };

const JUDGE0_API_URL = process.env.JUDGE0_API_URL?.replace(/\/$/, "") ?? null;
// Optional; self-hosted Judge0 CE instances typically have no auth by default.
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY?.trim() ?? null;

type RawResult = {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  exit_code: number | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
};

/** Run `code` in `language` on Judge0. Returns a typed outcome; callers translate it to their HTTP shape. */
export async function runOnJudge0(input: {
  language: string;
  code: string;
  stdin?: string;
  additionalFiles?: string;
}): Promise<Judge0Outcome> {
  const languageId = JUDGE0_LANGUAGE_MAP[input.language];
  if (!languageId) return { ok: false, status: 400, error: `Unsupported language: ${input.language}` };
  if (!JUDGE0_API_URL) return { ok: false, status: 503, error: "Code execution service is not configured." };

  const authHeaders: Record<string, string> = JUDGE0_API_KEY ? { "X-Auth-Token": JUDGE0_API_KEY } : {};
  const submissionBody = JSON.stringify({
    source_code: input.code,
    language_id: languageId,
    stdin: input.stdin ?? "",
    ...(input.additionalFiles ? { additional_files: input.additionalFiles } : {}),
  });

  try {
    let result: RawResult | null = null;

    // Synchronous execution first (requires ENABLE_WAIT_RESULT=true on self-hosted).
    const waitRes = await fetch(`${JUDGE0_API_URL}/submissions?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: submissionBody,
      signal: AbortSignal.timeout(15_000),
    });

    if (waitRes.ok) {
      result = (await waitRes.json()) as RawResult;
    } else if (waitRes.status === 400) {
      // wait=true not enabled: fall back to async create + poll.
      const createRes = await fetch(`${JUDGE0_API_URL}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: submissionBody,
        signal: AbortSignal.timeout(10_000),
      });
      if (!createRes.ok) {
        let d = "";
        try { d = await createRes.text(); } catch { /* ignore */ }
        captureError(new Error(`Judge0 create failed (${createRes.status})`), { where: "judge0.create", status: createRes.status, detail: d.slice(0, 500), language: input.language });
        return { ok: false, status: 502, error: `Code execution service error (${createRes.status}).` };
      }
      const { token } = (await createRes.json()) as { token: string };
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const pollRes = await fetch(
          `${JUDGE0_API_URL}/submissions/${token}?fields=stdout,stderr,compile_output,exit_code,status,time,memory`,
          { headers: authHeaders, signal: AbortSignal.timeout(5_000) },
        );
        if (!pollRes.ok) continue;
        const polled = (await pollRes.json()) as RawResult;
        if (polled.status.id !== 1 && polled.status.id !== 2) { result = polled; break; }
      }
      if (!result) return { ok: false, status: 504, error: "Execution timed out." };
    } else {
      let detail = "";
      try { detail = await waitRes.text(); } catch { /* ignore */ }
      captureError(new Error(`Judge0 error (${waitRes.status})`), { where: "judge0.submit", status: waitRes.status, detail: detail.slice(0, 500), language: input.language });
      return { ok: false, status: 502, error: `Code execution service error (${waitRes.status}).` };
    }

    // Status IDs: 3 = Accepted; 6 = Compile Error; 5 = TLE; 7-12 = Runtime errors.
    const exitCode = result.status.id === 3 ? 0 : 1;
    return {
      ok: true,
      result: {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        compileOutput: result.compile_output ?? "",
        exitCode,
        status: result.status.description,
        time: result.time,
        memory: result.memory,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") return { ok: false, status: 504, error: "Execution timed out." };
    captureError(err, { where: "judge0.fetch", language: input.language });
    return { ok: false, status: 502, error: "Failed to reach code execution service." };
  }
}
