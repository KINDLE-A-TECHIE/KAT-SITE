/**
 * Pure file helpers for the code playground: mapping a filename to a Monaco language, picking the likely
 * entry file for a multi-file project, and base64-encoding bytes (used to ship a zipped project to Judge0).
 *
 * Extracted from code-playground-block.tsx so they can be unit-tested in isolation (no React/DOM). Nothing
 * here touches the DOM: `triggerDownload` stays in the component because it does.
 */

/** File extension (lowercase, no dot) -> Monaco language id. */
export const EXT_TO_MONACO: Record<string, string> = {
  py: "python", js: "javascript", ts: "typescript", jsx: "javascript",
  tsx: "typescript", java: "java", c: "c", cpp: "cpp", cc: "cpp",
  cs: "csharp", go: "go", rs: "rust", kt: "kotlin", swift: "swift",
  php: "php", rb: "ruby", scala: "scala", r: "r", sh: "shell",
  bash: "shell", sql: "sql", lua: "lua", pl: "perl", hs: "haskell",
  ml: "plaintext", ex: "elixir", exs: "elixir", html: "html",
  css: "css", json: "json", md: "markdown", txt: "plaintext",
};

/** Likely entry-point filenames by language, in priority order. */
export const ENTRY_CANDIDATES: Record<string, string[]> = {
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

/** Monaco language id for a filename, from its extension; "plaintext" for unknown/extension-less names. */
export function monacoLangFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MONACO[ext] ?? "plaintext";
}

/** The first entry-candidate filename present in `files` for `lang`, or null if none matches. */
export function detectEntryFile(files: Record<string, string>, lang: string): string | null {
  for (const candidate of ENTRY_CANDIDATES[lang] ?? []) {
    if (files[candidate] !== undefined) return candidate;
  }
  return null;
}

/** Base64-encode bytes in fixed chunks (avoids a huge spread that can overflow the call stack). */
export function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return btoa(binary);
}
