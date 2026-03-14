import { Layers3, Star, Trophy, Users } from "lucide-react";

type StatsBarProps = {
  enrollments: number;
  passRate: number;
};

export function StatsBar({ enrollments, passRate }: StatsBarProps) {
  const displayEnrollments = enrollments >= 1000
    ? `${(enrollments / 1000).toFixed(1).replace(/\.0$/, "")}k+`
    : `${enrollments}+`;

  const stats = [
    { value: displayEnrollments, label: "Students Enrolled", Icon: Users },
    { value: "4.9★", label: "Average Rating", Icon: Star },
    { value: "3", label: "Age-Based Tracks", Icon: Layers3 },
    { value: `${passRate}%`, label: "Project Completion", Icon: Trophy },
  ];

  return (
    <section className="kat-page py-10 sm:py-14">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--kat-border)] bg-[var(--kat-border)] shadow-[0_4px_24px_-8px_rgba(19,43,94,0.1)] sm:grid-cols-4">
        {stats.map(({ value, label, Icon }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 bg-white px-4 py-6 text-center">
            <Icon className="size-5 text-[var(--kat-primary-blue)] opacity-60" />
            <p className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-[var(--kat-text-primary)] sm:text-3xl">
              {value}
            </p>
            <p className="text-xs text-[var(--kat-text-secondary)]">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
