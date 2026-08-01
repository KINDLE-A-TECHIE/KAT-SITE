"use client";

import { useEffect, useRef, useState } from "react";
import { getLevel } from "@/lib/network-lab/levels";
import { getDraft, putDraft } from "@/lib/lesson-block-draft";
import { NetworkLabGame } from "./network-lab-game";
import type { PacketDraft } from "./packet-editor";

/**
 * The Network Lab as a lesson content block, mounted by the lesson viewer from the NETWORK_LAB
 * content type, the same way CODE_PLAYGROUND mounts CodePlaygroundBlock. `levelKey` is the level
 * chosen at authoring time (stored in LessonContent.body). On win it calls the lesson's existing
 * complete action (`onComplete`), which upserts LessonProgress through the normal routes.
 *
 * DRAFT PERSISTENCE uses the shared server-side LessonBlockDraft store (NOT a lab-only table or
 * localStorage): the student's in-progress packet form is loaded on mount and debounce-saved on edit,
 * scoped server-side to their own userId. We hold the game's mount until the draft has loaded so the
 * editor initialises straight from it.
 */
export function NetworkLabBlock({
  levelKey,
  contentId,
  onComplete,
}: {
  levelKey: string;
  contentId: string;
  onComplete?: () => void;
}) {
  const level = getLevel(levelKey);

  const [initialDraft, setInitialDraft] = useState<PacketDraft | null>(null);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = await getDraft<PacketDraft>(contentId);
      if (cancelled) return;
      setInitialDraft(draft);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [contentId]);

  const onDraftChange = (draft: PacketDraft) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void putDraft(contentId, draft), 800);
  };

  if (!level) {
    return (
      <p className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-900">
        This activity is not set up correctly (unknown level &ldquo;{levelKey}&rdquo;). Ask your
        teacher.
      </p>
    );
  }

  // Brief hold so PacketEditor seeds its form from the saved draft rather than the defaults.
  if (!ready) {
    return (
      <div className="h-40 animate-pulse rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900" />
    );
  }

  return (
    <NetworkLabGame
      level={level}
      onWin={onComplete}
      initialDraft={initialDraft}
      onDraftChange={onDraftChange}
    />
  );
}
