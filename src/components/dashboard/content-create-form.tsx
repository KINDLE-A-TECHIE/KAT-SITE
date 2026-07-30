"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Blocks, Code2, FileText, Link as LinkIcon, Network, Video, Youtube, Plus, X, Send, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LANGUAGES } from "@/components/dashboard/code-playground-block";
import { LEVELS } from "@/lib/network-lab/levels";

type Tab = "RICH_TEXT" | "YOUTUBE_EMBED" | "EXTERNAL_VIDEO" | "DOCUMENT_LINK" | "CODE_PLAYGROUND" | "NETWORK_LAB" | "BLOCKLY";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "RICH_TEXT",       label: "Rich Text", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "YOUTUBE_EMBED",   label: "YouTube",   icon: <Youtube className="h-3.5 w-3.5" /> },
  { id: "EXTERNAL_VIDEO",  label: "Video URL", icon: <Video className="h-3.5 w-3.5" /> },
  { id: "DOCUMENT_LINK",   label: "Document",  icon: <LinkIcon className="h-3.5 w-3.5" /> },
  { id: "CODE_PLAYGROUND", label: "Code",      icon: <Code2 className="h-3.5 w-3.5" /> },
  { id: "NETWORK_LAB",     label: "Network Lab", icon: <Network className="h-3.5 w-3.5" /> },
  { id: "BLOCKLY",         label: "Blocks",    icon: <Blocks className="h-3.5 w-3.5" /> },
];

const TAB_ICON: Record<Tab, React.ReactNode> = {
  RICH_TEXT:       <FileText className="h-3.5 w-3.5" />,
  YOUTUBE_EMBED:   <Youtube className="h-3.5 w-3.5" />,
  EXTERNAL_VIDEO:  <Video className="h-3.5 w-3.5" />,
  DOCUMENT_LINK:   <LinkIcon className="h-3.5 w-3.5" />,
  CODE_PLAYGROUND: <Code2 className="h-3.5 w-3.5" />,
  NETWORK_LAB:     <Network className="h-3.5 w-3.5" />,
  BLOCKLY:         <Blocks className="h-3.5 w-3.5" />,
};

const TAB_LABEL: Record<Tab, string> = {
  RICH_TEXT:       "Rich Text",
  YOUTUBE_EMBED:   "YouTube",
  EXTERNAL_VIDEO:  "Video URL",
  DOCUMENT_LINK:   "Document",
  CODE_PLAYGROUND: "Code",
  NETWORK_LAB:     "Network Lab",
  BLOCKLY:         "Blocks",
};

const LAB_LEVELS = Object.entries(LEVELS).map(([key, level]) => ({ key, unit: level.unit }));

const STARTER_CODE: Record<string, string> = {
  // Popular
  python:      "# Write your Python code here\nprint(\"Hello, World!\")\n",
  javascript:  "// Write your JavaScript code here\nconsole.log(\"Hello, World!\");\n",
  typescript:  "// Write your TypeScript code here\nconst greeting: string = \"Hello, World!\";\nconsole.log(greeting);\n",
  java:        "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}\n",
  c:           "#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}\n",
  cpp:         "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, World!\" << std::endl;\n    return 0;\n}\n",
  csharp:      "using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine(\"Hello, World!\");\n    }\n}\n",
  go:          "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello, World!\")\n}\n",
  rust:        "fn main() {\n    println!(\"Hello, World!\");\n}\n",
  kotlin:      "fun main() {\n    println(\"Hello, World!\")\n}\n",
  swift:       "print(\"Hello, World!\")\n",
  php:         "<?php\necho \"Hello, World!\\n\";\n",
  ruby:        "puts \"Hello, World!\"\n",
  scala:       "object Main extends App {\n    println(\"Hello, World!\")\n}\n",
  r:           "cat(\"Hello, World!\\n\")\n",
  bash:        "#!/bin/bash\necho \"Hello, World!\"\n",
  sql:         "SELECT 'Hello, World!' AS greeting;\n",
  lua:         "print(\"Hello, World!\")\n",
  perl:        "use strict;\nuse warnings;\nprint \"Hello, World!\\n\";\n",
  // Functional
  haskell:     "main :: IO ()\nmain = putStrLn \"Hello, World!\"\n",
  clojure:     "(println \"Hello, World!\")\n",
  elixir:      "IO.puts(\"Hello, World!\")\n",
  erlang:      "-module(main).\n-export([main/0]).\nmain() ->\n    io:format(\"Hello, World!~n\").\n",
  fsharp:      "printfn \"Hello, World!\"\n",
  commonlisp:  "(format t \"Hello, World!~%\")\n",
  ocaml:       "let () = print_endline \"Hello, World!\"\n",
  // JVM extras
  groovy:      "println \"Hello, World!\"\n",
  // Systems / low-level
  d:           "import std.stdio;\nvoid main() {\n    writeln(\"Hello, World!\");\n}\n",
  objectivec:  "#import <Foundation/Foundation.h>\nint main() {\n    NSLog(@\"Hello, World!\");\n    return 0;\n}\n",
  assembly:    "section .data\n    msg db \"Hello, World!\", 10\n    len equ $ - msg\nsection .text\n    global _start\n_start:\n    mov rax, 1\n    mov rdi, 1\n    mov rsi, msg\n    mov rdx, len\n    syscall\n    mov rax, 60\n    xor rdi, rdi\n    syscall\n",
  // Scripting / legacy
  python2:     "print \"Hello, World!\"\n",
  fortran:     "program hello\n    print *, 'Hello, World!'\nend program hello\n",
  pascal:      "program Hello;\nbegin\n    writeln('Hello, World!');\nend.\n",
  cobol:       "IDENTIFICATION DIVISION.\nPROGRAM-ID. Hello.\nPROCEDURE DIVISION.\n    DISPLAY 'Hello, World!'.\n    STOP RUN.\n",
  basic:       "print \"Hello, World!\"\n",
  vbnet:       "Module Program\n    Sub Main()\n        Console.WriteLine(\"Hello, World!\")\n    End Sub\nEnd Module\n",
  prolog:      ":- initialization(main, main).\nmain :- write('Hello, World!'), nl.\n",
  octave:      "disp('Hello, World!')\n",
};

type QueuedBlock = {
  localId: string;
  type: Tab;
  title: string;
  body: string;
  url: string;
  language: string;
  starterCode: string;
};

export function ContentCreateForm({
  lessonId,
  onSuccess,
}: {
  lessonId: string;
  onSuccess: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("RICH_TEXT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<string>(SUPPORTED_LANGUAGES[0].value);
  const [starterCode, setStarterCode] = useState(STARTER_CODE[SUPPORTED_LANGUAGES[0].value] ?? "");
  const [labLevel, setLabLevel] = useState<string>(LAB_LEVELS[0]?.key ?? "");
  const [queue, setQueue] = useState<QueuedBlock[]>([]);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Insert text into the body at the cursor (or append if the field is not focused), then restore
  // the caret just after what we inserted so the author can keep typing.
  const insertIntoBody = (snippet: string) => {
    const ta = bodyRef.current;
    if (!ta) { setBody((b) => b + snippet); return; }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + snippet.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // raw ceiling; the server compresses down to WebP

  // Send the raw file to the server, which compresses it to WebP (the same sharp path avatars/logos
  // use) and stores it on R2, then drop an <img> at the cursor. We store the image ourselves so a note
  // never depends on an outside host, and a big photo is shrunk rather than rejected.
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Use a PNG, JPEG, GIF, or WebP image."); return; }
    if (file.size > MAX_IMAGE_SIZE) { toast.error("Image too large (max 20 MB)."); return; }

    setImgBusy(true);
    try {
      const res = await fetch(`/api/curriculum/lessons/${lessonId}/note-image`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        toast.error(data.error ?? "Could not upload the image.");
        return;
      }
      const { url } = await res.json() as { url: string };
      insertIntoBody(`\n<img src="${url}" alt="">\n`);
      toast.success("Image inserted and compressed. Add alt text describing it for accessibility.");
    } catch {
      toast.error("Network error while uploading the image.");
    } finally {
      setImgBusy(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setUrl("");
    setLanguage(SUPPORTED_LANGUAGES[0].value);
    setStarterCode(STARTER_CODE[SUPPORTED_LANGUAGES[0].value] ?? "");
    setLabLevel(LAB_LEVELS[0]?.key ?? "");
    setTab("RICH_TEXT");
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setStarterCode(STARTER_CODE[lang] ?? "");
  };

  const addBlock = () => {
    if (!title.trim()) { toast.error("Title is required."); return; }
    if (tab === "RICH_TEXT" && !body.trim()) { toast.error("Content body is required."); return; }
    if ((tab === "YOUTUBE_EMBED" || tab === "EXTERNAL_VIDEO" || tab === "DOCUMENT_LINK") && !url.trim()) {
      toast.error("URL is required."); return;
    }
    if (tab === "CODE_PLAYGROUND" && !starterCode.trim()) { toast.error("Starter code is required."); return; }
    if (tab === "NETWORK_LAB" && !labLevel) { toast.error("Choose a level."); return; }

    // NETWORK_LAB stores the chosen level key in `body`, the same slot CODE_PLAYGROUND uses for code.
    const blockBody = tab === "NETWORK_LAB" ? labLevel : body;
    setQueue((prev) => [
      ...prev,
      { localId: `${Date.now()}-${Math.random()}`, type: tab, title: title.trim(), body: blockBody, url: url.trim(), language, starterCode },
    ]);
    resetForm();
  };

  const removeBlock = (localId: string) => {
    setQueue((prev) => prev.filter((b) => b.localId !== localId));
  };

  const submitAll = async () => {
    if (queue.length === 0) { toast.error("Add at least one content block first."); return; }
    setBusy(true);
    try {
      for (const block of queue) {
        const payload: Record<string, unknown> = { type: block.type, title: block.title };
        if (block.type === "RICH_TEXT")         payload.body = block.body;
        else if (block.type === "CODE_PLAYGROUND") { payload.body = block.starterCode; payload.language = block.language; }
        else if (block.type === "NETWORK_LAB")  payload.body = block.body;
        // BLOCKLY config is optional: send body only when the author provided one (blank = default toolbox).
        else if (block.type === "BLOCKLY")      { if (block.body.trim()) payload.body = block.body; }
        else                                    payload.url = block.url;

        const res = await fetch(`/api/curriculum/lessons/${lessonId}/contents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json() as { error?: string };
          toast.error(`Failed to submit "${block.title}": ${data.error ?? "Unknown error"}`);
          return;
        }
      }
      toast.success(`${queue.length} block${queue.length > 1 ? "s" : ""} submitted for review.`);
      setQueue([]);
      await onSuccess();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Type tabs */}
      <div className="flex gap-1 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-white dark:bg-stone-900 text-kat-clay shadow-sm"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="content-title" className="text-sm">Title</Label>
        <Input
          id="content-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Introduction to React Hooks"
          className="text-sm"
        />
      </div>

      {/* Body / URL / Code fields */}
      {tab === "RICH_TEXT" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="content-body" className="text-sm">Content (HTML or plain text)</Label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => void onPickImage(e)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={imgBusy}
              className="h-7 gap-1.5 text-xs"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {imgBusy ? "Uploading…" : "Insert image"}
            </Button>
          </div>
          <Textarea
            id="content-body"
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter lesson content here. You can use HTML tags like <b>, <ul>, <li>, <p>, <h3>, etc."
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Basic HTML is supported. Inserted images are compressed and stored on KAT, and pupils can tap
            one to zoom. Write math with TeX between dollar signs, e.g.{" "}
            <code className="font-mono">$a^2 + b^2 = c^2$</code>. Script tags are stripped.
          </p>
        </div>
      )}

      {tab === "YOUTUBE_EMBED" && (
        <div className="space-y-1.5">
          <Label htmlFor="content-url" className="text-sm">YouTube URL</Label>
          <Input
            id="content-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
            className="text-sm"
          />
          <p className="text-xs text-stone-400 dark:text-stone-500">Paste any YouTube watch or share URL.</p>
        </div>
      )}

      {tab === "EXTERNAL_VIDEO" && (
        <div className="space-y-1.5">
          <Label htmlFor="content-url" className="text-sm">Video URL</Label>
          <Input
            id="content-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/video.mp4"
            className="text-sm"
          />
          <p className="text-xs text-stone-400 dark:text-stone-500">Direct link to an .mp4 or other browser-supported video file.</p>
        </div>
      )}

      {tab === "DOCUMENT_LINK" && (
        <div className="space-y-1.5">
          <Label htmlFor="content-url" className="text-sm">Document URL</Label>
          <Input
            id="content-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/... or https://docs.google.com/..."
            className="text-sm"
          />
          <p className="text-xs text-stone-400 dark:text-stone-500">Link to a Google Doc, PDF, Notion page, or any public document URL.</p>
        </div>
      )}

      {tab === "CODE_PLAYGROUND" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="code-language" className="text-sm">Language</Label>
            <select
              id="code-language"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 focus:border-kat-clay focus:outline-none focus:ring-1 focus:ring-kat-clay"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="starter-code" className="text-sm">
              Starter Code <span className="font-normal text-stone-400 dark:text-stone-500">(learners will see this as their starting point)</span>
            </Label>
            <Textarea
              id="starter-code"
              value={starterCode}
              onChange={(e) => setStarterCode(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              spellCheck={false}
            />
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Learners can edit this code freely in their Monaco editor and run it directly.
            </p>
          </div>
        </div>
      )}

      {tab === "NETWORK_LAB" && (
        <div className="space-y-1.5">
          <Label htmlFor="lab-level" className="text-sm">Level</Label>
          <select
            id="lab-level"
            value={labLevel}
            onChange={(e) => setLabLevel(e.target.value)}
            className="w-full rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 focus:border-kat-clay focus:outline-none focus:ring-1 focus:ring-kat-clay"
          >
            {LAB_LEVELS.map((l) => (
              <option key={l.key} value={l.key}>{l.key} · {l.unit}</option>
            ))}
          </select>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Learners build and launch packets to complete this network level. Add a Rich Text block
            for the instructions.
          </p>
        </div>
      )}

      {tab === "BLOCKLY" && (
        <div className="space-y-1.5">
          <Label htmlFor="blockly-config" className="text-sm">
            Advanced config <span className="font-normal text-stone-400 dark:text-stone-500">(JSON, optional)</span>
          </Label>
          <Textarea
            id="blockly-config"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder={'Leave blank for the default block set. Optional: {"prompt":"Make the robot say hello 3 times","toolbox":{...},"startBlocks":{...},"allowCode":true}'}
            className="font-mono text-sm"
            spellCheck={false}
          />
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Learners drag Python blocks and run them, and can switch to a Python editor seeded from their
            blocks. Blank uses the default toolbox, an empty canvas, and the Python switch on. Optional
            keys: <code>prompt</code> (an instruction line), <code>toolbox</code> (a Blockly toolbox),
            <code>startBlocks</code> (a saved workspace), <code>allowCode</code> (set <code>false</code> to
            keep it blocks-only). Add a Rich Text block for full instructions.
          </p>
        </div>
      )}

      {/* Add Block button */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addBlock}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Block
        </Button>
      </div>

      {/* Queued blocks */}
      {queue.length > 0 && (
        <div className="space-y-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 p-3">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
            {queue.length} block{queue.length > 1 ? "s" : ""} ready to submit
          </p>
          <div className="space-y-1.5">
            {queue.map((block, i) => (
              <div
                key={block.localId}
                className="flex items-center gap-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-3 py-2"
              >
                <span className="flex size-5 shrink-0 items-center justify-center text-stone-400 dark:text-stone-500">
                  {TAB_ICON[block.type]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-stone-700 dark:text-stone-200">{block.title}</span>
                  <span className="text-[11px] text-stone-400 dark:text-stone-500">{TAB_LABEL[block.type]}</span>
                </span>
                <span className="shrink-0 text-[11px] text-stone-300 dark:text-stone-600">#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeBlock(block.localId)}
                  className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-rose-500"
                  title="Remove block"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1">
            <Button
              onClick={() => void submitAll()}
              disabled={busy}
              className="gap-1.5 bg-kat-clay text-sm hover:bg-kat-clay-deep"
            >
              <Send className="h-3.5 w-3.5" />
              {busy ? "Submitting…" : `Submit ${queue.length} Block${queue.length > 1 ? "s" : ""} for Review`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
