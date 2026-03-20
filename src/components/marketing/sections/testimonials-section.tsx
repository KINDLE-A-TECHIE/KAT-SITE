import { Star } from "lucide-react";
import { TESTIMONIALS } from "../landing-tokens";

export function TestimonialsSection() {
  return (
    <section className="kat-page kat-defer pb-16 sm:pb-20">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--kat-primary-blue)]">
          Testimonials
        </p>
        <h2 className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-bold text-[var(--kat-text-primary)] sm:text-4xl">
          Real kids. Real results. Real parents.
        </h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="flex flex-col rounded-2xl border border-[var(--kat-border)] bg-white p-6 shadow-[0_4px_20px_-8px_rgba(19,43,94,0.08)]"
          >
            <div className="mb-3 flex gap-0.5">
              {Array.from({ length: t.stars }).map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="flex-1 text-sm leading-relaxed text-[var(--kat-text-secondary)]">
              &ldquo;{t.quote}&rdquo;
            </p>
            <div className="mt-5 flex items-center gap-3 border-t border-[var(--kat-border)] pt-4">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: "var(--kat-gradient)" }}
              >
                {t.initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--kat-text-primary)]">{t.name}</p>
                <p className="text-xs text-[var(--kat-text-secondary)]">{t.role}</p>
                <p className="text-xs text-[var(--kat-text-secondary)] opacity-70">{t.location}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
