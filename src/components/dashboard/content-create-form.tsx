"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Code2, FileText, Link as LinkIcon, Video, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LANGUAGES } from "@/components/dashboard/code-playground-block";

type Tab = "RICH_TEXT" | "YOUTUBE_EMBED" | "EXTERNAL_VIDEO" | "DOCUMENT_LINK" | "CODE_PLAYGROUND";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "RICH_TEXT",       label: "Rich Text", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "YOUTUBE_EMBED",   label: "YouTube",   icon: <Youtube className="h-3.5 w-3.5" /> },
  { id: "EXTERNAL_VIDEO",  label: "Video URL", icon: <Video className="h-3.5 w-3.5" /> },
  { id: "DOCUMENT_LINK",   label: "Document",  icon: <LinkIcon className="h-3.5 w-3.5" /> },
  { id: "CODE_PLAYGROUND", label: "Code",      icon: <Code2 className="h-3.5 w-3.5" /> },
];

const STARTER_CODE: Record<string, string> = {
  python:     "# Write your Python code here\nprint(\"Hello, World!\")\n",
  javascript: "// Write your JavaScript code here\nconsole.log(\"Hello, World!\");\n",
  typescript: "// Write your TypeScript code here\nconst greeting: string = \"Hello, World!\";\nconsole.log(greeting);\n",
  java:       "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}\n",
  c:          "#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}\n",
  cpp:        "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, World!\" << std::endl;\n    return 0;\n}\n",
  go:         "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello, World!\")\n}\n",
  rust:       "fn main() {\n    println!(\"Hello, World!\");\n}\n",
  php:        "<?php\necho \"Hello, World!\\n\";\n",
  ruby:       "puts \"Hello, World!\"\n",
  csharp:     "using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine(\"Hello, World!\");\n    }\n}\n",
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
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
    setUrl("");
    setLanguage(SUPPORTED_LANGUAGES[0].value);
    setStarterCode(STARTER_CODE[SUPPORTED_LANGUAGES[0].value] ?? "");
    setTab("RICH_TEXT");
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setStarterCode(STARTER_CODE[lang] ?? "");
  };

  const submit = async () => {
    if (!title.trim()) { toast.error("Title is required."); return; }

    if (tab === "RICH_TEXT" && !body.trim()) {
      toast.error("Content body is required for rich text."); return;
    }
    if ((tab === "YOUTUBE_EMBED" || tab === "EXTERNAL_VIDEO" || tab === "DOCUMENT_LINK") && !url.trim()) {
      toast.error("URL is required."); return;
    }
    if (tab === "CODE_PLAYGROUND" && !starterCode.trim()) {
      toast.error("Starter code is required."); return;
    }

    setBusy(true);
    try {
      const payload: Record<string, unknown> = { type: tab, title: title.trim() };
      if (tab === "RICH_TEXT")         payload.body = body;
      else if (tab === "CODE_PLAYGROUND") { payload.body = starterCode; payload.language = language; }
      else                              payload.url = url.trim();

      const res = await fetch(`/api/curriculum/lessons/${lessonId}/contents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Content submitted for review.");
        reset();
        await onSuccess();
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? "Failed to create content.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Type tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-[#1E5FAF] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
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
          <Label htmlFor="content-body" className="text-sm">Content (HTML or plain text)</Label>
          <Textarea
            id="content-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter lesson content here. You can use HTML tags like <b>, <ul>, <li>, <p>, <h3>, etc."
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-slate-400">Basic HTML is supported. Script tags will be stripped.</p>
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
          <p className="text-xs text-slate-400">Paste any YouTube watch or share URL.</p>
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
          <p className="text-xs text-slate-400">Direct link to an .mp4 or other browser-supported video file.</p>
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
          <p className="text-xs text-slate-400">Link to a Google Doc, PDF, Notion page, or any public document URL.</p>
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
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1E5FAF] focus:outline-none focus:ring-1 focus:ring-[#1E5FAF]"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="starter-code" className="text-sm">
              Starter Code <span className="font-normal text-slate-400">(learners will see this as their starting point)</span>
            </Label>
            <Textarea
              id="starter-code"
              value={starterCode}
              onChange={(e) => setStarterCode(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              spellCheck={false}
            />
            <p className="text-xs text-slate-400">
              Learners can edit this code freely in their Monaco editor and run it directly.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => void submit()}
          disabled={busy}
          className="bg-[#1E5FAF] text-sm hover:bg-[#1a4f8f]"
        >
          {busy ? "Submitting…" : "Submit for Review"}
        </Button>
      </div>
    </div>
  );
}