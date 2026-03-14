"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, CheckCircle2, Play, RotateCcw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Monaco is large — load only on client, never on server
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
});

export const SUPPORTED_LANGUAGES = [
  { value: "python",     label: "Python",     monacoLang: "python" },
  { value: "javascript", label: "JavaScript",  monacoLang: "javascript" },
  { value: "typescript", label: "TypeScript",  monacoLang: "typescript" },
  { value: "java",       label: "Java",        monacoLang: "java" },
  { value: "c",          label: "C",           monacoLang: "c" },
  { value: "cpp",        label: "C++",         monacoLang: "cpp" },
  { value: "go",         label: "Go",          monacoLang: "go" },
  { value: "rust",       label: "Rust",        monacoLang: "rust" },
  { value: "php",        label: "PHP",         monacoLang: "php" },
  { value: "ruby",       label: "Ruby",        monacoLang: "ruby" },
  { value: "csharp",     label: "C#",          monacoLang: "csharp" },
] as const;

type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  compileOutput: string | null;
};

export function CodePlaygroundBlock({
  contentId,
  starterCode,
  language,
}: {
  contentId: string;
  starterCode: string;
  language: string;
}) {
  const [code, setCode] = useState(starterCode);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<unknown>(null);

  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.value === language);
  const monacoLang = langConfig?.monacoLang ?? "plaintext";
  const langLabel = langConfig?.label ?? language;

  const run = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/curriculum/contents/${contentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
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

  const reset = () => {
    setCode(starterCode);
    setResult(null);
    setError(null);
  };

  const success = result && result.exitCode === 0 && !result.stderr;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[#1e1e1e] px-4 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">{langLabel}</span>
        </div>
        <div className="flex items-center gap-2">
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
            className="h-7 gap-1.5 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
          >
            <Play className="h-3 w-3" />
            {running ? "Running…" : "Run"}
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <MonacoEditor
        height="300px"
        language={monacoLang}
        value={code}
        onChange={(val) => setCode(val ?? "")}
        onMount={(editor) => { editorRef.current = editor; }}
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
          <div className={`flex items-center gap-2 px-4 py-2 text-xs font-medium ${success ? "bg-emerald-950/60 text-emerald-400" : "bg-rose-950/60 text-rose-400"}`}>
            {error && !result
              ? <><AlertCircle className="h-3.5 w-3.5" /> Service error</>
              : success
              ? <><CheckCircle2 className="h-3.5 w-3.5" /> Exited with code 0</>
              : <><AlertCircle className="h-3.5 w-3.5" /> Exited with code {result?.exitCode ?? 1}</>
            }
          </div>

          {/* Compile output (C, C++, Java, Rust) */}
          {result?.compileOutput && (
            <div className="border-b border-slate-800 px-4 py-3">
              <p className="mb-1 text-xs font-medium text-slate-500">Compiler output</p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-amber-300">{result.compileOutput}</pre>
            </div>
          )}

          {/* stdout */}
          {result?.stdout && (
            <div className="px-4 py-3">
              <p className="mb-1 text-xs font-medium text-slate-500">stdout</p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-300">{result.stdout}</pre>
            </div>
          )}

          {/* stderr */}
          {result?.stderr && (
            <div className="border-t border-slate-800 px-4 py-3">
              <p className="mb-1 text-xs font-medium text-slate-500">stderr</p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-rose-400">{result.stderr}</pre>
            </div>
          )}

          {/* Network/API error */}
          {error && (
            <div className="px-4 py-3">
              <pre className="whitespace-pre-wrap font-mono text-xs text-rose-400">{error}</pre>
            </div>
          )}

          {/* Empty output */}
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