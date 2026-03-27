"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Play, RotateCcw, Terminal, Users, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Monaco is large — load only on client, never on server
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
});

export const SUPPORTED_LANGUAGES = [
  // ── Popular ──────────────────────────────────────────────────────────────
  { value: "python",      label: "Python 3",       monacoLang: "python" },
  { value: "javascript",  label: "JavaScript",     monacoLang: "javascript" },
  { value: "typescript",  label: "TypeScript",     monacoLang: "typescript" },
  { value: "java",        label: "Java",           monacoLang: "java" },
  { value: "c",           label: "C",              monacoLang: "c" },
  { value: "cpp",         label: "C++",            monacoLang: "cpp" },
  { value: "csharp",      label: "C#",             monacoLang: "csharp" },
  { value: "go",          label: "Go",             monacoLang: "go" },
  { value: "rust",        label: "Rust",           monacoLang: "rust" },
  { value: "kotlin",      label: "Kotlin",         monacoLang: "kotlin" },
  { value: "swift",       label: "Swift",          monacoLang: "swift" },
  { value: "php",         label: "PHP",            monacoLang: "php" },
  { value: "ruby",        label: "Ruby",           monacoLang: "ruby" },
  { value: "scala",       label: "Scala",          monacoLang: "scala" },
  { value: "r",           label: "R",              monacoLang: "r" },
  { value: "bash",        label: "Bash",           monacoLang: "shell" },
  { value: "sql",         label: "SQL",            monacoLang: "sql" },
  { value: "lua",         label: "Lua",            monacoLang: "lua" },
  { value: "perl",        label: "Perl",           monacoLang: "perl" },
  // ── Functional ───────────────────────────────────────────────────────────
  { value: "haskell",     label: "Haskell",        monacoLang: "plaintext" },
  { value: "clojure",     label: "Clojure",        monacoLang: "clojure" },
  { value: "elixir",      label: "Elixir",         monacoLang: "elixir" },
  { value: "erlang",      label: "Erlang",         monacoLang: "plaintext" },
  { value: "fsharp",      label: "F#",             monacoLang: "fsharp" },
  { value: "commonlisp",  label: "Common Lisp",    monacoLang: "scheme" },
  { value: "ocaml",       label: "OCaml",          monacoLang: "plaintext" },
  // ── JVM extras ───────────────────────────────────────────────────────────
  { value: "groovy",      label: "Groovy",         monacoLang: "java" },
  // ── Systems / low-level ───────────────────────────────────────────────────
  { value: "d",           label: "D",              monacoLang: "plaintext" },
  { value: "objectivec",  label: "Objective-C",    monacoLang: "objective-c" },
  { value: "assembly",    label: "Assembly (NASM)", monacoLang: "plaintext" },
  // ── Scripting / legacy ────────────────────────────────────────────────────
  { value: "python2",     label: "Python 2",       monacoLang: "python" },
  { value: "fortran",     label: "Fortran",        monacoLang: "plaintext" },
  { value: "pascal",      label: "Pascal",         monacoLang: "pascal" },
  { value: "cobol",       label: "COBOL",          monacoLang: "plaintext" },
  { value: "basic",       label: "Basic",          monacoLang: "vb" },
  { value: "vbnet",       label: "VB.Net",         monacoLang: "vb" },
  { value: "prolog",      label: "Prolog",         monacoLang: "plaintext" },
  { value: "octave",      label: "Octave",         monacoLang: "matlab" },
] as const;

type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  compileOutput: string | null;
  time: string | null;
  memory: number | null;
};

type PeerParticipant = {
  userId: string;
  user: { id: string; firstName: string; lastName: string };
};

type PeerSessionData = {
  id: string;
  currentCode: string;
  hostId: string;
  status: string;
  participants: PeerParticipant[];
};

export function CodePlaygroundBlock({
  contentId,
  starterCode,
  language,
  isCreator = false,
  userId,
}: {
  contentId: string;
  starterCode: string;
  language: string;
  isCreator?: boolean;
  userId?: string;
}) {
  const [code, setCode] = useState(starterCode);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStdin, setShowStdin] = useState(false);
  const [stdin, setStdin] = useState("");

  // Peer session state
  const [peerSessionId, setPeerSessionId] = useState<string | null>(null);
  const [inPeerSession, setInPeerSession] = useState(false);
  const [peerParticipants, setPeerParticipants] = useState<PeerParticipant[]>([]);
  const [startingPeer, setStartingPeer] = useState(false);
  const [joiningPeer, setJoiningPeer] = useState(false);
  const [availableSessionId, setAvailableSessionId] = useState<string | null>(null);

  const editorRef = useRef<unknown>(null);
  const runRef = useRef<() => void>(() => {});
  const lastLocalEdit = useRef(0);
  const pushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track whether we're programmatically setting code from server to avoid push loops
  const settingFromServer = useRef(false);
  const peerSessionIdRef = useRef<string | null>(null);
  const inPeerSessionRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { peerSessionIdRef.current = peerSessionId; }, [peerSessionId]);
  useEffect(() => { inPeerSessionRef.current = inPeerSession; }, [inPeerSession]);

  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.value === language);
  const monacoLang = langConfig?.monacoLang ?? "plaintext";
  const langLabel = langConfig?.label ?? language;

  // ── Code execution ──────────────────────────────────────────────────────────

  const run = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/curriculum/contents/${contentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stdin }),
      });
      const data = await res.json() as RunResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Execution failed.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error — could not reach execution service.");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => { runRef.current = run; });

  const reset = () => {
    setCode(starterCode);
    setResult(null);
    setError(null);
  };

  // ── Peer session helpers ────────────────────────────────────────────────────

  const applyServerCode = (serverCode: string) => {
    settingFromServer.current = true;
    setCode(serverCode);
    // Give React a tick to flush before clearing the flag
    setTimeout(() => { settingFromServer.current = false; }, 50);
  };

  const pushCodeToSession = async (sid: string, codeToSend: string) => {
    try {
      await fetch(`/api/peer-sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToSend }),
      });
    } catch { /* ignore — best-effort */ }
  };

  const handleCodeChange = (val: string | undefined) => {
    const newCode = val ?? "";
    setCode(newCode);
    if (inPeerSessionRef.current && peerSessionIdRef.current && !settingFromServer.current) {
      lastLocalEdit.current = Date.now();
      if (pushTimeout.current) clearTimeout(pushTimeout.current);
      pushTimeout.current = setTimeout(() => {
        if (peerSessionIdRef.current) void pushCodeToSession(peerSessionIdRef.current, newCode);
      }, 500);
    }
  };

  const pollSession = async () => {
    const sid = peerSessionIdRef.current;
    if (!sid) return;
    try {
      const res = await fetch(`/api/peer-sessions?contentId=${contentId}`);
      if (!res.ok) return;
      const data = await res.json() as { session: PeerSessionData | null };
      if (!data.session || data.session.status === "ENDED") {
        // Session ended by host
        if (pollInterval.current) clearInterval(pollInterval.current);
        setInPeerSession(false);
        setPeerSessionId(null);
        setPeerParticipants([]);
        toast.info("Peer programming session has ended.");
        return;
      }
      setPeerParticipants(data.session.participants);
      // Apply server code only if we haven't typed in the last 1.5s
      if (Date.now() - lastLocalEdit.current > 1500) {
        applyServerCode(data.session.currentCode);
      }
    } catch { /* ignore */ }
  };

  const startPeerSession = async () => {
    setStartingPeer(true);
    try {
      const res = await fetch("/api/peer-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, starterCode: code }),
      });
      if (!res.ok) { toast.error("Failed to start peer session."); return; }
      const data = await res.json() as { session: PeerSessionData };
      setPeerSessionId(data.session.id);
      setInPeerSession(true);
      setPeerParticipants(data.session.participants);
      setAvailableSessionId(null);
      pollInterval.current = setInterval(() => void pollSession(), 2000);
      toast.success("Peer session started — students can now join.");
    } catch {
      toast.error("Failed to start peer session.");
    } finally {
      setStartingPeer(false);
    }
  };

  const endPeerSession = async () => {
    const sid = peerSessionIdRef.current;
    if (!sid) return;
    try {
      await fetch(`/api/peer-sessions/${sid}`, { method: "DELETE" });
      if (pollInterval.current) clearInterval(pollInterval.current);
      setInPeerSession(false);
      setPeerSessionId(null);
      setPeerParticipants([]);
      toast.success("Peer session ended.");
    } catch {
      toast.error("Failed to end session.");
    }
  };

  const joinPeerSession = async (sid: string) => {
    setJoiningPeer(true);
    try {
      const res = await fetch(`/api/peer-sessions/${sid}/join`, { method: "POST" });
      if (!res.ok) { toast.error("Failed to join peer session."); return; }
      const data = await res.json() as { session: PeerSessionData };
      setPeerSessionId(data.session.id);
      setInPeerSession(true);
      setPeerParticipants(data.session.participants);
      setAvailableSessionId(null);
      applyServerCode(data.session.currentCode);
      pollInterval.current = setInterval(() => void pollSession(), 2000);
      toast.success("Joined peer programming session!");
    } catch {
      toast.error("Failed to join session.");
    } finally {
      setJoiningPeer(false);
    }
  };

  // ── Student: check for available session every 5s ──────────────────────────
  useEffect(() => {
    if (isCreator) return;

    const check = async () => {
      if (inPeerSessionRef.current) return;
      try {
        const res = await fetch(`/api/peer-sessions?contentId=${contentId}`);
        if (!res.ok) return;
        const data = await res.json() as { session: { id: string } | null };
        setAvailableSessionId(data.session?.id ?? null);
      } catch { /* ignore */ }
    };

    void check(); // initial check
    checkInterval.current = setInterval(() => void check(), 5000);
    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current);
    };
  }, [contentId, isCreator]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      if (checkInterval.current) clearInterval(checkInterval.current);
      if (pushTimeout.current) clearTimeout(pushTimeout.current);
    };
  }, []);

  const success = result && result.exitCode === 0 && !result.stderr;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-[#1e1e1e] px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">{langLabel}</span>
          {inPeerSession && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <Wifi className="h-2.5 w-2.5" /> Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Peer session controls — instructors/admins */}
          {isCreator && !inPeerSession && (
            <button
              onClick={() => void startPeerSession()}
              disabled={startingPeer}
              title="Start a peer programming session"
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/10 hover:text-slate-300 disabled:opacity-50"
            >
              <Users className="h-3 w-3" />
              {startingPeer ? "Starting…" : "Peer"}
            </button>
          )}
          {isCreator && inPeerSession && (
            <button
              onClick={() => void endPeerSession()}
              title="End peer session"
              className="rounded px-2 py-1 text-[10px] font-medium text-rose-400 transition hover:bg-white/10"
            >
              End Session
            </button>
          )}

          {/* stdin toggle */}
          <button
            onClick={() => setShowStdin((v) => !v)}
            title="Toggle stdin input"
            className={`rounded px-2 py-1 text-[10px] font-medium transition ${
              showStdin
                ? "bg-amber-500/20 text-amber-400"
                : "text-slate-500 hover:bg-white/10 hover:text-slate-300"
            }`}
          >
            stdin
          </button>
          <button
            onClick={reset}
            title="Reset to starter code"
            className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <Button
            size="sm"
            onClick={() => void run()}
            disabled={running}
            title="Run (Ctrl+Enter)"
            className="h-7 gap-1.5 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
          >
            <Play className="h-3 w-3" />
            {running ? "Running…" : "Run"}
          </Button>
        </div>
      </div>

      {/* Participants strip — shown when in a session */}
      {inPeerSession && peerParticipants.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-700 bg-[#1a1a1a] px-4 py-1.5">
          <Users className="h-3 w-3 shrink-0 text-slate-500" />
          {peerParticipants.map((p) => (
            <span
              key={p.userId}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                p.userId === userId
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              {p.userId === userId ? "You" : `${p.user.firstName} ${p.user.lastName}`}
            </span>
          ))}
        </div>
      )}

      {/* Student join banner */}
      {!isCreator && availableSessionId && !inPeerSession && (
        <div className="flex items-center justify-between gap-3 border-b border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Wifi className="h-3.5 w-3.5" />
            Your instructor started a live peer programming session
          </span>
          <button
            onClick={() => void joinPeerSession(availableSessionId)}
            disabled={joiningPeer}
            className="shrink-0 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {joiningPeer ? "Joining…" : "Join Session"}
          </button>
        </div>
      )}

      {/* Stdin panel */}
      {showStdin && (
        <div className="border-b border-slate-700 bg-[#1e1e1e] px-4 py-2.5">
          <p className="mb-1.5 text-[10px] font-medium text-slate-500">
            stdin — input for your program (one value per line)
          </p>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={2}
            spellCheck={false}
            className="w-full resize-none rounded bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            placeholder={"e.g. 5\nhello world"}
          />
        </div>
      )}

      {/* Monaco Editor */}
      <MonacoEditor
        height="300px"
        language={monacoLang}
        value={code}
        onChange={handleCodeChange}
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
            () => runRef.current(),
          );
        }}
        theme="vs-dark"
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          renderLineHighlight: "all",
          tabSize: 2,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          overviewRulerLanes: 0,
        }}
      />

      {/* Output panel */}
      {(result ?? error) && (
        <div className="border-t border-slate-200 bg-slate-950">
          {/* Status bar */}
          <div className={`flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium ${success ? "bg-emerald-950/60 text-emerald-400" : "bg-rose-950/60 text-rose-400"}`}>
            <span className="flex items-center gap-1.5">
              {error && !result
                ? <><AlertCircle className="h-3.5 w-3.5" /> Service error</>
                : success
                ? <><CheckCircle2 className="h-3.5 w-3.5" /> Exited with code 0</>
                : <><AlertCircle className="h-3.5 w-3.5" /> Exited with code {result?.exitCode ?? 1}</>
              }
            </span>
            {result && (result.time ?? result.memory) && (
              <span className="flex items-center gap-2 text-slate-500">
                {result.time && <span>{result.time}s</span>}
                {result.memory && <span>{Math.round(result.memory / 1024)} KB</span>}
              </span>
            )}
          </div>

          {result?.compileOutput && (
            <div className="border-b border-slate-800 px-4 py-3">
              <p className="mb-1 text-xs font-medium text-slate-500">Compiler output</p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-amber-300">{result.compileOutput}</pre>
            </div>
          )}

          {result?.stdout && (
            <div className="px-4 py-3">
              <p className="mb-1 text-xs font-medium text-slate-500">stdout</p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-300">{result.stdout}</pre>
            </div>
          )}

          {result?.stderr && (
            <div className="border-t border-slate-800 px-4 py-3">
              <p className="mb-1 text-xs font-medium text-slate-500">stderr</p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-rose-400">{result.stderr}</pre>
            </div>
          )}

          {error && (
            <div className="px-4 py-3">
              <pre className="whitespace-pre-wrap font-mono text-xs text-rose-400">{error}</pre>
            </div>
          )}

          {result && !result.stdout && !result.stderr && !result.compileOutput && !error && (
            <div className="px-4 py-3">
              <p className="font-mono text-xs text-slate-500">(no output)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
