"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type EarnedBadge = {
  id: string;
  earnedAt: string;
  badge: {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    module: {
      id: string;
      title: string;
      version: {
        curriculum: {
          program: { id: string; name: string };
        };
      };
    };
  };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function BadgesPanel() {
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/badges")
      .then(r => r.ok ? r.json() as Promise<{ badges: EarnedBadge[] }> : { badges: [] })
      .then(data => { setBadges(data.badges); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Group by program
  const programGroups = (() => {
    const map = new Map<string, { program: { id: string; name: string }; badges: EarnedBadge[] }>();
    for (const eb of badges) {
      const program = eb.badge.module.version.curriculum.program;
      if (!map.has(program.id)) map.set(program.id, { program, badges: [] });
      map.get(program.id)!.badges.push(eb);
    }
    return [...map.values()];
  })();

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Badges are awarded automatically when you pass all assessments in a module.
      </p>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-28 rounded-2xl" />)}
        </div>
      ) : badges.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
          <span className="text-5xl">🏅</span>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            No badges yet — complete a module to earn your first one.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {programGroups.map(({ program, badges: groupBadges }) => (
            <section key={program.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {program.name}
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  {groupBadges.length} {groupBadges.length === 1 ? "badge" : "badges"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {groupBadges.map(eb => (
                  <div
                    key={eb.id}
                    className="group relative flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                  >
                    {/* Badge icon circle */}
                    <div
                      className="flex size-14 items-center justify-center rounded-full text-3xl shadow-sm"
                      style={{ backgroundColor: `${eb.badge.color}18` }}
                    >
                      {eb.badge.icon}
                    </div>

                    {/* Name */}
                    <p className="text-xs font-semibold leading-tight text-slate-800 dark:text-slate-100">
                      {eb.badge.name}
                    </p>

                    {/* Module label */}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {eb.badge.module.title}
                    </p>

                    {/* Earned date — appears on hover */}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Earned {formatDate(eb.earnedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
