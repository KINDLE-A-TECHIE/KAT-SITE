import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRICING_TIERS, STAMP_CTA } from "../landing-tokens";

export function PricingSection() {
  return (
    <section id="pricing" className="kat-page kat-defer py-16 sm:py-24">
      <div className="max-w-2xl border-l-2 border-[var(--kat-clay)] pl-5">
        <p className="kat-eyebrow">Pricing</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[var(--kat-ink)] sm:text-[2.5rem]">
          Billed monthly. Cancel whenever.
        </h2>
        <p className="mt-4 font-body leading-relaxed text-[var(--kat-muted)]">
          Register to see your track&apos;s price. Scholarship spots open every cohort,
          apply and tell us you need support.
        </p>
      </div>

      <div className="mt-12 grid border-t border-[var(--kat-border)] sm:grid-cols-3">
        {PRICING_TIERS.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              "relative flex flex-col border-b border-[var(--kat-border)] p-6 sm:border-r sm:last:border-r-0",
              // The highlighted tier is marked by a solid ground, not a shadow, a
              // badge and a coloured border all at once.
              tier.highlight && "bg-[var(--kat-raised)]",
            )}
          >
            {tier.highlight && (
              <span className="absolute right-6 top-6 font-mono text-[0.7rem] uppercase tracking-widest text-[var(--kat-clay)]">
                Most chosen
              </span>
            )}

            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[var(--kat-muted)]">
              {tier.ages}
            </p>
            <h3 className="mt-2 font-display text-xl font-bold text-[var(--kat-ink)]">
              {tier.label}
            </h3>
            <p className="mt-4 font-body text-sm font-medium text-[var(--kat-ink)]">
              {tier.monthlyLabel}
            </p>
            <p className="mt-0.5 font-mono text-[0.7rem] uppercase tracking-wider text-[var(--kat-muted)]">
              {tier.billingNote}
            </p>

            <ul className="mt-6 flex-1 space-y-2.5">
              {tier.includes.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 font-body text-sm leading-relaxed text-[var(--kat-muted)]"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--kat-pine)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>

            <Button
              asChild
              className={
                tier.highlight
                  ? cn("mt-7 w-full", STAMP_CTA)
                  : "mt-7 w-full rounded-none border border-[var(--kat-ink)]/25 bg-transparent font-semibold text-[var(--kat-ink)] hover:bg-[var(--kat-ink)] hover:text-[var(--kat-paper)]"
              }
              variant={tier.highlight ? "default" : "outline"}
            >
              <Link href="/register">{tier.cta}</Link>
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-start gap-3 border-l-2 border-[var(--kat-pine)] bg-[var(--kat-raised)] px-5 py-4">
        <p className="font-body text-sm leading-relaxed text-[var(--kat-muted)]">
          <span className="font-semibold text-[var(--kat-ink)]">
            Scholarship spots open every cohort.
          </span>{" "}
          If cost is the only thing standing between your child and this, tell us. We
          read every application.
        </p>
      </div>
    </section>
  );
}
