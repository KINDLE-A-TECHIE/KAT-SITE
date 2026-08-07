"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodePlaygroundBlock } from "@/components/dashboard/code-playground-block";
import { BlocklyBlock } from "@/components/dashboard/blockly-block";
import { NetworkLabBlock } from "@/components/network-lab/network-lab-block";
import { ScratchBlock } from "@/components/dashboard/scratch-block";
import { setDraftEmbedMode } from "@/lib/lesson-block-draft";

type Content = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  language: string | null;
};

/**
 * Lesson content inside the frame, plus the one mutation the embed allows.
 *
 * Rich text is rendered with textContent semantics (React escapes by default and we never use
 * dangerouslySetInnerHTML here), content is authored by instructors, but an iframe on a third
 * party's page is the last place to start trusting HTML.
 */
export function EmbedLessonBody({
  schoolSlug,
  lessonId,
  contents,
  completed,
  userId,
}: {
  schoolSlug: string;
  lessonId: string;
  contents: Content[];
  completed: boolean;
  userId: string;
}) {
  const [done, setDone] = useState(completed);
  const [busy, setBusy] = useState(false);
  const doneRef = useRef(completed);

  // Route interactive-block draft sync to the embed endpoints for the life of this frame.
  useEffect(() => {
    setDraftEmbedMode(true);
    return () => setDraftEmbedMode(false);
  }, []);

  // Mark this lesson complete. `silent` is used when an interactive block auto-completes it (participation),
  // so a background completion never toasts or flips the button to busy; the explicit button is loud.
  const markComplete = useCallback(
    async (silent: boolean) => {
      if (doneRef.current) return;
      if (!silent) setBusy(true);
      try {
        const res = await fetch("/api/school/embed/complete", {
          method: "POST",
          // application/json cannot be sent by a cross-site HTML form, so this alone forces a preflight
          // for any cross-origin caller, a second lock behind assertEmbedOrigin on the server.
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, schoolSlug }),
        });
        if (!res.ok) {
          if (!silent) {
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            toast.error(payload.error ?? "Could not save your progress.");
          }
          return;
        }
        doneRef.current = true;
        setDone(true);
        if (!silent) toast.success("Nice work, lesson complete.");
      } finally {
        if (!silent) setBusy(false);
      }
    },
    [lessonId, schoolSlug],
  );

  // Engaging with an interactive block marks the lesson complete (participation), matching the hosted app.
  const onBlockComplete = useCallback(() => {
    void markComplete(true);
  }, [markComplete]);

  return (
    <>
      <div className="mt-5 space-y-6">
        {contents.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Your teacher has not added anything to this lesson yet.
          </p>
        ) : null}

        {contents.map((c) => (
          <section key={c.id}>
            <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
              {c.title}
            </h2>

            {c.type === "RICH_TEXT" && c.body ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {c.body}
              </p>
            ) : null}

            {(c.type === "YOUTUBE_EMBED" || c.type === "EXTERNAL_VIDEO") && c.url ? (
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:underline"
              >
                <ExternalLink className="size-3.5" />
                Watch the video
              </a>
            ) : null}

            {c.type === "DOCUMENT_LINK" && c.url ? (
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:underline"
              >
                <ExternalLink className="size-3.5" />
                Open the worksheet
              </a>
            ) : null}

            {/* Interactive blocks run INSIDE the frame now (no dead "open the full editor" loop). They run
                in run-only mode: the pupil edits and runs, and the whole-lesson "Mark as complete" below is
                the one mutation the embed allows. Drafts persist locally in the frame. */}
            {c.type === "CODE_PLAYGROUND" ? (
              <div className="mt-2">
                <CodePlaygroundBlock contentId={c.id} starterCode={c.body ?? ""} language={c.language ?? "python"} userId={userId} onComplete={onBlockComplete} embed />
              </div>
            ) : null}

            {c.type === "NETWORK_LAB" && c.body ? (
              <div className="mt-2">
                <NetworkLabBlock levelKey={c.body} contentId={c.id} onComplete={onBlockComplete} />
              </div>
            ) : null}

            {c.type === "BLOCKLY" ? (
              <div className="mt-2">
                <BlocklyBlock contentId={c.id} body={c.body} onComplete={onBlockComplete} />
              </div>
            ) : null}

            {/* Scratch runs in the frame too. The editor is a cross-origin iframe, but the pupil's .sb3
                still saves to OUR private R2 (presigned, key-only) via the embed-authed routes, exactly as
                in-app; it is never saved into the page we do not control. */}
            {c.type === "SCRATCH" ? (
              <div className="mt-2">
                <ScratchBlock contentId={c.id} body={c.body} onComplete={onBlockComplete} embed />
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <div className="mt-8 border-t border-stone-200 pt-5 dark:border-stone-800">
        {done ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="size-4" />
            Lesson complete
          </p>
        ) : (
          <Button
            onClick={() => void markComplete(false)}
            disabled={busy}
            className="gap-1.5 bg-orange-700 text-white hover:bg-orange-800"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Mark as complete
          </Button>
        )}
      </div>
    </>
  );
}
