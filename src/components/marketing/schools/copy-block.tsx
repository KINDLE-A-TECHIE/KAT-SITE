"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * A code block with a copy button.
 *
 * Client-only for the clipboard; the surrounding docs page stays a server component so the whole
 * thing is static HTML. An integrator will copy these, not retype them, and a mistyped secret or a
 * mistyped signature check is a support ticket at best.
 */
export function CopyBlock({
  code,
  label,
  language = "bash",
}: {
  code: string;
  label?: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <figure className="my-5">
      <div className="flex items-center justify-between border border-b-0 border-[var(--kat-line)] bg-[var(--kat-ink)] px-3 py-1.5">
        <figcaption className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[var(--kat-paper)]/55">
          {label ?? language}
        </figcaption>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-[var(--kat-paper)]/70 transition hover:text-[var(--kat-sun)]"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto border border-[var(--kat-line)] bg-[var(--kat-ink)] px-4 py-3.5">
        <code className="font-mono text-[0.78rem] leading-relaxed text-[var(--kat-paper)]">
          {code}
        </code>
      </pre>
    </figure>
  );
}
