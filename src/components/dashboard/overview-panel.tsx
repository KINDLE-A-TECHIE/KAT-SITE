"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatLedger, type StatLedgerEntry } from "@/components/stat-ledger";
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

type ActionLink = {
  label: string;
  description: string;
  href: string;
};

const ACTIONS: Record<UserRoleValue, ActionLink[]> = {
  SUPER_ADMIN: [
    {
      label: "Analytics",
      description: "Platform performance, risk, and revenue.",
      href: "/dashboard/analytics",
    },
    {
      label: "Access control",
      description: "Manage invites and account status.",
      href: "/dashboard/super-admin-invites",
    },
    {
      label: "Broadcast messages",
      description: "Send updates to teams and roles.",
      href: "/dashboard/messages",
    },
  ],
  ADMIN: [
    {
      label: "Program tracking",
      description: "Monitor cohorts and learner progress.",
      href: "/dashboard/analytics",
    },
    {
      label: "Payment review",
      description: "Verify payments and receipts.",
      href: "/dashboard/payments",
    },
    {
      label: "Messages",
      description: "Chat with staff, fellows, learners, and parents.",
      href: "/dashboard/messages",
    },
  ],
  INSTRUCTOR: [
    {
      label: "Grade assessments",
      description: "Review submissions and score manually.",
      href: "/dashboard/assessments",
    },
    {
      label: "Run live sessions",
      description: "Schedule sessions with Jitsi Meet.",
      href: "/dashboard/meetings",
    },
    {
      label: "Mentor chat",
      description: "Stay in touch with fellows, learners, and admins.",
      href: "/dashboard/messages",
    },
  ],
  FELLOW: [],
  STUDENT: [
    {
      label: "Assessments",
      description: "Submit work and track your scores.",
      href: "/dashboard/assessments",
    },
    {
      label: "Live classes",
      description: "Join scheduled learning and mentorship sessions.",
      href: "/dashboard/meetings",
    },
    {
      label: "Payment records",
      description: "View family billing history and receipts.",
      href: "/dashboard/payments",
    },
  ],
  PARENT: [
    {
      label: "Family payments",
      description: "Invoices, transactions, and receipts.",
      href: "/dashboard/payments",
    },
    {
      label: "Contact staff",
      description: "Reach admins and instructors directly.",
      href: "/dashboard/messages",
    },
    {
      label: "Children's grades",
      description: "View assessment scores and learning progress.",
      href: "/dashboard/grades",
    },
  ],
  // School accounts have no B2C actions. Their surface is the school host (/home, /teach, /learn);
  // this dashboard is the consumer product and has nothing to offer them.
  SCHOOL_STAFF: [],
  SCHOOL_STUDENT: [],
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

  const stats: StatLedgerEntry[] = useMemo(() => {
    if (!analytics) return [];
    const list: StatLedgerEntry[] = [
      { label: "Logins (30d)", value: analytics.userAnalytics.loginStats30d },
      { label: "Assessments", value: analytics.userAnalytics.assessmentsSubmitted },
      {
        label: "Unread messages",
        value: analytics.userAnalytics.unreadMessages,
        href: "/dashboard/messages",
      },
      {
        label: "Upcoming meetings",
        value: analytics.userAnalytics.upcomingMeetings,
        href: "/dashboard/meetings",
      },
    ];
    if (analytics.platformAnalytics) {
      list.push(
        { label: "Enrollments", value: analytics.platformAnalytics.enrollmentCount },
        {
          label: "Revenue",
          value: `₦${analytics.platformAnalytics.totalRevenue.toLocaleString("en-NG")}`,
        },
      );
    }
    return list;
  }, [analytics]);

  const actions = ACTIONS[role];

  return (
    <div className="space-y-6">
      {/* Stat ledger: one flat container, hairline dividers, mono numerals. */}
      {loading ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 dark:border-stone-800 dark:bg-stone-800 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white p-4 dark:bg-stone-900 sm:p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2.5 h-7 w-14" />
            </div>
          ))}
        </div>
      ) : stats.length > 0 ? (
        <StatLedger entries={stats} columns={stats.length === 6 ? 6 : 4} />
      ) : null}

      {/* Quick access: a divided link list, not a card wall. */}
      {actions.length > 0 && (
        <section>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
            Quick access
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            {actions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center justify-between gap-4 border-b border-stone-100 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/60 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {action.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                    {action.description}
                  </p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-stone-300 transition-colors group-hover:text-orange-600 dark:text-stone-600" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
