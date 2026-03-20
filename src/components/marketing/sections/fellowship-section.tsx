import Link from "next/link";

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
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
    <section
      id="fellowship"
      className="py-16 sm:py-20"
      style={{ background: "linear-gradient(135deg, #0D1F45 0%, #132B5E 45%, #1E5FAF 100%)" }}
    >
      <div className="kat-page">
        {/* Header */}
        <div className="mb-10 text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--kat-accent-sky)" }}
          >
            Fellowship Programme
          </p>
          <h2 className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-bold text-white sm:text-4xl">
            Become a KAT Fellow
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-blue-200">
            The best KAT students don&apos;t just graduate — they level up. Fellows mentor the next generation, lead real-world projects, and build a reputation that opens doors. Current students apply free. Ready?
          </p>
        </div>

        {/* Cohort cards */}
        {cohorts.length === 0 ? (
          <div
            className="mx-auto max-w-md rounded-2xl p-8 text-center"
            style={{
              backgroundColor: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <p className="text-blue-200">No cohorts open right now — join the waitlist and we&apos;ll notify you first when one opens.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cohorts.map((cohort) => {
              const spotsRemaining =
                cohort.capacity != null
                  ? Math.max(0, cohort.capacity - cohort.applicationCount)
                  : null;

              const deadlineSoon =
                cohort.applicationClosesAt != null &&
                isClosingSoon(cohort.applicationClosesAt);

              return (
                <div
                  key={cohort.id}
                  className="flex flex-col rounded-2xl p-6"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {/* Program badge + level */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      {cohort.program.name}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: "rgba(77,179,230,0.18)",
                        color: "var(--kat-accent-cyan, #4DB3E6)",
                      }}
                    >
                      {cohort.program.level}
                    </span>
                  </div>

                  {/* Cohort name */}
                  <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-bold text-white">
                    {cohort.name}
                  </h3>

                  {/* Start date */}
                  <p className="mt-1 text-sm text-blue-200">
                    Starting {formatMonthYear(cohort.startsAt)}
                  </p>

                  {/* Spots */}
                  <p className="mt-2 text-sm text-blue-200">
                    <span className="font-medium text-white">Spots: </span>
                    {spotsRemaining != null ? (
                      spotsRemaining === 0 ? (
                        <span className="text-rose-300">Full</span>
                      ) : (
                        <span>{spotsRemaining} remaining</span>
                      )
                    ) : (
                      <span>Open</span>
                    )}
                  </p>

                  {/* Application deadline */}
                  {cohort.applicationClosesAt != null && (
                    <p
                      className="mt-1 text-sm font-medium"
                      style={{ color: deadlineSoon ? "#FBBF24" : undefined }}
                    >
                      {deadlineSoon ? (
                        <span className="text-amber-400">
                          Closes {formatDeadline(cohort.applicationClosesAt)}
                        </span>
                      ) : (
                        <span className="text-blue-200">
                          Closes {formatDeadline(cohort.applicationClosesAt)}
                        </span>
                      )}
                    </p>
                  )}

                  {/* Fee row */}
                  <div className="mt-3 flex items-baseline gap-2">
                    {cohort.externalApplicationFee != null ? (
                      <>
                        <span className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-white">
                          {formatNaira(cohort.externalApplicationFee)}
                        </span>
                        <span className="text-xs text-blue-300">Free for enrolled students</span>
                      </>
                    ) : (
                      <span className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-white">
                        Free
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="mt-5 flex-1 flex items-end">
                    <Link
                      href={`/fellowship/apply?cohort=${cohort.id}`}
                      className="inline-block w-full rounded-xl px-6 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--kat-primary-blue, #1E5FAF)" }}
                    >
                      Apply Now
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
