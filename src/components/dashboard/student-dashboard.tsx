"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatLedger } from "@/components/stat-ledger";

// XP and level engine. Rank names carry the personality typographically;
// no emoji, no per-rank gradient. The panel itself stays pine for every rank.

const LEVEL_TIERS = [
  { level: 1, xp: 0, rank: "Rookie" },
  { level: 2, xp: 100, rank: "Explorer" },
  { level: 3, xp: 250, rank: "Apprentice" },
  { level: 4, xp: 450, rank: "Builder" },
  { level: 5, xp: 700, rank: "Hacker" },
  { level: 6, xp: 1000, rank: "Innovator" },
  { level: 7, xp: 1350, rank: "Pioneer" },
  { level: 8, xp: 1750, rank: "Champion" },
  { level: 9, xp: 2250, rank: "Legend" },
  { level: 10, xp: 2800, rank: "KAT Elite" },
] as const;

function computeXP(assessments: number, badges: number, logins: number) {
  return assessments * 15 + badges * 75 + logins * 2;
}

function getLevelInfo(xp: number) {
  let current: typeof LEVEL_TIERS[number] = LEVEL_TIERS[0];
  for (const tier of LEVEL_TIERS) {
    if (xp >= tier.xp) current = tier;
  }
  const currentIdx = LEVEL_TIERS.indexOf(current);
  const next = LEVEL_TIERS[currentIdx + 1] ?? null;
  const floorXP = current.xp;
  const ceilXP = next?.xp ?? current.xp + 500;
  const progress = Math.min(100, Math.round(((xp - floorXP) / (ceilXP - floorXP)) * 100));
  return { current, next, progress, xpIntoLevel: xp - floorXP, xpNeeded: ceilXP - floorXP };
}

type Analytics = {
  userAnalytics: {
    loginStats30d: number;
    assessmentsSubmitted: number;
    unreadMessages: number;
    upcomingMeetings: number;
  };
};

type EarnedBadge = {
  id: string;
  earnedAt: string;
  badge: { id: string; name: string; icon: string; color: string; module: { title: string } };
};

const MISSIONS = [
  {
    label: "Open your course",
    description: "Continue where you left off.",
    href: "/dashboard/curriculum",
    xp: 5,
  },
  {
    label: "Take an assessment",
    description: "Test your knowledge and earn XP.",
    href: "/dashboard/assessments",
    xp: 15,
  },
  {
    label: "Join a live session",
    description: "Attend your next scheduled class.",
    href: "/dashboard/meetings",
    xp: 10,
  },
  {
    label: "Check your messages",
    description: "Stay connected with your team.",
    href: "/dashboard/messages",
    xp: 2,
  },
] as const;

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function StudentDashboard({ firstName }: { firstName: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/analytics").then(r => r.ok ? r.json() as Promise<Analytics> : null),
      fetch("/api/badges").then(r => r.ok ? r.json() as Promise<{ badges: EarnedBadge[] }> : { badges: [] }),
    ]).then(([a, b]) => {
      if (!active) return;
      if (a) setAnalytics(a);
      setBadges(b?.badges ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  const logins = analytics?.userAnalytics.loginStats30d ?? 0;
  const assessments = analytics?.userAnalytics.assessmentsSubmitted ?? 0;
  const meetings = analytics?.userAnalytics.upcomingMeetings ?? 0;
  const messages = analytics?.userAnalytics.unreadMessages ?? 0;
  const totalXP = computeXP(assessments, badges.length, logins);
  const lvl = getLevelInfo(totalXP);
  const recentBadges = badges.slice(0, 4);

  return (
    <div className="space-y-5">

      {/* The signature: one flat pine panel. Rank set huge in the display face,
          figures in mono, progress filled in sun. The only big radius on the page. */}
      <div className="rounded-2xl bg-[var(--kat-pine)] p-6 text-white sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-white/60">
              Welcome back, {firstName}
            </p>
            <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {lvl.current.rank}
            </h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-2xl font-medium tabular-nums">
              LV {String(lvl.current.level).padStart(2, "0")}
            </p>
            {badges.length > 0 && (
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">
                {badges.length} badge{badges.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {/* XP bar: the one animated element, sun on pine. */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between font-mono text-[11px] tabular-nums text-white/70">
            <span>{totalXP.toLocaleString()} XP</span>
            {lvl.next ? (
              <span>
                {lvl.xpIntoLevel} / {lvl.xpNeeded} to {lvl.next.rank}
              </span>
            ) : (
              <span>Max level</span>
            )}
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/15">
            <motion.div
              className="h-full rounded-full bg-[var(--kat-sun)]"
              initial={{ width: 0 }}
              animate={{ width: `${lvl.progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Stats ledger */}
      <StatLedger
        entries={[
          { label: "Logins (30d)", value: logins },
          { label: "Assessments", value: assessments },
          { label: "Badges earned", value: badges.length, href: "/dashboard/badges" },
          { label: "Live sessions", value: meetings, href: "/dashboard/meetings" },
        ]}
        columns={4}
      />

      {/* Achievements. Badge icon and color come from the Badge record itself. */}
      {recentBadges.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
              Achievements
            </h3>
            <Link
              href="/dashboard/badges"
              className="flex items-center gap-1 text-xs font-medium text-orange-700 hover:underline dark:text-orange-400"
            >
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recentBadges.map((eb) => (
              <div
                key={eb.id}
                className="flex flex-col items-center gap-2 rounded-lg border border-stone-100 bg-stone-50 p-3 text-center dark:border-stone-800 dark:bg-stone-800/60"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
                  style={{ backgroundColor: `${eb.badge.color}22` }}
                >
                  {eb.badge.icon}
                </div>
                <p className="text-xs font-semibold leading-tight text-stone-800 dark:text-stone-100">
                  {eb.badge.name}
                </p>
                <p className="font-mono text-[11px] text-stone-400 dark:text-stone-500">
                  {fmt(eb.earnedAt)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Missions: a divided list. XP reward in mono on the right. */}
      <section>
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
          Missions
        </h3>
        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          {MISSIONS.map(({ label, description, href, xp }) => (
            <Link
              key={label}
              href={href}
              className="group flex items-center justify-between gap-4 border-b border-stone-100 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/60 sm:px-5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{label}</p>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-[11px] tabular-nums text-stone-500 dark:text-stone-400">
                  +{xp} XP
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-orange-600 dark:text-stone-600" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Unread nudge */}
      {messages > 0 && (
        <Link
          href="/dashboard/messages"
          className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 transition-colors hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 sm:px-5"
        >
          <p className="text-sm font-medium text-orange-900 dark:text-orange-300">
            {messages} unread message{messages !== 1 ? "s" : ""} waiting for you.
          </p>
          <ArrowRight className="h-4 w-4 shrink-0 text-orange-500" />
        </Link>
      )}
    </div>
  );
}
