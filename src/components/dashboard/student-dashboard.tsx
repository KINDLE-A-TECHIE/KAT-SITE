"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, BookOpen, Calendar,
  ClipboardList, Flame, MessageSquare, Star, Trophy, Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─── XP & Level engine ────────────────────────────────────────────────────────

const LEVEL_TIERS = [
  { level: 1,  xp: 0,    rank: "Rookie",     emoji: "🌱", gradient: "from-slate-600 to-slate-700",       bar: "bg-slate-400"   },
  { level: 2,  xp: 100,  rank: "Explorer",   emoji: "🔍", gradient: "from-blue-600 to-blue-700",         bar: "bg-blue-400"    },
  { level: 3,  xp: 250,  rank: "Apprentice", emoji: "⚙️", gradient: "from-cyan-600 to-teal-700",         bar: "bg-cyan-400"    },
  { level: 4,  xp: 450,  rank: "Builder",    emoji: "🔨", gradient: "from-emerald-600 to-green-700",     bar: "bg-emerald-400" },
  { level: 5,  xp: 700,  rank: "Hacker",     emoji: "⚡", gradient: "from-yellow-500 to-orange-600",     bar: "bg-yellow-400"  },
  { level: 6,  xp: 1000, rank: "Innovator",  emoji: "🚀", gradient: "from-orange-500 to-red-600",        bar: "bg-orange-400"  },
  { level: 7,  xp: 1350, rank: "Pioneer",    emoji: "🌟", gradient: "from-pink-500 to-rose-600",         bar: "bg-pink-400"    },
  { level: 8,  xp: 1750, rank: "Champion",   emoji: "🏆", gradient: "from-violet-600 to-purple-700",     bar: "bg-violet-400"  },
  { level: 9,  xp: 2250, rank: "Legend",     emoji: "👑", gradient: "from-purple-600 to-indigo-700",     bar: "bg-purple-400"  },
  { level: 10, xp: 2800, rank: "KAT Elite",  emoji: "💎", gradient: "from-amber-400 to-yellow-500",      bar: "bg-amber-300"   },
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
  const floorXP  = current.xp;
  const ceilXP   = next?.xp ?? current.xp + 500;
  const progress = Math.min(100, Math.round(((xp - floorXP) / (ceilXP - floorXP)) * 100));
  return { current, next, progress, xpIntoLevel: xp - floorXP, xpNeeded: ceilXP - floorXP };
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Missions ─────────────────────────────────────────────────────────────────

const MISSIONS = [
  {
    label: "Open your course",
    description: "Continue where you left off.",
    href: "/dashboard/curriculum",
    icon: BookOpen,
    xp: 5,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    border: "border-blue-100 dark:border-blue-900/40",
  },
  {
    label: "Take an assessment",
    description: "Test your knowledge and earn XP.",
    href: "/dashboard/assessments",
    icon: ClipboardList,
    xp: 15,
    color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
    border: "border-violet-100 dark:border-violet-900/40",
  },
  {
    label: "Join a live session",
    description: "Attend your next scheduled class.",
    href: "/dashboard/meetings",
    icon: Calendar,
    xp: 10,
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    border: "border-emerald-100 dark:border-emerald-900/40",
  },
  {
    label: "Check your messages",
    description: "Stay connected with your team.",
    href: "/dashboard/messages",
    icon: MessageSquare,
    xp: 2,
    color: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
    border: "border-sky-100 dark:border-sky-900/40",
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StudentDashboard({ firstName }: { firstName: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [badges, setBadges]       = useState<EarnedBadge[]>([]);
  const [loading, setLoading]     = useState(true);

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
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  const logins      = analytics?.userAnalytics.loginStats30d      ?? 0;
  const assessments = analytics?.userAnalytics.assessmentsSubmitted ?? 0;
  const meetings    = analytics?.userAnalytics.upcomingMeetings    ?? 0;
  const messages    = analytics?.userAnalytics.unreadMessages      ?? 0;
  const totalXP     = computeXP(assessments, badges.length, logins);
  const lvl         = getLevelInfo(totalXP);
  const recentBadges = badges.slice(0, 4);

  return (
    <div className="space-y-5">

      {/* ── XP Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${lvl.current.gradient} p-6 text-white shadow-lg`}
      >
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-8 left-4 h-32 w-32 rounded-full bg-black/10 blur-2xl" />
        </div>

        <div className="relative flex flex-wrap items-center gap-5">
          {/* Level badge */}
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-sm">
            <span className="text-2xl leading-none">{lvl.current.emoji}</span>
            <span className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-white/80">Lv.{lvl.current.level}</span>
          </div>

          {/* Rank + XP */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
              Welcome back, {firstName}
            </p>
            <h2 className="mt-0.5 [font-family:var(--font-space-grotesk)] text-2xl font-bold">
              {lvl.current.rank}
            </h2>

            {/* XP bar */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-white/70">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" /> {totalXP.toLocaleString()} XP total
                </span>
                {lvl.next ? (
                  <span>{lvl.xpIntoLevel} / {lvl.xpNeeded} XP → {lvl.next.rank}</span>
                ) : (
                  <span>Max level reached 🎉</span>
                )}
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/20">
                <motion.div
                  className={`h-full rounded-full ${lvl.current.bar} shadow-sm`}
                  initial={{ width: 0 }}
                  animate={{ width: `${lvl.progress}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>

          {/* Total badges trophy */}
          {badges.length > 0 && (
            <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl bg-white/15 px-4 py-3">
              <Trophy className="h-5 w-5 text-yellow-300" />
              <span className="text-xl font-bold">{badges.length}</span>
              <span className="text-[10px] text-white/70">badges</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Day streak",    value: logins,      icon: Flame,         accent: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" },
          { label: "Assessments",   value: assessments, icon: ClipboardList, accent: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" },
          { label: "Badges earned", value: badges.length, icon: BadgeCheck,  accent: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",   href: "/dashboard/badges" },
          { label: "Live sessions", value: meetings,    icon: Calendar,      accent: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400", href: "/dashboard/meetings" },
        ].map(({ label, value, icon: Icon, accent, href }, i) => {
          const inner = (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl ${accent}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
          );
          return (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.25 }}
            >
              {href ? <Link href={href}>{inner}</Link> : inner}
            </motion.div>
          );
        })}
      </div>

      {/* ── Badges showcase ── */}
      {recentBadges.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Your Achievements</h3>
            </div>
            <Link href="/dashboard/badges" className="flex items-center gap-1 text-xs font-medium text-[#1E5FAF] hover:underline dark:text-blue-400">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recentBadges.map((eb, i) => (
              <motion.div
                key={eb.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.06 }}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/60"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow-sm"
                  style={{ backgroundColor: `${eb.badge.color}22` }}
                >
                  {eb.badge.icon}
                </div>
                <p className="text-xs font-semibold leading-tight text-slate-800 dark:text-slate-100">{eb.badge.name}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{fmt(eb.earnedAt)}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Missions ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#1E5FAF]" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Your Missions</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            earn XP
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {MISSIONS.map(({ label, description, href, icon: Icon, xp, color, border }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.06 }}
            >
              <Link
                href={href}
                className={`group flex items-start gap-4 rounded-2xl border bg-white p-4 transition hover:shadow-md dark:bg-slate-900 ${border}`}
              >
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{label}</p>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      +{xp} XP
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Unread nudge ── */}
      {messages > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Link
            href="/dashboard/messages"
            className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-5 py-3.5 transition hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/30 dark:hover:bg-sky-950/50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
              <MessageSquare className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-300">
              You have <span className="font-bold">{messages}</span> unread message{messages !== 1 ? "s" : ""} waiting.
            </p>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-sky-400" />
          </Link>
        </motion.div>
      )}
    </div>
  );
}
