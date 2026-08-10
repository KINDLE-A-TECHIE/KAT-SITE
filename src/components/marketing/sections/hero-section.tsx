import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAMP_CTA, type Build } from "../landing-tokens";

type HeroSectionProps = {
  enrollments: number;
  passRate: number;
  builds: Build[];
};

/*
 * The right-hand artifact. This used to be a mock student dashboard: fabricated
 * progress bars, an invented "Python Mission Lab", a fake next-class alert. It was a
 * picture of software, which is the least interesting thing we do.
 *
 * It is now the most recent REAL approved build, presented as a maker's manifest.
 * When nothing is approved yet it shows a non-attributed empty state, never an
 * invented name.
 */
function BuildArtifact({ build }: { build: Build | undefined }) {
  return (
    <div className="relative">
      <div className="rounded-tl-2xl rounded-br-2xl border border-[var(--kat-ink)]/15 bg-[var(--kat-raised)] shadow-kat">
        <div className="flex items-center justify-between border-b border-[var(--kat-border)] px-5 py-3">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-[var(--kat-muted)]">
            Latest build
          </span>
          {build ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-widest text-[var(--kat-pine)]">
              <span className="size-1.5 rounded-full bg-[var(--kat-pine)]" aria-hidden />
              Approved
            </span>
          ) : null}
        </div>

        {build ? (
          <dl className="divide-y divide-[var(--kat-border)]">
            {/* Real cover image of the shipped project when the student uploaded one.
                No image = the text manifest still stands on its own (no placeholder). */}
            {build.imageUrl ? (
              <div className="aspect-[16/10] overflow-hidden bg-[var(--kat-paper)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={build.imageUrl}
                  alt={`${build.title}, a project shipped by ${build.firstName}`}
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
            ) : null}
            <div className="px-5 py-5">
              <dt className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[var(--kat-muted)]">
                Project
              </dt>
              <dd className="mt-1.5 font-display text-2xl font-bold leading-tight text-[var(--kat-ink)]">
                {build.title}
              </dd>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[var(--kat-border)]">
              <div className="px-5 py-4">
                <dt className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[var(--kat-muted)]">
                  Builder
                </dt>
                <dd className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-[var(--kat-clay)]">
                  {/* The builder's photo appears only with recorded consent (see getRealBuilds).
                      No photo = just the first name, never a placeholder face. */}
                  {build.builderPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={build.builderPhotoUrl}
                      alt={build.firstName}
                      className="size-7 shrink-0 rounded-full object-cover ring-1 ring-[var(--kat-ink)]/15"
                      loading="lazy"
                    />
                  ) : null}
                  {build.firstName}
                </dd>
              </div>
              <div className="px-5 py-4">
                <dt className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[var(--kat-muted)]">
                  Track
                </dt>
                <dd className="mt-1 font-display text-lg font-semibold text-[var(--kat-ink)]">
                  {build.program ?? "KAT"}
                </dd>
              </div>
            </div>
          </dl>
        ) : (
          <div className="px-5 py-10">
            <p className="font-display text-2xl font-bold leading-tight text-[var(--kat-ink)]">
              Real builds ship here.
            </p>
            <p className="mt-2 max-w-xs font-body text-sm leading-relaxed text-[var(--kat-muted)]">
              Every project on this page is made by a KAT student and approved by their
              mentor. Nothing here is a mock-up, so this space stays empty until the next
              one lands.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function HeroSection({ enrollments, passRate, builds }: HeroSectionProps) {
  const displayEnrollments =
    enrollments >= 1000
      ? `${(enrollments / 1000).toFixed(1).replace(/\.0$/, "")}k+`
      : `${enrollments}+`;

  return (
    <section className="kat-page pb-14 pt-14 sm:pt-20">
      {/* Asymmetric, not centred-hero-with-stat-row. Content left, evidence right. */}
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.85fr] lg:items-center">
        <div>
          {/* The left rule + mono label is the page's structural motif. */}
          <div className="border-l-2 border-[var(--kat-clay)] pl-5">
            <p className="kat-eyebrow">Ages 8&ndash;19 · Across Africa</p>
            <h1 className="mt-4 font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight text-[var(--kat-ink)] sm:text-5xl lg:text-[3.6rem]">
              Kids who build real things
              <span className="text-[var(--kat-clay)]">.</span>
            </h1>
          </div>

          <p className="mt-6 max-w-lg font-body text-[1.1rem] leading-relaxed text-[var(--kat-muted)]">
            KAT teaches coding, robotics, AI, design and game development through live
            1-on-1 mentorship. Your child doesn&apos;t watch videos, they ship a project
            every module, and you can see every one of them.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Button
              asChild
              size="lg"
              className={`gap-2 px-7 ${STAMP_CTA}`}
            >
              <Link href="/register">
                Enroll your child
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            {/* Solid + text link, not the ghost/solid button pair every SaaS page ships. */}
            <Link
              href="#tracks"
              className="kat-focus-ring rounded text-sm font-semibold text-[var(--kat-ink)] underline decoration-[var(--kat-clay)] decoration-2 underline-offset-[6px] hover:text-[var(--kat-clay)]"
            >
              See the three tracks
            </Link>
          </div>

          {/* The numbers live here, once. There is no second stat bar below the fold. */}
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-[var(--kat-border)] pt-6">
            <div>
              <dt className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[var(--kat-muted)]">
                Students
              </dt>
              <dd className="mt-0.5 font-display text-2xl font-bold text-[var(--kat-ink)]">
                {displayEnrollments}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[var(--kat-muted)]">
                Pass rate
              </dt>
              <dd className="mt-0.5 font-display text-2xl font-bold text-[var(--kat-ink)]">
                {passRate}%
              </dd>
            </div>
          </dl>
        </div>

        <BuildArtifact build={builds[0]} />
      </div>
    </section>
  );
}
