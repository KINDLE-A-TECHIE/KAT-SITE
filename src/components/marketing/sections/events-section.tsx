import { Rocket, Trophy, School } from "lucide-react";
import { EVENTS } from "../landing-tokens";

const ICON_MAP = { Rocket, Trophy, School };

export function EventsSection() {
  return (
    <section className="kat-page kat-defer py-16 sm:py-24">
      <div className="max-w-2xl border-l-2 border-[var(--kat-clay)] pl-5">
        <p className="kat-eyebrow">Beyond the screen</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[var(--kat-ink)] sm:text-[2.5rem]">
          Bootcamps, hackathons, and coding clubs inside schools.
        </h2>
        <p className="mt-4 font-body leading-relaxed text-[var(--kat-muted)]">
          Core learning happens online. These run physically, virtually, or hybrid,
          depending on the partner and the city.
        </p>
      </div>

      <div className="mt-12 grid border-t border-[var(--kat-border)] sm:grid-cols-3">
        {EVENTS.map((event) => {
          const Icon = ICON_MAP[event.iconName];
          return (
            <div
              key={event.title}
              className="group border-b border-[var(--kat-border)] p-6 transition-colors hover:bg-[var(--kat-raised)] sm:border-r sm:last:border-r-0"
            >
              <Icon
                className="size-5 text-[var(--kat-muted)] transition-colors group-hover:text-[var(--kat-clay)]"
                aria-hidden
              />
              <h3 className="mt-4 font-display text-lg font-semibold text-[var(--kat-ink)]">
                {event.title}
              </h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-[var(--kat-muted)]">
                {event.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {event.modes.map((mode) => (
                  <span
                    key={mode}
                    className="rounded-full border border-[var(--kat-border)] px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider text-[var(--kat-muted)]"
                  >
                    {mode}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
