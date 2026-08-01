import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * StatLedger: the dashboard replacement for the icon-chip stat-card grid.
 * One flat container, entries divided by hairlines (the gap-px trick, so dividers
 * survive any wrap), small-caps label over a large mono numeral. No icons, no
 * tinted squares. Used by both the B2C dashboard and the school surface.
 *
 * Keep the entry count a multiple of the chosen column layout so rows stay full
 * (the divider background shows through any trailing gap otherwise).
 */

export type StatLedgerEntry = {
  label: string;
  /** Rendered in JetBrains Mono. Preformat units yourself ("142 / 200", "N45,000"). */
  value: string | number;
  hint?: string;
  href?: string;
};

const COLS: Record<2 | 3 | 4 | 6, string> = {
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
};

export function StatLedger({
  entries,
  columns = 4,
  className,
}: {
  entries: StatLedgerEntry[];
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 dark:border-stone-800 dark:bg-stone-800",
        COLS[columns],
        className,
      )}
    >
      {entries.map((entry) => {
        const cell = (
          <div
            className={cn(
              "h-full bg-white p-4 dark:bg-stone-900 sm:p-5",
              entry.href && "transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60",
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">
              {entry.label}
            </p>
            <p className="mt-1.5 font-mono text-2xl font-medium tabular-nums text-stone-900 dark:text-stone-100">
              {entry.value}
            </p>
            {entry.hint ? (
              <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">{entry.hint}</p>
            ) : null}
          </div>
        );
        return entry.href ? (
          <Link key={entry.label} href={entry.href} className="h-full">
            {cell}
          </Link>
        ) : (
          <div key={entry.label} className="h-full">
            {cell}
          </div>
        );
      })}
    </div>
  );
}

/**
 * StatusDot: text + a small colored dot instead of a pastel badge pill.
 * The dot carries the color; the text stays neutral ink, which keeps status
 * rows calm even when many appear together.
 */
const DOT_TONE = {
  pine: "bg-[var(--kat-pine)]",
  sun: "bg-[var(--kat-sun)]",
  clay: "bg-[var(--kat-clay)]",
  muted: "bg-stone-400 dark:bg-stone-500",
} as const;

export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: keyof typeof DOT_TONE;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-600 dark:text-stone-300",
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT_TONE[tone])} />
      {label}
    </span>
  );
}
