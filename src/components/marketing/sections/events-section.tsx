import { Rocket, Trophy, School } from "lucide-react";
import { EVENTS } from "../landing-tokens";

const ICON_MAP = { Rocket, Trophy, School };

const MODE_STYLES: Record<string, string> = {
  Physical: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Virtual: "bg-blue-50 text-blue-700 border-blue-200",
  Hybrid: "bg-violet-50 text-violet-700 border-violet-200",
};

export function EventsSection() {
  return (
    <section className="kat-page kat-defer pb-16 sm:pb-20">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--kat-primary-blue)]">
          Beyond the Classroom
        </p>
        <h2 className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-bold text-[var(--kat-text-primary)] sm:text-[2.5rem]">
          Learning that goes{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--kat-gradient)" }}
          >
            beyond the screen
          </span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[var(--kat-text-secondary)]">
          While core learning happens online, KAT runs bootcamps, hackathons, and school
          programmes that can be delivered physically, virtually, or in a hybrid format.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {EVENTS.map((event) => {
          const Icon = ICON_MAP[event.iconName];
          return (
            <div
              key={event.title}
              className="group rounded-2xl border border-[var(--kat-border)] bg-white p-6 shadow-[0_4px_20px_-8px_rgba(19,43,94,0.1)] transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_16px_40px_-12px_rgba(19,43,94,0.18)]"
            >
              <div className={`mb-4 inline-flex rounded-xl p-2.5 text-white ${event.color}`}>
                <Icon className="size-5" />
              </div>
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-[var(--kat-text-primary)]">
                {event.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--kat-text-secondary)]">
                {event.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {event.modes.map((mode) => (
                  <span
                    key={mode}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${MODE_STYLES[mode]}`}
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
