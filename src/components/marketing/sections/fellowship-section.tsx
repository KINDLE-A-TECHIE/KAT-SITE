import Link from "next/link";
import { STAMP_CTA_DARK } from "../landing-tokens";

type OpenCohort = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  applicationClosesAt: string | null;
  externalApplicationFee: number | null;
  capacity: number | null;
  applicationCount: number;
  program: { id: string; name: string; level: string; description: string | null };
};

type FellowshipSectionProps = { cohorts: OpenCohort[] };

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isClosingSoon(iso: string): boolean {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function formatNaira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG", { minimumFractionDigits: 0 });
}

export function FellowshipSection({ cohorts }: FellowshipSectionProps) {
  return (
    <section id="fellowship" className="kat-defer bg-[var(--kat-pine)] py-16 text-[var(--kat-paper)] sm:py-24">
      <div className="kat-page">
        <div className="max-w-2xl border-l-2 border-[var(--kat-sun)] pl-5">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-[var(--kat-sun)]">
            Fellowship
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-[2.5rem]">
            The best students stop being students.
          </h2>
          <p className="mt-4 font-body leading-relaxed text-[var(--kat-paper)]/75">
            Fellows mentor the next intake, lead real community projects, and build a
            public track record. Enrolled students apply free.
          </p>
        </div>

        {cohorts.length === 0 ? (
          <div className="mt-12 border-t border-white/15 pt-8">
            <p className="max-w-md font-body text-[var(--kat-paper)]/70">
              No cohort is open right now. The next one is announced here first, and to
              enrolled students by email.
            </p>
          </div>
        ) : (
          <div className="mt-12 grid border-t border-white/15 sm:grid-cols-2 lg:grid-cols-3">
            {cohorts.map((cohort) => {
              const spotsRemaining =
                cohort.capacity != null
                  ? Math.max(0, cohort.capacity - cohort.applicationCount)
                  : null;
              const deadlineSoon =
                cohort.applicationClosesAt != null && isClosingSoon(cohort.applicationClosesAt);

              return (
                <div
                  key={cohort.id}
                  className="flex flex-col border-b border-white/15 p-6 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[0.7rem] uppercase tracking-wider text-[var(--kat-paper)]/60">
                      {cohort.program.name}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-[var(--kat-sun)]">
                      {cohort.program.level}
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-xl font-bold">{cohort.name}</h3>

                  <dl className="mt-4 space-y-1.5 font-body text-sm text-[var(--kat-paper)]/75">
                    <div className="flex gap-2">
                      <dt className="text-[var(--kat-paper)]/50">Starts</dt>
                      <dd>{formatMonthYear(cohort.startsAt)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-[var(--kat-paper)]/50">Spots</dt>
                      <dd>
                        {spotsRemaining == null
                          ? "Open"
                          : spotsRemaining === 0
                            ? "Full"
                            : `${spotsRemaining} remaining`}
                      </dd>
                    </div>
                    {cohort.applicationClosesAt != null && (
                      <div className="flex gap-2">
                        <dt className="text-[var(--kat-paper)]/50">Closes</dt>
                        <dd className={deadlineSoon ? "font-semibold text-[var(--kat-sun)]" : ""}>
                          {formatDeadline(cohort.applicationClosesAt)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <p className="mt-5 font-display text-2xl font-bold">
                    {cohort.externalApplicationFee != null
                      ? formatNaira(cohort.externalApplicationFee)
                      : "Free"}
                    {cohort.externalApplicationFee != null && (
                      <span className="ml-2 font-mono text-[0.7rem] font-medium uppercase tracking-wider text-[var(--kat-paper)]/50">
                        Free if enrolled
                      </span>
                    )}
                  </p>

                  <div className="mt-6 flex flex-1 items-end">
                    <Link
                      href={`/fellowship/apply?cohort=${cohort.id}`}
                      className={`kat-focus-ring flex w-full items-center justify-center px-6 py-3 text-center ${STAMP_CTA_DARK}`}
                    >
                      Apply now
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
