"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ClipboardCheck,
  MessageSquare,
  Users,
  BarChart3,
  ShieldCheck,
  Megaphone,
  BookOpen,
  Receipt,
  MessageCircle,
  Video,
  CreditCard,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FellowDashboard } from "@/components/dashboard/fellow-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import type { UserRoleValue } from "@/lib/enums";

type OverviewPanelProps = { role: UserRoleValue; firstName?: string };

type AnalyticsPayload = {
  scope: "user" | "platform";
  userAnalytics: {
    loginStats30d: number;
    assessmentsSubmitted: number;
    unreadMessages: number;
    upcomingMeetings: number;
  };
  platformAnalytics?: {
    enrollmentCount: number;
    totalRevenue: number;
    activityEvents7d: number;
    roleBreakdown: Record<string, number>;
  };
};

type StatCard = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
  href?: string;
};

type ActionCard = {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
};

const ACTIONS: Record<UserRoleValue, ActionCard[]> = {
  SUPER_ADMIN: [
    {
      label: "Analytics",
      description: "Platform performance, risk, and revenue.",
      href: "/dashboard/analytics",
      icon: <BarChart3 className="size-4" />,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    },
    {
      label: "Access Control",
      description: "Manage invites and account status.",
      href: "/dashboard/super-admin-invites",
      icon: <ShieldCheck className="size-4" />,
      color: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
    },
    {
      label: "Broadcast Messages",
      description: "Send updates to teams and roles.",
      href: "/dashboard/messages",
      icon: <Megaphone className="size-4" />,
      color: "bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
    },
  ],
  ADMIN: [
    {
      label: "Program Tracking",
      description: "Monitor cohorts and learner progress.",
      href: "/dashboard/analytics",
      icon: <BookOpen className="size-4" />,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    },
    {
      label: "Payment Review",
      description: "Verify payments and receipts.",
      href: "/dashboard/payments",
      icon: <Receipt className="size-4" />,
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    },
    {
      label: "Messages",
      description: "Chat with staff, fellows, learners, and parents.",
      href: "/dashboard/messages",
      icon: <MessageCircle className="size-4" />,
      color: "bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
    },
  ],
  INSTRUCTOR: [
    {
      label: "Grade Assessments",
      description: "Review submissions and score manually.",
      href: "/dashboard/assessments",
      icon: <ClipboardCheck className="size-4" />,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    },
    {
      label: "Run Live Sessions",
      description: "Schedule sessions with Zoho Meeting.",
      href: "/dashboard/meetings",
      icon: <Video className="size-4" />,
      color: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
    },
    {
      label: "Mentor Chat",
      description: "Stay in touch with fellows, learners, and admins.",
      href: "/dashboard/messages",
      icon: <MessageCircle className="size-4" />,
      color: "bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
    },
  ],
  FELLOW: [],
  STUDENT: [
    {
      label: "Assessments",
      description: "Submit work and track your scores.",
      href: "/dashboard/assessments",
      icon: <ClipboardList className="size-4" />,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    },
    {
      label: "Live Classes",
      description: "Join scheduled learning and mentorship sessions.",
      href: "/dashboard/meetings",
      icon: <Video className="size-4" />,
      color: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
    },
    {
      label: "Payment Records",
      description: "View family billing history and receipts.",
      href: "/dashboard/payments",
      icon: <Receipt className="size-4" />,
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    },
  ],
  PARENT: [
    {
      label: "Family Payments",
      description: "Invoices, transactions, and receipts.",
      href: "/dashboard/payments",
      icon: <CreditCard className="size-4" />,
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    },
    {
      label: "Contact Staff",
      description: "Reach admins and instructors directly.",
      href: "/dashboard/messages",
      icon: <MessageCircle className="size-4" />,
      color: "bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
    },
    {
      label: "Children's Grades",
      description: "View assessment scores and learning progress.",
      href: "/dashboard/grades",
      icon: <TrendingUp className="size-4" />,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    },
  ],
};

export function OverviewPanel({ role, firstName = "there" }: OverviewPanelProps) {
  if (role === "FELLOW") return <FellowDashboard />;
  if (role === "STUDENT") return <StudentDashboard firstName={firstName} />;
  return <GenericOverview role={role} />;
}

function GenericOverview({ role }: { role: UserRoleValue }) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const response = await fetch("/api/analytics");
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (response.ok && payload) setAnalytics(payload);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const stats: StatCard[] = useMemo(() => {
    if (!analytics) return [];
    const list: StatCard[] = [
      {
        label: "Logins (30d)",
        value: analytics.userAnalytics.loginStats30d,
        icon: <Activity className="size-4" />,
        accent: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
      },
      {
        label: "Assessments",
        value: analytics.userAnalytics.assessmentsSubmitted,
        icon: <ClipboardCheck className="size-4" />,
        accent: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
      },
      {
        label: "Unread Messages",
        value: analytics.userAnalytics.unreadMessages,
        icon: <MessageSquare className="size-4" />,
        accent: "bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
        href: "/dashboard/messages",
      },
      {
        label: "Upcoming Meetings",
        value: analytics.userAnalytics.upcomingMeetings,
        icon: <CalendarDays className="size-4" />,
        accent: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
        href: "/dashboard/meetings",
      },
    ];
    if (analytics.platformAnalytics) {
      list.push(
        {
          label: "Enrollments",
          value: analytics.platformAnalytics.enrollmentCount,
          icon: <Users className="size-4" />,
          accent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
        },
        {
          label: "Revenue",
          value: `₦${analytics.platformAnalytics.totalRevenue.toLocaleString("en-NG")}`,
          icon: <Banknote className="size-4" />,
          accent: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
        },
      );
    }
    return list;
  }, [analytics]);

  const actions = ACTIONS[role];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                <Skeleton className="mb-3 h-8 w-8 rounded-lg" />
                <Skeleton className="mb-2 h-7 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          : stats.map((stat, i) => {
              const inner = (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 sm:p-5">
                  <div className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg ${stat.accent}`}>
                    {stat.icon}
                  </div>
                  <p className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                </div>
              );
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                >
                  {stat.href ? <Link href={stat.href}>{inner}</Link> : inner}
                </motion.div>
              );
            })}
      </div>

      {/* Quick actions */}
      {actions.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Quick Access
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {actions.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05, duration: 0.2 }}
              >
                <Link
                  href={action.href}
                  className="group flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                >
                  <div className={`mt-0.5 shrink-0 rounded-lg p-2 ${action.color}`}>
                    {action.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{action.label}</p>
                      <ArrowUpRight className="size-3.5 shrink-0 text-slate-300 transition group-hover:text-slate-600" />
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{action.description}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
