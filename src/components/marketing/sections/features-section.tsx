import { Brain, Code2, Compass, Flame, Layers3, Shield } from "lucide-react";
import { FEATURES } from "../landing-tokens";

const ICON_MAP = { Code2, Shield, Layers3, Brain, Flame, Compass };

export function FeaturesSection() {
  return (
    <section id="features" className="kat-page kat-defer py-16 sm:py-24">
      <div className="max-w-2xl border-l-2 border-[var(--kat-clay)] pl-5">
        <p className="kat-eyebrow">What they get</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[var(--kat-ink)] sm:text-[2.5rem]">
          Not a course library. A workshop with a mentor in it.
        </h2>
      </div>

      {/*
       * A rule-divided grid, not six floating cards with six different icon colours.
       * The borders collapse into a single hairline lattice, which is why the negative
       * margins and -mt/-ml offsets are here rather than a gap.
       */}
      <div className="mt-12 grid border-t border-[var(--kat-border)] sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = ICON_MAP[feature.iconName];
          return (
            <div
              key={feature.title}
              className="group border-b border-[var(--kat-border)] p-6 transition-colors hover:bg-[var(--kat-raised)] sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0"
            >
              <Icon
                className="size-5 text-[var(--kat-muted)] transition-colors group-hover:text-[var(--kat-clay)]"
                aria-hidden
              />
              <h3 className="mt-4 font-display text-lg font-semibold text-[var(--kat-ink)]">
                {feature.title}
              </h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-[var(--kat-muted)]">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
