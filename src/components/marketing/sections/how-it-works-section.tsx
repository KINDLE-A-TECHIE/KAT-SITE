import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOW_IT_WORKS, STAMP_CTA_DARK } from "../landing-tokens";

/*
 * The ONE place the 01/02/03 device is used. It was previously repeated on the feature
 * cards too, which turned an editorial motif into decoration. Numbering a sequence is
 * meaningful; numbering an unordered grid is not.
 */
export function HowItWorksSection() {
  return (
    <section className="kat-defer bg-[var(--kat-ink)] py-16 text-[var(--kat-paper)] sm:py-24">
      <div className="kat-page">
        <div className="max-w-2xl border-l-2 border-[var(--kat-sun)] pl-5">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-[var(--kat-sun)]">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-[2.5rem]">
            From sign-up to their first shipped project, in a week.
          </h2>
        </div>

        <div className="mt-12 grid gap-px border-t border-white/15 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="border-b border-white/15 py-8 sm:border-r sm:pr-6 sm:last:border-r-0 sm:[&:not(:first-child)]:pl-6">
              <span className="font-mono text-sm font-medium tracking-[0.22em] text-[var(--kat-sun)]">
                {step.step}
              </span>
              <h3 className="mt-4 font-display text-xl font-bold">{step.title}</h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-[var(--kat-paper)]/70">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Button
            asChild
            size="lg"
            className={`gap-2 px-8 ${STAMP_CTA_DARK}`}
          >
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
