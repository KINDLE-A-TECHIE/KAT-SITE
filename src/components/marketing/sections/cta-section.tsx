import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAMP_CTA_DARK } from "../landing-tokens";

export function CtaSection() {
  return (
    <section className="kat-page kat-defer pb-20">
      {/* Flat ink panel. The three stacked blur-blobs that used to live in here were
          decoration standing in for a point of view. */}
      <div className="border-l-4 border-[var(--kat-clay)] bg-[var(--kat-ink)] px-8 py-14 sm:px-14 sm:py-20">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-[var(--kat-sun)]">
            Ready when they are
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-[1.1] text-[var(--kat-paper)] sm:text-[2.8rem]">
            Raise a builder, not a spectator.
          </h2>
          <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-[var(--kat-paper)]/70">
            From their first line of code to robotics, AI and design. Live mentors,
            real projects, and a parent dashboard that shows you all of it.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Button
              asChild
              size="lg"
              className={`gap-2 px-8 ${STAMP_CTA_DARK}`}
            >
              <Link href="/register">
                Enroll your child
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Link
              href="/login"
              className="kat-focus-ring rounded text-sm font-semibold text-[var(--kat-paper)] underline decoration-[var(--kat-sun)] decoration-2 underline-offset-[6px] hover:text-[var(--kat-sun)]"
            >
              Sign in to your dashboard
            </Link>
          </div>

          <p className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[var(--kat-paper)]/45">
            Parent-managed · Coding, robotics, AI, design, game dev · Live mentors
          </p>
        </div>
      </div>
    </section>
  );
}
