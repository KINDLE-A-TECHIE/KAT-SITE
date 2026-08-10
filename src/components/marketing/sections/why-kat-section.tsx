import Link from "next/link";
import { ArrowRight, Brain, Code2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOW_IT_WORKS, STAMP_CTA_DARK, WHY_KAT } from "../landing-tokens";

const ICON_MAP = { Code2, Shield, Brain };

/*
 * WHY KAT, one ink section that used to be two (the six-card Features grid and the dark How-It-Works
 * band). A landing page should say "what makes this different" and "how do I start" once each, not
 * spread them across four sections. So this holds the three real differentiators up top, then the
 * three-step path to a first shipped project below the same rule.
 */
export function WhyKatSection() {
  return (
    <section id="why" className="kat-defer bg-[var(--kat-ink)] py-16 text-[var(--kat-paper)] sm:py-24">
      <div className="kat-page">
        {/* ── Why: the three differentiators ─────────────────────────────────── */}
        <div className="max-w-2xl border-l-2 border-[var(--kat-sun)] pl-5">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-[var(--kat-sun)]">
            Why KAT
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-[2.5rem]">
            A workshop with a mentor in it, not a course library.
          </h2>
        </div>

        <div className="mt-12 grid gap-px border-t border-white/15 sm:grid-cols-3">
          {WHY_KAT.map((item) => {
            const Icon = ICON_MAP[item.iconName];
            return (
              <div key={item.title} className="border-b border-white/15 py-8 sm:border-r sm:pr-6 sm:last:border-r-0 sm:[&:not(:first-child)]:pl-6">
                <Icon className="size-5 text-[var(--kat-sun)]" aria-hidden />
                <h3 className="mt-4 font-display text-xl font-bold">{item.title}</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-[var(--kat-paper)]/70">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* ── How: the three-step path ───────────────────────────────────────── */}
        <div className="mt-16 max-w-2xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-[var(--kat-sun)]">
            How it works
          </p>
          <h3 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">
            From sign-up to their first shipped project, in a week.
          </h3>
        </div>

        <div className="mt-10 grid gap-px border-t border-white/15 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="border-b border-white/15 py-8 sm:border-r sm:pr-6 sm:last:border-r-0 sm:[&:not(:first-child)]:pl-6">
              <span className="font-mono text-sm font-medium tracking-[0.22em] text-[var(--kat-sun)]">
                {step.step}
              </span>
              <h4 className="mt-4 font-display text-lg font-bold">{step.title}</h4>
              <p className="mt-2 font-body text-sm leading-relaxed text-[var(--kat-paper)]/70">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Button asChild size="lg" className={`gap-2 px-8 ${STAMP_CTA_DARK}`}>
            <Link href="/register">
              Start your child&apos;s first module
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
