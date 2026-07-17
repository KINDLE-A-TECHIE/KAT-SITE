"use client";

import { getLevel } from "@/lib/network-lab/levels";
import { NetworkLabGame } from "./network-lab-game";

/**
 * The Network Lab as a lesson content block, mounted by the lesson viewer from the NETWORK_LAB
 * content type, the same way CODE_PLAYGROUND mounts CodePlaygroundBlock. `levelKey` is the level
 * chosen at authoring time (stored in LessonContent.body). On win it calls the lesson's existing
 * complete action (`onComplete`), which upserts LessonProgress through the normal routes; it does
 * NOT add a completion route or emit anything itself.
 *
 * DRAFT PERSISTENCE is intentionally NOT wired here. A student's saved launchers belong in the
 * shared server-side LessonBlockDraft store introduced by the code-playground refactor (see
 * src/lib/network-lab/CLAUDE.md). That store does not exist yet, and the rule is: no lab-only table
 * and no lab-only localStorage. Until it lands, drafts live in the game's session state only.
 */
export function NetworkLabBlock({
  levelKey,
  onComplete,
}: {
  levelKey: string;
  onComplete?: () => void;
}) {
  const level = getLevel(levelKey);

  if (!level) {
    return (
      <p className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-900">
        This activity is not set up correctly (unknown level &ldquo;{levelKey}&rdquo;). Ask your
        teacher.
      </p>
    );
  }

  return <NetworkLabGame level={level} onWin={onComplete} />;
}
