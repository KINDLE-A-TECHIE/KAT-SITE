import { Brain, Code2, Compass, Flame, Layers3, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURES } from "../landing-tokens";

const ICON_MAP = { Code2, Shield, Layers3, Brain, Flame, Compass };

export function FeaturesSection() {
  return (
    <section id="features" className="kat-page kat-defer pb-16 sm:pb-20">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--kat-primary-blue)]">Features</p>
        <h2 className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-bold text-[var(--kat-text-primary)] sm:text-[2.5rem]">
          Your child won&apos;t just learn to code —{" "}
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--kat-gradient)" }}>
            they&apos;ll become a builder
          </span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[var(--kat-text-secondary)]">
          Every feature is designed so kids stay engaged, parents stay informed, and real skills actually stick.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => {
          const Icon = ICON_MAP[feature.iconName];
          return (
            <div
              key={feature.title}
              className="group rounded-2xl border border-[var(--kat-border)] bg-white p-6 shadow-[0_4px_20px_-8px_rgba(19,43,94,0.1)] transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_16px_40px_-12px_rgba(19,43,94,0.18)]"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className={cn("inline-flex rounded-xl p-2.5 text-white", feature.color)}>
                  <Icon className="size-5" />
                </div>
                <span className="[font-family:var(--font-space-grotesk)] text-sm font-bold text-slate-200">
                  0{index + 1}
                </span>
              </div>
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-[var(--kat-text-primary)]">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--kat-text-secondary)]">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
