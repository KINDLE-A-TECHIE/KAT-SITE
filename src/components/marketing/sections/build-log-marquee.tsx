import type { Build } from "../landing-tokens";

// BUILD LOG, the signature element. Real, APPROVED student builds only (passed
// in from the DB). No placeholder data: if there are none, the band doesn't render,
// so nothing invented is ever shown. Under prefers-reduced-motion it becomes static.

function LogRow({ builds }: { builds: Build[] }) {
  return (
    <>
      {builds.map((b, i) => (
        <span key={`${b.id}-${i}`} className="flex items-center gap-4 whitespace-nowrap px-6">
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--kat-sun)]">
            {String(i + 1).padStart(2, "0")}
          </span>
          {/* Real project thumbnail when the build has a cover image. Kept small so the
              oversized display type stays the signature; no image = pure type, as before. */}
          {b.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.imageUrl}
              alt=""
              aria-hidden
              className="h-9 w-9 shrink-0 rounded-sm border border-white/15 object-cover sm:h-11 sm:w-11"
              loading="lazy"
            />
          ) : null}
          <span className="font-display text-2xl font-bold text-[var(--kat-paper)] sm:text-3xl">
            {b.firstName}
            {b.program ? (
              <span className="font-mono text-sm font-medium text-white/50"> · {b.program}</span>
            ) : null}
            <span className="font-serif italic text-[var(--kat-paper)]/85"> shipped {b.title}</span>
          </span>
          <span aria-hidden className="text-[var(--kat-clay)]">◆</span>
        </span>
      ))}
    </>
  );
}

export function BuildLogMarquee({ builds }: { builds: Build[] }) {
  if (builds.length === 0) return null;

  return (
    <section
      aria-label="Recent projects shipped by KAT students"
      className="relative w-full overflow-hidden border-y-2 border-[var(--kat-clay)] bg-[var(--kat-ink)]"
    >
      <div className="kat-page flex items-center gap-3 pt-5">
        <span className="h-2 w-2 rounded-full bg-[var(--kat-clay)]" />
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/55">
          // build log, real things KAT kids shipped
        </p>
      </div>

      {/* Scrolling track: content duplicated so translateX(-50%) loops seamlessly.
          motion-reduce collapses it to a static wrapped list. */}
      <div className="group py-6 motion-reduce:py-4">
        <div className="flex w-max animate-marquee items-center motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-start motion-reduce:gap-y-4">
          <div className="flex items-center motion-reduce:flex-wrap motion-reduce:gap-y-4">
            <LogRow builds={builds} />
          </div>
          <div className="flex items-center motion-reduce:hidden" aria-hidden>
            <LogRow builds={builds} />
          </div>
        </div>
      </div>
    </section>
  );
}
