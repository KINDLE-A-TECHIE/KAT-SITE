import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOW_IT_WORKS } from "../landing-tokens";

export function HowItWorksSection() {
  return (
    <section
      className="kat-defer py-16 sm:py-20"
      style={{ background: "linear-gradient(135deg, #0D1F45 0%, #132B5E 45%, #1E5FAF 100%)" }}
    >
      <div className="kat-page">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">How It Works</p>
          <h2 className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-bold text-white sm:text-4xl">
            From sign-up to their first live project — in one week
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <div
              key={step.step}
              className="relative rounded-2xl p-6"
              style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 text-white/25 sm:block">
                  <ArrowRight className="size-5" />
                </div>
              )}
              <div className="mb-4 [font-family:var(--font-space-grotesk)] text-5xl font-bold text-white/15">
                {step.step}
              </div>
              <h3 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-blue-200">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button
            asChild
            size="lg"
            className="rounded-xl bg-white px-8 font-semibold text-[var(--kat-primary-blue)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] hover:bg-slate-100"
          >
            <Link href="/register">
              Start Your Journey
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
