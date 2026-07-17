import { NetworkLabGame } from "@/components/network-lab/network-lab-game";
import { getLevelById } from "@/lib/network-lab/levels";

/**
 * THROWAWAY Phase 0 preview. This exists only to eyeball a level's topology while the engine and UI
 * are built out. It is NOT the real mount point: Network Lab ships as a `NETWORK_LAB` lesson content
 * block rendered inside the lesson viewer (see src/lib/network-lab/CLAUDE.md), not as a page of its
 * own. Delete this route once the block renders inside a lesson.
 */
export const metadata = { title: "Network Lab preview (dev)" };

export default function NetworkLabPreviewPage() {
  const level = getLevelById(1);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--kat-clay)]">
        network lab · phase 0 preview
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-stone-900 dark:text-stone-100">
        {level ? `Level ${level.id} · ${level.unit}` : "Level not found"}
      </h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Playable: build a packet and launch it. Dev-only route, not the real mount.
      </p>

      <div className="mt-6">
        {level ? (
          <NetworkLabGame level={level} />
        ) : (
          <p className="text-sm text-stone-500">levels.json has no level with id 1.</p>
        )}
      </div>
    </main>
  );
}
