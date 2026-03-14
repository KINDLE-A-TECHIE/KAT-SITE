import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRICING_TIERS } from "../landing-tokens";

export function PricingSection() {
  return (
    <section id="pricing" className="kat-page kat-defer pb-16 sm:pb-20">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--kat-primary-blue)]">Pricing</p>
        <h2 className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-bold text-[var(--kat-text-primary)] sm:text-4xl">
          Transparent, per-track enrollment
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[var(--kat-text-secondary)]">
          Each track is billed monthly. Parents register, select a cohort, and complete payment to
          activate their child&apos;s access. Scholarships are available.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {PRICING_TIERS.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-white p-6 shadow-[0_4px_20px_-8px_rgba(19,43,94,0.1)]",
              tier.highlight
                ? "border-[var(--kat-primary-blue)] shadow-[0_16px_48px_-12px_rgba(30,95,175,0.25)]"
                : "border-[var(--kat-border)]",
            )}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge
                  className="border-0 px-3 py-0.5 text-xs font-semibold text-white"
                  style={{ background: "var(--kat-gradient)" }}
                >
                  Most Popular
                </Badge>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kat-primary-blue)]">
                {tier.ages}
              </p>
              <h3 className="mt-1 [font-family:var(--font-space-grotesk)] text-xl font-bold text-[var(--kat-text-primary)]">
                {tier.label}
              </h3>
              <p className="mt-3 text-sm font-medium text-[var(--kat-text-secondary)]">
                {tier.monthlyLabel}
              </p>
              <p className="mt-0.5 text-xs text-[var(--kat-text-secondary)]">{tier.billingNote}</p>
            </div>

            <ul className="mt-5 flex-1 space-y-2.5">
              {tier.includes.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--kat-text-secondary)]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--kat-success)]" />
                  {item}
                </li>
              ))}
            </ul>

            <Button
              asChild
              className={cn(
                "mt-6 w-full rounded-xl font-semibold",
                tier.highlight
                  ? "text-white shadow-[0_4px_14px_-4px_rgba(30,95,175,0.5)]"
                  : "border border-[var(--kat-border)] bg-white text-[var(--kat-primary-blue)] hover:bg-blue-50",
              )}
              style={tier.highlight ? { background: "var(--kat-gradient)" } : {}}
              variant={tier.highlight ? "default" : "outline"}
            >
              <Link href="/register">{tier.cta}</Link>
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
        <p className="text-sm font-semibold text-emerald-800">
          Scholarship spots available every cohort
        </p>
        <p className="mt-1 text-sm text-emerald-700">
          Need financial support? Join the waitlist and mention scholarships — we review every application.
        </p>
      </div>
    </section>
  );
}
