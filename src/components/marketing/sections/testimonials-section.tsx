import { Star } from "lucide-react";

type DbTestimonial = {
  id: string;
  quote: string;
  rating: number;
  childName: string | null;
  author: { firstName: string; lastName: string; profile: { avatarUrl: string | null } | null };
};

type TestimonialsSectionProps = {
  testimonials?: DbTestimonial[];
};

/*
 * Real APPROVED testimonials only. The static fallback array this used to fall back to
 * (invented parents, invented cities) is deleted. If the DB has none, the section does
 * not render at all, an honest gap beats a fabricated endorsement on a page asking
 * parents to trust us with their children.
 */
export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <section className="kat-page kat-defer py-16 sm:py-24">
      <div className="max-w-2xl border-l-2 border-[var(--kat-clay)] pl-5">
        <p className="kat-eyebrow">From parents</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[var(--kat-ink)] sm:text-[2.5rem]">
          What families actually say.
        </h2>
      </div>

      <div className="mt-12 grid border-t border-[var(--kat-border)] sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => {
          const fullName = `${t.author.firstName} ${t.author.lastName}`;
          const initials =
            `${t.author.firstName.charAt(0)}${t.author.lastName.charAt(0)}`.toUpperCase();

          return (
            <figure
              key={t.id}
              className="flex flex-col border-b border-[var(--kat-border)] p-6 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0"
            >
              <div className="flex gap-0.5" aria-label={`${t.rating} out of 5`}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-3.5 fill-[var(--kat-sun)] text-[var(--kat-sun)]"
                    aria-hidden
                  />
                ))}
              </div>

              <blockquote className="mt-4 flex-1 font-body text-[0.95rem] leading-relaxed text-[var(--kat-ink)]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <figcaption className="mt-6 flex items-center gap-3">
                {t.author.profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.author.profile.avatarUrl}
                    alt=""
                    className="size-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--kat-clay)] font-mono text-xs font-bold text-[var(--kat-paper)]"
                    aria-hidden
                  >
                    {initials}
                  </div>
                )}
                <div>
                  <p className="font-display text-sm font-semibold text-[var(--kat-ink)]">
                    {fullName}
                  </p>
                  {t.childName && (
                    <p className="font-mono text-[0.7rem] uppercase tracking-wider text-[var(--kat-muted)]">
                      Parent of {t.childName}
                    </p>
                  )}
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
