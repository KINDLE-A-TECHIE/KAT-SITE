"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle2, ChevronRight, Download, FilePlus,
  FolderOpen, Globe, Package, Play, RotateCcw, Send, Terminal,
  UserPlus, Users, Wifi, X,
} from "lucide-react";
import { zipSync } from "fflate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Monaco is large — load only on client, never on server
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

// ── Constants ─────────────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { value: "python",      label: "Python 3",        monacoLang: "python" },
  { value: "javascript",  label: "JavaScript",      monacoLang: "javascript" },
  { value: "typescript",  label: "TypeScript",      monacoLang: "typescript" },
  { value: "java",        label: "Java",            monacoLang: "java" },
  { value: "c",           label: "C",               monacoLang: "c" },
  { value: "cpp",         label: "C++",             monacoLang: "cpp" },
  { value: "csharp",      label: "C#",              monacoLang: "csharp" },
  { value: "go",          label: "Go",              monacoLang: "go" },
  { value: "rust",        label: "Rust",            monacoLang: "rust" },
  { value: "kotlin",      label: "Kotlin",          monacoLang: "kotlin" },
  { value: "swift",       label: "Swift",           monacoLang: "swift" },
  { value: "php",         label: "PHP",             monacoLang: "php" },
  { value: "ruby",        label: "Ruby",            monacoLang: "ruby" },
  { value: "scala",       label: "Scala",           monacoLang: "scala" },
  { value: "r",           label: "R",               monacoLang: "r" },
  { value: "bash",        label: "Bash",            monacoLang: "shell" },
  { value: "sql",         label: "SQL",             monacoLang: "sql" },
  { value: "lua",         label: "Lua",             monacoLang: "lua" },
  { value: "perl",        label: "Perl",            monacoLang: "perl" },
  { value: "haskell",     label: "Haskell",         monacoLang: "plaintext" },
  { value: "clojure",     label: "Clojure",         monacoLang: "clojure" },
  { value: "elixir",      label: "Elixir",          monacoLang: "elixir" },
  { value: "erlang",      label: "Erlang",          monacoLang: "plaintext" },
  { value: "fsharp",      label: "F#",              monacoLang: "fsharp" },
  { value: "commonlisp",  label: "Common Lisp",     monacoLang: "scheme" },
  { value: "ocaml",       label: "OCaml",           monacoLang: "plaintext" },
  { value: "groovy",      label: "Groovy",          monacoLang: "java" },
  { value: "d",           label: "D",               monacoLang: "plaintext" },
  { value: "objectivec",  label: "Objective-C",     monacoLang: "objective-c" },
  { value: "assembly",    label: "Assembly (NASM)",  monacoLang: "plaintext" },
  { value: "python2",     label: "Python 2",        monacoLang: "python" },
  { value: "fortran",     label: "Fortran",         monacoLang: "plaintext" },
  { value: "pascal",      label: "Pascal",          monacoLang: "pascal" },
  { value: "cobol",       label: "COBOL",           monacoLang: "plaintext" },
  { value: "basic",       label: "Basic",           monacoLang: "vb" },
  { value: "vbnet",       label: "VB.Net",          monacoLang: "vb" },
  { value: "prolog",      label: "Prolog",          monacoLang: "plaintext" },
  { value: "octave",      label: "Octave",          monacoLang: "matlab" },
  { value: "html",        label: "HTML",            monacoLang: "html" },
  { value: "css",         label: "CSS",             monacoLang: "css" },
] as const;

// Languages that render in the browser iframe — no Judge0 needed
const WEB_LANGUAGES = new Set(["html", "css"]);

// Language value → file extension
const LANG_EXT: Record<string, string> = {
  python: "py", python2: "py", javascript: "js", typescript: "ts",
  java: "java", c: "c", cpp: "cpp", csharp: "cs", go: "go", rust: "rs",
  kotlin: "kt", swift: "swift", php: "php", ruby: "rb", scala: "scala",
  r: "r", bash: "sh", sql: "sql", lua: "lua", perl: "pl", haskell: "hs",
  clojure: "clj", elixir: "ex", erlang: "erl", fsharp: "fs", ocaml: "ml",
  groovy: "groovy", d: "d", objectivec: "m", assembly: "asm",
  fortran: "f90", pascal: "pas", cobol: "cob", basic: "bas", prolog: "pl",
  octave: "m", commonlisp: "lisp", vbnet: "vb", html: "html", css: "css",
};

// File extension → Monaco language (for multi-file syntax highlighting)
const EXT_TO_MONACO: Record<string, string> = {
  py: "python", js: "javascript", ts: "typescript", jsx: "javascript",
  tsx: "typescript", java: "java", c: "c", cpp: "cpp", cc: "cpp",
  cs: "csharp", go: "go", rs: "rust", kt: "kotlin", swift: "swift",
  php: "php", rb: "ruby", scala: "scala", r: "r", sh: "shell",
  bash: "shell", sql: "sql", lua: "lua", pl: "perl", hs: "haskell",
  ml: "plaintext", ex: "elixir", exs: "elixir", html: "html",
  css: "css", json: "json", md: "markdown", txt: "plaintext",
};

// Likely entry-point filenames by language, in priority order
const ENTRY_CANDIDATES: Record<string, string[]> = {
  python:     ["main.py", "app.py", "index.py", "solution.py", "run.py"],
  javascript: ["index.js", "main.js", "app.js", "solution.js"],
  typescript: ["index.ts", "main.ts", "app.ts", "solution.ts"],
  java:       ["Main.java", "Solution.java", "App.java"],
  c:          ["main.c", "solution.c"],
  cpp:        ["main.cpp", "solution.cpp", "main.cc"],
  csharp:     ["Program.cs", "Main.cs", "Solution.cs"],
  go:         ["main.go"],
  rust:       ["main.rs"],
  html:       ["index.html", "main.html"],
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

function monacoLangFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MONACO[ext] ?? "plaintext";
}

function detectEntryFile(files: Record<string, string>, lang: string): string | null {
  for (const candidate of ENTRY_CANDIDATES[lang] ?? []) {
    if (files[candidate] !== undefined) return candidate;
  }
  return null;
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

type LinkedProject = {
  id: string;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "NEEDS_WORK" | "REJECTED";
  updatedAt: string;
};

type AssignmentMatch = {
  id: string;
  title: string;
  linkedProject: LinkedProject | null;
};

type EnrolledStudent = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

type PlaygroundInvite = {
  id: string;
  sessionId: string | null;
  message: string | null;
  createdAt: string;
  invitedBy: { firstName: string; lastName: string };
  content: { title: string };
};

// Minimal Pyodide surface we use
type PyodideInstance = {
  runPython:              (code: string) => unknown;
  runPythonAsync:         (code: string) => Promise<unknown>;
  loadPackagesFromImports:(code: string) => Promise<void>;
  loadPackage:            (pkg: string | string[]) => Promise<void>;
  pyimport:               (name: string) => { install: (pkg: string) => Promise<void> };
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CodePlaygroundBlock({
  contentId,
  starterCode,
  language,
  isCreator = false,
  userId,
  programId,
  moduleId,
}: {
  contentId: string;
  starterCode: string;
  language: string;
  isCreator?: boolean;
  userId?: string;
  programId?: string;
  moduleId?: string;
}) {
  // ── Storage keys ──────────────────────────────────────────────────────────
  const KEY_CODE    = `kat:pg:${contentId}:code`;
  const KEY_PROJECT = `kat:pg:${contentId}:project`;

  // ── Single-file state ──────────────────────────────────────────────────────
  const [code, setCode] = useState(starterCode);

  // ── Multi-file project state ───────────────────────────────────────────────
  const [projectFiles, setProjectFiles]           = useState<Record<string, string>>({});
  const [activeProjectFile, setActiveProjectFile] = useState<string | null>(null);
  const [entryFile, setEntryFile]                 = useState<string | null>(null);

  // ── Execution state ────────────────────────────────────────────────────────
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState<RunResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [showStdin, setShowStdin] = useState(false);
  const [stdin, setStdin]         = useState("");

  // ── Web preview state ──────────────────────────────────────────────────────
  // (no extra state needed — iframe uses srcdoc, updated via ref)

  // ── Pyodide state ──────────────────────────────────────────────────────────
  const [pyodideMode, setPyodideMode]         = useState(false);
  const [pyodideReady, setPyodideReady]       = useState(false);
  const [pyodideLoading, setPyodideLoading]   = useState(false);
  const [showPackages, setShowPackages]       = useState(false);
  const [packageInput, setPackageInput]       = useState("");
  const [installingPkg, setInstallingPkg]     = useState(false);
  const [installedPkgs, setInstalledPkgs]     = useState<string[]>([]);

  // ── Peer session state ─────────────────────────────────────────────────────
  const [peerSessionId, setPeerSessionId]         = useState<string | null>(null);
  const [inPeerSession, setInPeerSession]         = useState(false);
  const [peerParticipants, setPeerParticipants]   = useState<PeerParticipant[]>([]);
  const [startingPeer, setStartingPeer]           = useState(false);
  const [joiningPeer, setJoiningPeer]             = useState(false);
  const [availableSessionId, setAvailableSessionId] = useState<string | null>(null);

  // ── Auto-save indicator ────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // ── Submit state (students only) ───────────────────────────────────────────
  const [showSubmitForm, setShowSubmitForm]   = useState(false);
  const [submitTitle, setSubmitTitle]         = useState("");
  const [submitDesc, setSubmitDesc]           = useState("");
  const [submitting, setSubmitting]           = useState(false);
  const [checkingAssignment, setCheckingAssignment] = useState(false);
  const [assignmentMatch, setAssignmentMatch] = useState<AssignmentMatch | null | "none">(null);
  const assignmentFetched = useRef(false);

  // ── Invite modal state (instructors) ──────────────────────────────────────
  const [showInviteModal, setShowInviteModal]   = useState(false);
  const [studentSearch, setStudentSearch]       = useState("");
  const [studentResults, setStudentResults]     = useState<EnrolledStudent[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<EnrolledStudent[]>([]);
  const [inviteMessage, setInviteMessage]       = useState("");
  const [sendingInvites, setSendingInvites]     = useState(false);
  const [loadingStudents, setLoadingStudents]   = useState(false);
  const studentSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pending invite state (students) ───────────────────────────────────────
  const [pendingInvite, setPendingInvite]       = useState<PlaygroundInvite | null>(null);
  const [dismissingInvite, setDismissingInvite] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const editorRef              = useRef<unknown>(null);
  const runRef                 = useRef<() => void>(() => {});
  const lastLocalEdit          = useRef(0);
  const pushTimeout            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInterval           = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkInterval          = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingFromServer      = useRef(false);
  const peerSessionIdRef       = useRef<string | null>(null);
  const inPeerSessionRef       = useRef(false);
  const folderInputRef         = useRef<HTMLInputElement>(null);
  const fileInputRef           = useRef<HTMLInputElement>(null);
  const saveDebounce           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDebounce        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef              = useRef<HTMLIFrameElement>(null);
  const pyodideRef             = useRef<PyodideInstance | null>(null);

  // Keep refs in sync with state
  useEffect(() => { peerSessionIdRef.current = peerSessionId; }, [peerSessionId]);
  useEffect(() => { inPeerSessionRef.current = inPeerSession; }, [inPeerSession]);

  const langConfig    = SUPPORTED_LANGUAGES.find((l) => l.value === language);
  const monacoLang    = langConfig?.monacoLang ?? "plaintext";
  const langLabel     = langConfig?.label ?? language;
  const fileExtension = LANG_EXT[language] ?? language;

  // Derived flags
  const isProjectMode = Object.keys(projectFiles).length > 0;
  const isPython      = language === "python" || language === "python2";

  // Web mode: html/css always; project mode if it contains an html file
  const isWebMode = WEB_LANGUAGES.has(language)
    || (isProjectMode && Object.keys(projectFiles).some((k) => k.endsWith(".html")));

  const editorValue = isProjectMode && activeProjectFile
    ? (projectFiles[activeProjectFile] ?? "")
    : code;
  const activeMonacoLang = isProjectMode && activeProjectFile
    ? monacoLangFromFilename(activeProjectFile)
    : monacoLang;
  const sortedFiles = Object.keys(projectFiles).sort((a, b) =>
    a === entryFile ? -1 : b === entryFile ? 1 : a.localeCompare(b),
  );

  // ── Build web document from current code / project files ──────────────────
  const buildWebDoc = useCallback((): string => {
    if (isProjectMode) {
      const htmlEntry = Object.entries(projectFiles).find(([k]) => k.endsWith(".html"));
      if (!htmlEntry) return "<html><body><p style='font-family:sans-serif;padding:16px;color:#888'>No HTML file found in project.</p></body></html>";
      let html = htmlEntry[1];

      // Inline CSS files that aren't already linked
      const cssFiles = Object.entries(projectFiles).filter(([k]) => k.endsWith(".css"));
      if (cssFiles.length) {
        const css = cssFiles.map(([, v]) => v).join("\n");
        html = html.includes("</head>")
          ? html.replace("</head>", `<style>\n${css}\n</style>\n</head>`)
          : `<style>${css}</style>${html}`;
      }

      // Inline JS files that aren't already scripted
      const jsFiles = Object.entries(projectFiles).filter(([k]) => k.endsWith(".js") || k.endsWith(".mjs"));
      if (jsFiles.length) {
        const js = jsFiles.map(([, v]) => v).join("\n");
        html = html.includes("</body>")
          ? html.replace("</body>", `<script>\n${js}\n</script>\n</body>`)
          : `${html}<script>${js}</script>`;
      }
      return html;
    }

    if (language === "css") {
      return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
body { margin: 16px; font-family: sans-serif; }
${code}
</style></head>
<body>
  <h1>Heading 1</h1>
  <h2>Heading 2</h2>
  <p>A paragraph of sample text. <a href="#">A link</a>.</p>
  <button>Button</button>
  <ul><li>List item 1</li><li>List item 2</li><li>List item 3</li></ul>
  <div class="box">div.box</div>
</body></html>`;
    }

    // html — raw
    return code;
  }, [isProjectMode, projectFiles, language, code]);

  // ── Live preview auto-update (600 ms debounce) ────────────────────────────
  useEffect(() => {
    if (!isWebMode) return;
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    previewDebounce.current = setTimeout(() => {
      if (iframeRef.current) iframeRef.current.srcdoc = buildWebDoc();
    }, 600);
    return () => { if (previewDebounce.current) clearTimeout(previewDebounce.current); };
  }, [code, projectFiles, isWebMode, buildWebDoc]);

  // ── Restore from localStorage on mount ────────────────────────────────────
  useEffect(() => {
    try {
      const savedProject = localStorage.getItem(KEY_PROJECT);
      if (savedProject) {
        const parsed = JSON.parse(savedProject) as {
          files: Record<string, string>;
          entryFile: string | null;
          activeFile: string | null;
        };
        if (Object.keys(parsed.files).length > 0) {
          setProjectFiles(parsed.files);
          setEntryFile(parsed.entryFile);
          setActiveProjectFile(parsed.activeFile);
          return;
        }
      }
      const savedCode = localStorage.getItem(KEY_CODE);
      if (savedCode !== null) setCode(savedCode);
    } catch { /* localStorage unavailable */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save project mode (1 s debounce) ─────────────────────────────────
  useEffect(() => {
    if (!isProjectMode) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    setSaveState("saving");
    saveDebounce.current = setTimeout(() => {
      try {
        localStorage.setItem(
          KEY_PROJECT,
          JSON.stringify({ files: projectFiles, entryFile, activeFile: activeProjectFile }),
        );
        setSaveState("saved");
        if (savedIndicatorTimeout.current) clearTimeout(savedIndicatorTimeout.current);
        savedIndicatorTimeout.current = setTimeout(() => setSaveState("idle"), 2000);
      } catch { setSaveState("idle"); }
    }, 1000);
  }, [projectFiles, entryFile, activeProjectFile, isProjectMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set webkitdirectory imperatively (not in TS JSX types)
  useEffect(() => {
    if (folderInputRef.current) folderInputRef.current.setAttribute("webkitdirectory", "");
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollInterval.current)          clearInterval(pollInterval.current);
      if (checkInterval.current)         clearInterval(checkInterval.current);
      if (pushTimeout.current)           clearTimeout(pushTimeout.current);
      if (saveDebounce.current)          clearTimeout(saveDebounce.current);
      if (savedIndicatorTimeout.current) clearTimeout(savedIndicatorTimeout.current);
      if (previewDebounce.current)       clearTimeout(previewDebounce.current);
    };
  }, []);

  // ── Fetch linked assignment when submit form opens ─────────────────────────
  useEffect(() => {
    if (!showSubmitForm || isCreator || assignmentFetched.current) return;
    assignmentFetched.current = true;
    setCheckingAssignment(true);
    fetch("/api/projects/assignments")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { assignments: Array<{ id: string; title: string; module: { id: string } | null; linkedProject: LinkedProject | null }> } | null) => {
        if (!data) { setAssignmentMatch("none"); return; }
        const match = data.assignments.find((a) => moduleId && a.module?.id === moduleId);
        setAssignmentMatch(match ? { id: match.id, title: match.title, linkedProject: match.linkedProject } : "none");
      })
      .catch(() => setAssignmentMatch("none"))
      .finally(() => setCheckingAssignment(false));
  }, [showSubmitForm, isCreator, moduleId]);

  // ── Student: fetch pending invite for this playground on mount ────────────
  useEffect(() => {
    if (isCreator) return;
    fetch(`/api/playground-invites?contentId=${contentId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { invite: PlaygroundInvite | null } | null) => {
        if (data?.invite) setPendingInvite(data.invite);
      })
      .catch(() => { /* ignore */ });
  }, [contentId, isCreator]);

  // ── Instructor: search enrolled students (debounced 300 ms) ───────────────
  useEffect(() => {
    if (!showInviteModal || !programId) return;
    if (studentSearchDebounce.current) clearTimeout(studentSearchDebounce.current);
    setLoadingStudents(true);
    studentSearchDebounce.current = setTimeout(() => {
      const q = encodeURIComponent(studentSearch);
      fetch(`/api/programs/${programId}/students?search=${q}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: { students: EnrolledStudent[] } | null) => {
          setStudentResults(data?.students ?? []);
        })
        .catch(() => setStudentResults([]))
        .finally(() => setLoadingStudents(false));
    }, 300);
    return () => { if (studentSearchDebounce.current) clearTimeout(studentSearchDebounce.current); };
  }, [showInviteModal, studentSearch, programId]);

  // ── File loading ───────────────────────────────────────────────────────────

  const loadFilesFromInput = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const newFiles: Record<string, string> = { ...projectFiles };

    for (const file of files) {
      const rawPath = file.webkitRelativePath || file.name;
      const parts   = rawPath.split("/");
      const relativePath = parts.length > 1 ? parts.slice(1).join("/") : parts[0]!;
      if (!relativePath || relativePath.startsWith(".")) continue;
      newFiles[relativePath] = await file.text();
    }

    const cleanFiles = Object.fromEntries(
      Object.entries(newFiles).filter(([p]) => p && !p.includes("__pycache__")),
    );
    const detected  = detectEntryFile(cleanFiles, language);
    const firstFile = Object.keys(cleanFiles)[0] ?? null;
    const newEntry  = detected ?? entryFile ?? firstFile;
    const newActive = activeProjectFile && cleanFiles[activeProjectFile] !== undefined
      ? activeProjectFile
      : (detected ?? firstFile);

    setProjectFiles(cleanFiles);
    setEntryFile(newEntry);
    setActiveProjectFile(newActive);
    try { localStorage.removeItem(KEY_CODE); } catch { /* ignore */ }
    toast.success(`${Object.keys(cleanFiles).length} file(s) loaded.`);
  };

  const createNewFile = () => {
    const name = window.prompt("File name (e.g. helpers.py):");
    if (!name?.trim()) return;
    const path = name.trim();
    if (projectFiles[path] !== undefined) { toast.error("A file with that name already exists."); return; }
    setProjectFiles((prev) => ({ ...prev, [path]: "" }));
    if (!isProjectMode) setEntryFile(path);
    setActiveProjectFile(path);
  };

  const removeFile = (path: string) => {
    setProjectFiles((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    if (activeProjectFile === path) {
      const remaining = Object.keys(projectFiles).filter((p) => p !== path);
      setActiveProjectFile(remaining[0] ?? null);
    }
    if (entryFile === path) {
      const remaining = Object.keys(projectFiles).filter((p) => p !== path);
      setEntryFile(remaining[0] ?? null);
    }
  };

  const closeProject = () => {
    setProjectFiles({});
    setActiveProjectFile(null);
    setEntryFile(null);
    try { localStorage.removeItem(KEY_PROJECT); } catch { /* ignore */ }
  };

  // ── Pyodide helpers ────────────────────────────────────────────────────────

  const initPyodide = async (): Promise<PyodideInstance> => {
    if (pyodideRef.current) return pyodideRef.current;
    setPyodideLoading(true);
    try {
      if (!document.getElementById("kat-pyodide-script")) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.id    = "kat-pyodide-script";
          script.src   = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
          script.onload  = () => resolve();
          script.onerror = () => reject(new Error("Failed to fetch Pyodide"));
          document.head.appendChild(script);
        });
      }
      const instance = await (
        window as unknown as {
          loadPyodide: (opts: { indexURL: string }) => Promise<PyodideInstance>;
        }
      ).loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" });

      pyodideRef.current = instance;
      setPyodideReady(true);
      return instance;
    } catch {
      toast.error("Failed to load Pyodide — check your connection.");
      setPyodideMode(false);
      throw new Error("Pyodide load failed");
    } finally {
      setPyodideLoading(false);
    }
  };

  const installPackage = async () => {
    const pkg = packageInput.trim();
    if (!pkg) return;
    setInstallingPkg(true);
    try {
      const py = await initPyodide();
      await py.loadPackage("micropip");
      const micropip = py.pyimport("micropip");
      await micropip.install(pkg);
      setInstalledPkgs((prev) => [...prev, pkg]);
      setPackageInput("");
      toast.success(`${pkg} installed.`);
    } catch {
      toast.error(`Failed to install ${pkg}. It may not be available in Pyodide.`);
    } finally {
      setInstallingPkg(false);
    }
  };

  const runPyodide = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const py = await initPyodide();
      // Auto-load packages detected from imports
      try { await py.loadPackagesFromImports(code); } catch { /* best effort */ }
      // Redirect stdout/stderr
      py.runPython(
        "import sys\nfrom io import StringIO\nsys.stdout = StringIO()\nsys.stderr = StringIO()",
      );
      let pyError: string | null = null;
      try {
        await py.runPythonAsync(code);
      } catch (e) {
        pyError = String(e);
      }
      const stdout = String(py.runPython("sys.stdout.getvalue()") ?? "");
      const stderr = String(py.runPython("sys.stderr.getvalue()") ?? "");
      setResult({
        stdout,
        stderr: pyError ? `${stderr}${pyError}`.trim() : stderr,
        exitCode: pyError ? 1 : 0,
        compileOutput: null,
        time: null,
        memory: null,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  // ── Invite helpers ─────────────────────────────────────────────────────────

  const toggleStudent = (s: EnrolledStudent) => {
    setSelectedStudents((prev) =>
      prev.some((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s],
    );
  };

  const sendInvites = async () => {
    if (selectedStudents.length === 0) { toast.error("Select at least one student."); return; }
    setSendingInvites(true);
    try {
      const res = await fetch("/api/playground-invites", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          inviteeIds: selectedStudents.map((s) => s.id),
          ...(peerSessionId ? { sessionId: peerSessionId } : {}),
          ...(inviteMessage.trim() ? { message: inviteMessage.trim() } : {}),
        }),
      });
      if (!res.ok) { toast.error("Failed to send invites."); return; }
      toast.success(`Invite sent to ${selectedStudents.map((s) => s.firstName).join(", ")}.`);
      setShowInviteModal(false);
      setSelectedStudents([]);
      setStudentSearch("");
      setInviteMessage("");
    } catch {
      toast.error("Failed to send invites.");
    } finally {
      setSendingInvites(false);
    }
  };

  const dismissInvite = async () => {
    if (!pendingInvite) return;
    setDismissingInvite(true);
    try {
      await fetch(`/api/playground-invites/${pendingInvite.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });
      setPendingInvite(null);
    } catch { /* ignore */ } finally { setDismissingInvite(false); }
  };

  const acceptInviteSession = async () => {
    if (!pendingInvite?.sessionId) return;
    await fetch(`/api/playground-invites/${pendingInvite.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "JOINED" }),
    }).catch(() => { /* best effort */ });
    setPendingInvite(null);
    void joinPeerSession(pendingInvite.sessionId);
  };

  // ── Download ───────────────────────────────────────────────────────────────

  const downloadCode = () => {
    if (isProjectMode && Object.keys(projectFiles).length > 0) {
      const encoder = new TextEncoder();
      const entries: Record<string, Uint8Array> = {};
      for (const [path, content] of Object.entries(projectFiles)) {
        entries[path] = encoder.encode(content);
      }
      const zipped = zipSync(entries, { level: 6 });
      triggerDownload(new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" }), "project.zip");
    } else {
      triggerDownload(new Blob([code], { type: "text/plain" }), `main.${fileExtension}`);
    }
  };

  // ── Code execution ─────────────────────────────────────────────────────────

  const run = async () => {
    // Web mode — just refresh the preview iframe
    if (isWebMode) {
      if (iframeRef.current) iframeRef.current.srcdoc = buildWebDoc();
      return;
    }

    // Python browser mode — use Pyodide
    if (pyodideMode && isPython) {
      await runPyodide();
      return;
    }

    // Server-side execution via Judge0
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      let requestBody: Record<string, unknown>;

      if (isProjectMode && entryFile) {
        const entryCode    = projectFiles[entryFile] ?? "";
        const otherEntries = Object.entries(projectFiles).filter(([p]) => p !== entryFile);
        let additionalFiles: string | undefined;
        if (otherEntries.length > 0) {
          const encoder = new TextEncoder();
          const zipEntries: Record<string, Uint8Array> = {};
          for (const [path, content] of otherEntries) zipEntries[path] = encoder.encode(content);
          additionalFiles = uint8ToBase64(zipSync(zipEntries));
        }
        requestBody = { code: entryCode, stdin, ...(additionalFiles ? { additional_files: additionalFiles } : {}) };
      } else {
        requestBody = { code, stdin };
      }

      const res  = await fetch(`/api/curriculum/contents/${contentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json() as RunResult & { error?: string };
      if (!res.ok) setError(data.error ?? "Execution failed.");
      else setResult(data);
    } catch {
      setError("Network error — could not reach execution service.");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => { runRef.current = run; });

  const reset = () => {
    if (isProjectMode) {
      closeProject();
    } else {
      setCode(starterCode);
      try { localStorage.removeItem(KEY_CODE); } catch { /* ignore */ }
    }
    setResult(null);
    setError(null);
    setSaveState("idle");
  };

  // ── Peer session helpers ───────────────────────────────────────────────────

  const applyServerCode = (serverCode: string) => {
    settingFromServer.current = true;
    setCode(serverCode);
    setTimeout(() => { settingFromServer.current = false; }, 50);
  };

  const pushCodeToSession = async (sid: string, codeToSend: string) => {
    try {
      await fetch(`/api/peer-sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToSend }),
      });
    } catch { /* best-effort */ }
  };

  const handleCodeChange = (val: string | undefined) => {
    const newCode = val ?? "";

    if (isProjectMode && activeProjectFile) {
      setProjectFiles((prev) => ({ ...prev, [activeProjectFile]: newCode }));
      return;
    }

    setCode(newCode);

    // Auto-save single-file
    setSaveState("saving");
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY_CODE, newCode);
        setSaveState("saved");
        if (savedIndicatorTimeout.current) clearTimeout(savedIndicatorTimeout.current);
        savedIndicatorTimeout.current = setTimeout(() => setSaveState("idle"), 2000);
      } catch { setSaveState("idle"); }
    }, 1000);

    // Peer session sync (student only)
    if (inPeerSessionRef.current && peerSessionIdRef.current && !settingFromServer.current) {
      lastLocalEdit.current = Date.now();
      if (!isCreator) {
        if (pushTimeout.current) clearTimeout(pushTimeout.current);
        pushTimeout.current = setTimeout(() => {
          if (peerSessionIdRef.current) void pushCodeToSession(peerSessionIdRef.current, newCode);
        }, 500);
      }
    }
  };

  const pollSession = async () => {
    const sid = peerSessionIdRef.current;
    if (!sid) return;
    try {
      const res  = await fetch(`/api/peer-sessions?contentId=${contentId}`);
      if (!res.ok) return;
      const data = await res.json() as { session: PeerSessionData | null };
      if (!data.session || data.session.status === "ENDED") {
        if (pollInterval.current) clearInterval(pollInterval.current);
        setInPeerSession(false);
        setPeerSessionId(null);
        setPeerParticipants([]);
        toast.info("Peer programming session has ended.");
        return;
      }
      setPeerParticipants(data.session.participants);
      if (Date.now() - lastLocalEdit.current > 1500) applyServerCode(data.session.currentCode);
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

  // ── Student: check for available session every 5 s ─────────────────────────
  useEffect(() => {
    if (isCreator) return;
    const check = async () => {
      if (inPeerSessionRef.current) return;
      try {
        const res  = await fetch(`/api/peer-sessions?contentId=${contentId}`);
        if (!res.ok) return;
        const data = await res.json() as { session: { id: string } | null };
        setAvailableSessionId(data.session?.id ?? null);
      } catch { /* ignore */ }
    };
    void check();
    checkInterval.current = setInterval(() => void check(), 5000);
    return () => { if (checkInterval.current) clearInterval(checkInterval.current); };
  }, [contentId, isCreator]);

  // ── Submit code as project ─────────────────────────────────────────────────

  const submitCodeAsProject = async () => {
    if (!submitTitle.trim()) { toast.error("Please enter a project title."); return; }
    if (submitDesc.trim().length < 10) { toast.error("Description must be at least 10 characters."); return; }
    setSubmitting(true);
    try {
      const encoder = new TextEncoder();
      let zipBlob: Blob;
      if (isProjectMode && Object.keys(projectFiles).length > 0) {
        const entries: Record<string, Uint8Array> = {};
        for (const [path, content] of Object.entries(projectFiles)) {
          entries[path] = encoder.encode(content);
        }
        zipBlob = new Blob([zipSync(entries, { level: 6 }).buffer as ArrayBuffer], { type: "application/zip" });
      } else {
        const entries: Record<string, Uint8Array> = { [`main.${fileExtension}`]: encoder.encode(code) };
        zipBlob = new Blob([zipSync(entries, { level: 6 }).buffer as ArrayBuffer], { type: "application/zip" });
      }

      const assessmentId = typeof assignmentMatch === "object" && assignmentMatch !== null
        ? assignmentMatch.id
        : undefined;

      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       submitTitle.trim(),
          description: submitDesc.trim(),
          ...(programId    ? { programId }    : {}),
          ...(assessmentId ? { assessmentId } : {}),
        }),
      });
      if (!createRes.ok) {
        const err = (await createRes.json()) as { error?: string };
        toast.error(err.error ?? "Could not create project.");
        return;
      }
      const { project } = (await createRes.json()) as { project: { id: string } };
      const projectId   = project.id;

      const urlRes = await fetch(`/api/projects/${projectId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "source-code.zip", mimeType: "application/zip", size: zipBlob.size }),
      });
      if (!urlRes.ok) {
        const err = (await urlRes.json()) as { error?: string };
        toast.error(err.error ?? "Could not get upload URL.");
        return;
      }
      const { uploadUrl, key, publicUrl } = (await urlRes.json()) as { uploadUrl: string; key: string; publicUrl: string };

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/zip" },
        body: zipBlob,
      });
      if (!uploadRes.ok) { toast.error("Upload to storage failed."); return; }

      await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "source-code.zip", mimeType: "application/zip", size: zipBlob.size, storageKey: key, url: publicUrl }),
      });

      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBMITTED" }),
      });

      const newLinked: LinkedProject = {
        id: projectId, title: submitTitle.trim(), status: "SUBMITTED", updatedAt: new Date().toISOString(),
      };
      setAssignmentMatch((prev) =>
        prev && prev !== "none"
          ? { ...prev, linkedProject: newLinked }
          : { id: assessmentId ?? "", title: "", linkedProject: newLinked },
      );
      setShowSubmitForm(false);
      setSubmitTitle("");
      setSubmitDesc("");
      toast.success("Code submitted! Your instructor will review it soon.");
    } catch {
      toast.error("Submission failed — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived UI state ───────────────────────────────────────────────────────

  const success = result && result.exitCode === 0 && !result.stderr;
  const linkedProject = typeof assignmentMatch === "object" && assignmentMatch !== null
    ? assignmentMatch.linkedProject
    : null;

  const STATUS_LABEL: Record<LinkedProject["status"], string> = {
    DRAFT: "Draft", SUBMITTED: "Under Review", APPROVED: "Approved ✓",
    NEEDS_WORK: "Needs Work", REJECTED: "Rejected",
  };
  const STATUS_COLOR: Record<LinkedProject["status"], string> = {
    DRAFT:      "bg-slate-100 text-slate-600",
    SUBMITTED:  "bg-blue-100 text-blue-700",
    APPROVED:   "bg-emerald-100 text-emerald-700",
    NEEDS_WORK: "bg-amber-100 text-amber-700",
    REJECTED:   "bg-rose-100 text-rose-700",
  };

  const runBtnLabel = () => {
    if (pyodideLoading) return "Loading…";
    if (running) return "Running…";
    if (isWebMode) return "Preview";
    return "Run";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-[#1e1e1e] px-3 py-2">

        {/* Left — language label + badges */}
        <div className="flex min-w-0 items-center gap-2">
          {isWebMode
            ? <Globe className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            : <Terminal className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
          <span className="truncate text-xs font-medium text-slate-300">
            {isProjectMode ? (
              <span className="flex items-center gap-1">
                <span className="text-slate-500">Project</span>
                <ChevronRight className="h-3 w-3 text-slate-600" />
                <span>{entryFile ?? "—"}</span>
              </span>
            ) : langLabel}
          </span>
          {isWebMode && (
            <span className="hidden shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-400 sm:inline">
              Live Preview
            </span>
          )}
          {pyodideMode && isPython && !isWebMode && (
            <span className="hidden shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 sm:inline">
              Pyodide
            </span>
          )}
          {inPeerSession && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <Wifi className="h-2.5 w-2.5" /> Live
            </span>
          )}
          {saveState !== "idle" && (
            <span className={`shrink-0 text-[10px] transition-opacity ${saveState === "saved" ? "text-emerald-500" : "text-slate-500"}`}>
              {saveState === "saving" ? "Saving…" : "Saved"}
            </span>
          )}
        </div>

        {/* Right — actions */}
        <div className="flex shrink-0 items-center gap-1">

          {/* Python: Server ↔ Browser toggle */}
          {isPython && (
            <button
              onClick={() => { setPyodideMode((v) => !v); setResult(null); setError(null); }}
              title={pyodideMode ? "Switch to server execution (Judge0)" : "Switch to browser execution (Pyodide)"}
              className={`hidden items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition sm:flex ${pyodideMode ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:bg-white/10 hover:text-slate-300"}`}
            >
              <Globe className="h-3 w-3" />
              {pyodideMode ? "Browser" : "Server"}
            </button>
          )}

          {/* Packages panel (Python + Pyodide only) */}
          {isPython && pyodideMode && (
            <button
              onClick={() => setShowPackages((v) => !v)}
              title="Manage Python packages"
              className={`hidden items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition sm:flex ${showPackages ? "bg-violet-500/20 text-violet-400" : "text-slate-500 hover:bg-white/10 hover:text-slate-300"}`}
            >
              <Package className="h-3 w-3" />
              Packages{installedPkgs.length > 0 ? ` (${installedPkgs.length})` : ""}
            </button>
          )}

          {/* Peer session controls */}
          {isCreator && !inPeerSession && (
            <button
              onClick={() => void startPeerSession()}
              disabled={startingPeer}
              title="Start peer programming session"
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

          {/* Invite students (instructor/admin only) */}
          {isCreator && programId && (
            <button
              onClick={() => setShowInviteModal(true)}
              title="Invite students to this playground"
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
            >
              <UserPlus className="h-3 w-3" />
              Invite
            </button>
          )}

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void loadFilesFromInput(e.target.files).then(() => { e.target.value = ""; })}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void loadFilesFromInput(e.target.files).then(() => { e.target.value = ""; })}
          />

          <button onClick={() => folderInputRef.current?.click()} title="Open project folder" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/10 hover:text-slate-300">
            <FolderOpen className="h-3 w-3" />
            <span className="hidden sm:inline">Folder</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="Add files" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/10 hover:text-slate-300">
            <FilePlus className="h-3 w-3" />
            <span className="hidden sm:inline">Files</span>
          </button>
          <button onClick={downloadCode} title={isProjectMode ? "Download project as zip" : `Download as main.${fileExtension}`} className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-300">
            <Download className="h-3.5 w-3.5" />
          </button>
          {!isWebMode && (
            <button
              onClick={() => setShowStdin((v) => !v)}
              title="Toggle stdin"
              className={`rounded px-2 py-1 text-[10px] font-medium transition ${showStdin ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:bg-white/10 hover:text-slate-300"}`}
            >
              stdin
            </button>
          )}
          <button
            onClick={reset}
            title={isProjectMode ? "Close project" : "Reset to starter code"}
            className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <Button
            size="sm"
            onClick={() => void run()}
            disabled={running || pyodideLoading}
            title={isWebMode ? "Refresh preview" : "Run (Ctrl+Enter)"}
            className="h-7 gap-1.5 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
          >
            <Play className="h-3 w-3" />
            {runBtnLabel()}
          </Button>
        </div>
      </div>

      {/* ── File tabs (project mode) ─────────────────────────────────────────── */}
      {isProjectMode && (
        <div className="flex items-center gap-0 overflow-x-auto border-b border-slate-700 bg-[#252526] scrollbar-none">
          {sortedFiles.map((path) => {
            const isActive = path === activeProjectFile;
            const isEntry  = path === entryFile;
            const basename = path.split("/").pop() ?? path;
            return (
              <button
                key={path}
                onClick={() => setActiveProjectFile(path)}
                className={`group flex shrink-0 items-center gap-1.5 border-r border-slate-700 px-3 py-1.5 text-[11px] transition ${isActive ? "bg-[#1e1e1e] text-slate-200" : "text-slate-500 hover:bg-[#2d2d2d] hover:text-slate-300"}`}
              >
                {isEntry ? (
                  <span title="Entry point" className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-[8px] font-bold text-white">▶</span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setEntryFile(path); }} title="Set as entry point" className="h-3.5 w-3.5 shrink-0 rounded-sm text-[8px] text-slate-600 opacity-0 transition hover:bg-emerald-600/30 hover:text-emerald-400 group-hover:opacity-100">▶</button>
                )}
                <span className="max-w-[120px] truncate" title={path}>{basename}</span>
                <button onClick={(e) => { e.stopPropagation(); removeFile(path); }} title="Remove file" className="ml-0.5 shrink-0 rounded text-slate-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100">
                  <X className="h-2.5 w-2.5" />
                </button>
              </button>
            );
          })}
          <button onClick={createNewFile} title="New file" className="shrink-0 px-2 py-1.5 text-slate-600 transition hover:text-slate-300">
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button onClick={closeProject} title="Close project" className="ml-auto shrink-0 px-2 py-1.5 text-slate-600 transition hover:text-rose-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Participants strip (peer session) ────────────────────────────────── */}
      {inPeerSession && peerParticipants.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-700 bg-[#1a1a1a] px-4 py-1.5">
          <Users className="h-3 w-3 shrink-0 text-slate-500" />
          {peerParticipants.map((p) => (
            <span key={p.userId} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.userId === userId ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
              {p.userId === userId ? "You" : `${p.user.firstName} ${p.user.lastName}`}
            </span>
          ))}
        </div>
      )}

      {/* ── Student join banner (open peer session) ──────────────────────────── */}
      {!isCreator && availableSessionId && !inPeerSession && (
        <div className="flex items-center justify-between gap-3 border-b border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Wifi className="h-3.5 w-3.5" />
            Your instructor started a live peer programming session
          </span>
          <button onClick={() => void joinPeerSession(availableSessionId)} disabled={joiningPeer} className="shrink-0 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
            {joiningPeer ? "Joining…" : "Join Session"}
          </button>
        </div>
      )}

      {/* ── Student invite banner (from instructor) ───────────────────────────── */}
      {!isCreator && pendingInvite && !inPeerSession && (
        <div className="flex items-center justify-between gap-3 border-b border-violet-500/30 bg-violet-950/40 px-4 py-2.5">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs font-medium text-violet-300">
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
              {pendingInvite.invitedBy.firstName} {pendingInvite.invitedBy.lastName}
              {pendingInvite.sessionId ? " invited you to a live session" : " assigned you to this playground"}
            </span>
            {pendingInvite.message && (
              <p className="mt-0.5 truncate pl-5 text-[10px] text-violet-400/70">"{pendingInvite.message}"</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pendingInvite.sessionId && (
              <button onClick={() => void acceptInviteSession()} disabled={joiningPeer} className="rounded bg-violet-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50">
                {joiningPeer ? "Joining…" : "Join Session"}
              </button>
            )}
            <button onClick={() => void dismissInvite()} disabled={dismissingInvite} className="rounded px-2 py-1 text-[10px] text-violet-400/60 transition hover:text-violet-300 disabled:opacity-50" title="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Python Packages panel ─────────────────────────────────────────────── */}
      {showPackages && isPython && pyodideMode && (
        <div className="border-b border-slate-700 bg-[#1a1a1a] px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Python Packages — Pyodide
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Package name (e.g. numpy, pandas)"
              value={packageInput}
              onChange={(e) => setPackageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void installPackage(); }}
              className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              onClick={() => void installPackage()}
              disabled={installingPkg || !packageInput.trim()}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {installingPkg ? "Installing…" : "Install"}
            </button>
          </div>
          {installedPkgs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {installedPkgs.map((pkg) => (
                <span key={pkg} className="rounded-full bg-violet-900/40 px-2 py-0.5 text-[10px] text-violet-300">{pkg}</span>
              ))}
            </div>
          )}
          {!pyodideReady && (
            <p className="mt-1.5 text-[10px] text-slate-500">
              Pyodide loads on first run (~10 MB, cached afterwards). Pure-Python packages only.
            </p>
          )}
        </div>
      )}

      {/* ── Stdin panel ───────────────────────────────────────────────────────── */}
      {showStdin && !isWebMode && (
        <div className="border-b border-slate-700 bg-[#1e1e1e] px-4 py-2.5">
          <p className="mb-1.5 text-[10px] font-medium text-slate-500">stdin — one value per line</p>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder={"e.g. 5\nhello world"}
            className="w-full resize-none rounded bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
          />
        </div>
      )}

      {/* ── Split pane: Editor + Output/Preview ──────────────────────────────── */}
      <div className="flex flex-col lg:h-[500px] lg:flex-row">

        {/* Editor pane */}
        <div className="h-[420px] lg:h-full lg:flex-1">
          <MonacoEditor
            height="100%"
            language={activeMonacoLang}
            value={editorValue}
            onChange={handleCodeChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
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
        </div>

        {/* Output / Preview pane */}
        <div className="flex h-[320px] flex-col border-t border-slate-700 lg:h-full lg:w-[45%] lg:border-l lg:border-t-0">
          {isWebMode ? (
            /* ── Web Preview ── */
            <div className="flex h-full flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-[#1a1a1a] px-3 py-1.5">
                <Globe className="h-3 w-3 text-sky-400" />
                <span className="text-[10px] font-medium text-slate-400">Preview</span>
                <button
                  onClick={() => { if (iframeRef.current) iframeRef.current.srcdoc = buildWebDoc(); }}
                  title="Refresh preview"
                  className="ml-auto text-[10px] text-slate-500 transition hover:text-slate-300"
                >
                  ↺ Refresh
                </button>
              </div>
              <iframe
                ref={iframeRef}
                title="Web Preview"
                sandbox="allow-scripts"
                className="flex-1 w-full bg-white"
                srcDoc={buildWebDoc()}
              />
            </div>
          ) : (
            /* ── Terminal Output ── */
            <div className="flex h-full flex-col bg-slate-950">
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-[#1a1a1a] px-3 py-1.5">
                <Terminal className="h-3 w-3 text-slate-500" />
                <span className="text-[10px] font-medium text-slate-400">Output</span>
                {result && (
                  <span className={`ml-auto text-[10px] font-semibold ${success ? "text-emerald-400" : "text-rose-400"}`}>
                    {success ? "✓ Exit 0" : `✗ Exit ${result.exitCode}`}
                  </span>
                )}
                {result && (result.time ?? result.memory) && (
                  <span className="flex items-center gap-2 text-[10px] text-slate-500">
                    {result.time   && <span>{result.time}s</span>}
                    {result.memory && <span>{Math.round(result.memory / 1024)} KB</span>}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {!result && !error && !running && (
                  <div className="flex h-full items-center justify-center px-4 text-center">
                    <p className="text-xs text-slate-600">
                      {pyodideMode && isPython ? "Browser execution via Pyodide" : "Press Run or Ctrl+Enter"}
                    </p>
                  </div>
                )}
                {running && (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {pyodideLoading ? "Loading Pyodide…" : "Running…"}
                    </div>
                  </div>
                )}
                {(result ?? error) && !running && (
                  <div className="p-4 space-y-3">
                    {result?.compileOutput && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Compiler</p>
                        <pre className="whitespace-pre-wrap font-mono text-xs text-amber-300">{result.compileOutput}</pre>
                      </div>
                    )}
                    {result?.stdout && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">stdout</p>
                        <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-300">{result.stdout}</pre>
                      </div>
                    )}
                    {result?.stderr && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">stderr</p>
                        <pre className="whitespace-pre-wrap font-mono text-xs text-rose-400">{result.stderr}</pre>
                      </div>
                    )}
                    {error && (
                      <pre className="whitespace-pre-wrap font-mono text-xs text-rose-400">{error}</pre>
                    )}
                    {result && !result.stdout && !result.stderr && !result.compileOutput && !error && (
                      <p className="font-mono text-xs text-slate-600">(no output)</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Invite Students Modal ─────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-slate-700 bg-[#1e1e1e] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">Invite Students</p>
                <p className="text-[11px] text-slate-400">
                  {inPeerSession ? "Invite to this live session" : "Assign to this playground"}
                </p>
              </div>
              <button
                onClick={() => { setShowInviteModal(false); setSelectedStudents([]); setStudentSearch(""); setInviteMessage(""); }}
                className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search by name or email…"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              autoFocus
            />

            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-700">
              {loadingStudents ? (
                <div className="p-4 text-center text-xs text-slate-500">Searching…</div>
              ) : studentResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  {programId ? "No enrolled students found." : "No program linked to this lesson."}
                </div>
              ) : (
                studentResults.map((s) => {
                  const selected = selectedStudents.some((x) => x.id === s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStudent(s)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/5 ${selected ? "bg-violet-900/30" : ""}`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition ${selected ? "border-violet-500 bg-violet-600 text-white" : "border-slate-600 text-transparent"}`}>
                        ✓
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200">
                          {s.firstName} {s.lastName}
                          <span className="ml-1.5 text-[10px] font-normal text-slate-500">{s.role}</span>
                        </p>
                        <p className="truncate text-[10px] text-slate-500">{s.email}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedStudents.map((s) => (
                  <span key={s.id} className="flex items-center gap-1 rounded-full bg-violet-900/40 px-2.5 py-0.5 text-[11px] text-violet-300">
                    {s.firstName}
                    <button onClick={() => toggleStudent(s)} className="ml-0.5 text-violet-400 hover:text-violet-200">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <textarea
              placeholder="Optional message (e.g. Practice the loop exercise from today's class)"
              maxLength={500}
              rows={2}
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />

            {inPeerSession && (
              <p className="flex items-center gap-1.5 rounded-lg bg-emerald-900/30 px-3 py-2 text-[11px] text-emerald-400">
                <Wifi className="h-3 w-3 shrink-0" />
                Students will be invited directly into your active live session.
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">{selectedStudents.length} selected</span>
              <button
                onClick={() => void sendInvites()}
                disabled={sendingInvites || selectedStudents.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {sendingInvites ? "Sending…" : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit section (students only) ────────────────────────────────────── */}
      {!isCreator && (
        <div className="border-t border-slate-200 dark:border-slate-700">

          {linkedProject && !showSubmitForm && (
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">
                  Submitted: <span className="font-medium text-slate-800 dark:text-slate-200">{linkedProject.title}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[linkedProject.status]}`}>
                  {STATUS_LABEL[linkedProject.status]}
                </span>
              </div>
              <button
                onClick={() => setShowSubmitForm(true)}
                className="shrink-0 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                Submit again
              </button>
            </div>
          )}

          {showSubmitForm ? (
            <div className="space-y-2.5 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Submit code to instructor</p>
                {checkingAssignment && (
                  <span className="text-[10px] text-slate-400">Checking for linked assignment…</span>
                )}
                {!checkingAssignment && typeof assignmentMatch === "object" && assignmentMatch !== null && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">
                    Linked to: {assignmentMatch.title}
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Project title (e.g. Calculator App)"
                maxLength={120}
                value={submitTitle}
                onChange={(e) => setSubmitTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <textarea
                placeholder="Short description — what does your project do? (min. 10 characters)"
                maxLength={500}
                rows={2}
                value={submitDesc}
                onChange={(e) => setSubmitDesc(e.target.value)}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void submitCodeAsProject()}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting
                    ? <><AlertCircle className="h-3 w-3 animate-pulse" /> Submitting…</>
                    : <><Send className="h-3 w-3" /> Submit to Instructor</>}
                </button>
                <button
                  onClick={() => { setShowSubmitForm(false); setSubmitTitle(""); setSubmitDesc(""); }}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : !linkedProject ? (
            <button
              onClick={() => setShowSubmitForm(true)}
              className="flex w-full items-center justify-center gap-1.5 px-4 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-blue-600 dark:hover:bg-slate-800/50 dark:hover:text-blue-400"
            >
              <Send className="h-3 w-3" />
              Submit code to instructor
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
