"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  GraduationCap,
  MessageSquare,
  Users,
  Video,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Mentee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  assignedAt: string;
  program: string | null;
};

type UpcomingMeeting = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  joinUrl: string | null;
};

type FellowOverview = {
  mentees: Mentee[];
  upcomingMeetings: UpcomingMeeting[];
  pendingSubmissions: number;
  unreadMessages: number;
  cohort: { id: string; name: string; startsAt: string | null; endsAt: string | null } | null;
};

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  accent,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  href: string;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
    >
      <Link
        href={href}
        className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
      >
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900 dark:text-slate-100">
            {value}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300" />
      </Link>
    </motion.div>
  );
}

function MenteeAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
      {firstName[0]}{lastName[0]}
    </div>
  );
}

function formatMeetingTime(iso: string | Date) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  if (isToday) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return d.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" }) + ` · ${time}`;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-4">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-12" />
        </div>
      </div>
    </div>
  );
}

export function FellowDashboard() {
  const [data, setData] = useState<FellowOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/fellow/overview")
      .then((r) => r.json())
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">
      {/* Cohort banner */}
      {(loading || data?.cohort) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-[#0D1F45]/5 to-blue-50 p-4 dark:border-blue-900 dark:from-blue-950/40 dark:to-slate-800"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D1F45]/10 dark:bg-blue-900/40">
            <GraduationCap className="h-5 w-5 text-[#1E5FAF]" />
          </div>
          {loading ? (
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : data?.cohort ? (
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400">Active Cohort</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{data.cohort.name}</p>
            </div>
          ) : null}
          {!loading && (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/40">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Active Fellow
            </Badge>
          )}
        </motion.div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              icon={Users}
              label="Mentees"
              value={data?.mentees.length ?? 0}
              href="/dashboard/messages"
              accent="bg-blue-50 text-[#1E5FAF] dark:bg-blue-900/40 dark:text-blue-400"
              delay={0}
            />
            <StatCard
              icon={Video}
              label="Upcoming Sessions"
              value={data?.upcomingMeetings.length ?? 0}
              href="/dashboard/meetings"
              accent="bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"
              delay={0.05}
            />
            <StatCard
              icon={BookOpen}
              label="Pending Reviews"
              value={data?.pendingSubmissions ?? 0}
              href="/dashboard/assessments"
              accent={
                (data?.pendingSubmissions ?? 0) > 0
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
              }
              delay={0.1}
            />
            <StatCard
              icon={MessageSquare}
              label="Unread Messages"
              value={data?.unreadMessages ?? 0}
              href="/dashboard/messages"
              accent={
                (data?.unreadMessages ?? 0) > 0
                  ? "bg-rose-50 text-rose-500 dark:bg-rose-900/40 dark:text-rose-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
              }
              delay={0.15}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Mentees */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.25 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <h3 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-900 dark:text-slate-100">
                My Mentees
              </h3>
            </div>
            <Link
              href="/dashboard/messages"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              Message all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.mentees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                <Users className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No mentees assigned yet</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                An admin will assign students to you soon.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {data?.mentees.map((mentee, i) => (
                <motion.div
                  key={mentee.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + i * 0.04 }}
                  className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <MenteeAvatar
                    firstName={mentee.firstName}
                    lastName={mentee.lastName}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {mentee.firstName} {mentee.lastName}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {mentee.program ?? mentee.email}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/messages"
                    className="shrink-0 opacity-0 transition group-hover:opacity-100"
                    title="Message"
                  >
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Upcoming meetings */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.25 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <h3 className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-900 dark:text-slate-100">
                Upcoming Sessions
              </h3>
            </div>
            <Link
              href="/dashboard/meetings"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              Schedule <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                  <Skeleton className="mb-2 h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : data?.upcomingMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                <Calendar className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No sessions scheduled</p>
              <Link
                href="/dashboard/meetings"
                className="mt-2 text-xs font-medium text-blue-600 hover:underline"
              >
                Schedule a session →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {data?.upcomingMeetings.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.27 + i * 0.05 }}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                    <Video className="h-4 w-4 text-violet-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>{formatMeetingTime(m.startTime)}</span>
                    </div>
                  </div>
                  {m.joinUrl && (
                    <a
                      href={m.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700"
                    >
                      Join
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Pending reviews alert */}
      {!loading && (data?.pendingSubmissions ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            href="/dashboard/assessments"
            className="group flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 dark:border-amber-800 dark:bg-amber-900/20 dark:hover:border-amber-700"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                {data?.pendingSubmissions} submission{(data?.pendingSubmissions ?? 0) > 1 ? "s" : ""} awaiting your review
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Your mentees have submitted work that needs grading.
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-600 transition group-hover:text-amber-800" />
          </Link>
        </motion.div>
      )}

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32, duration: 0.25 }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h3 className="mb-4 [font-family:var(--font-space-grotesk)] font-semibold text-slate-900 dark:text-slate-100">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Messages", icon: MessageSquare, href: "/dashboard/messages", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-400" },
            { label: "Meetings", icon: Video, href: "/dashboard/meetings", color: "text-violet-600 bg-violet-50 dark:bg-violet-900/40 dark:text-violet-400" },
            { label: "Assessments", icon: BookOpen, href: "/dashboard/assessments", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/40 dark:text-amber-400" },
            { label: "Profile", icon: GraduationCap, href: "/dashboard/profile", color: "text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300" },
          ].map(({ label, icon: Icon, href, color }) => (
            <Link
              key={label}
              href={href}
              className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
