"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodePlaygroundBlock } from "@/components/dashboard/code-playground-block";
import { BlocklyBlock } from "@/components/dashboard/blockly-block";
import { NetworkLabBlock } from "@/components/network-lab/network-lab-block";
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

  // Route interactive-block draft sync to the embed endpoints for the life of this frame.
  useEffect(() => {
    setDraftEmbedMode(true);
    return () => setDraftEmbedMode(false);
  }, []);

  const complete = async () => {
    setBusy(true);
    const res = await fetch("/api/school/embed/complete", {
      method: "POST",
      // application/json cannot be sent by a cross-site HTML form, so this alone forces a preflight
      // for any cross-origin caller, a second lock behind assertEmbedOrigin on the server.
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, schoolSlug }),
    });
    setBusy(false);
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(payload.error ?? "Could not save your progress.");
      return;
    }
    setDone(true);
    toast.success("Nice work, lesson complete.");
  };

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
                <CodePlaygroundBlock contentId={c.id} starterCode={c.body ?? ""} language={c.language ?? "python"} userId={userId} embed />
              </div>
            ) : null}

            {c.type === "NETWORK_LAB" && c.body ? (
              <div className="mt-2">
                <NetworkLabBlock levelKey={c.body} contentId={c.id} />
              </div>
            ) : null}

            {c.type === "BLOCKLY" ? (
              <div className="mt-2">
                <BlocklyBlock contentId={c.id} body={c.body} />
              </div>
            ) : null}

            {/* Scratch is deliberately NOT run in the embed: it is a cross-origin editor iframe and a
                child's Scratch work should not be saved through a page we do not control. */}
            {c.type === "SCRATCH" ? (
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                This Scratch activity is not available in the embedded view. Open it from your school&apos;s learning app.
              </p>
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
            onClick={complete}
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
