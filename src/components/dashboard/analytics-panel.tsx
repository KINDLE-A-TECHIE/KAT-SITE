"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type RangeValue = "7d" | "30d" | "90d";

type UserTrendPoint = {
  date: string;
  label: string;
  logins: number;
  submissions: number;
  messagesReceived: number;
  meetingsJoined: number;
};

type PlatformTrendPoint = {
  date: string;
  label: string;
  newEnrollments: number;
  revenue: number;
  activityEvents: number;
  messagesSent: number;
};

type AnalyticsResponse = {
  scope: "user" | "platform";
  range: RangeValue;
  userAnalytics: {
    loginStats30d: number;
    activityLabel?: string;
    assessmentsSubmitted: number;
    unreadMessages: number;
    upcomingMeetings: number;
    trends: {
      rangeDays: number;
      points: UserTrendPoint[];
    };
  };
  platformAnalytics?: {
    enrollmentCount: number;
    totalRevenue: number;
    activityEvents7d: number;
    roleBreakdown: Record<string, number>;
    trends: {
      rangeDays: number;
      points: PlatformTrendPoint[];
    };
    riskAlerts: {
      userId: string;
      name: string;
      role: string;
      unreadMessages: number;
      upcomingMeetings: number;
      lastLoginDaysAgo: number | null;
      overdueAssessments: number;
      passRate: number | null;
      daysSinceLastSubmission: number | null;
      riskScore: number;
    }[];
    cohortLeaderboard: {
      cohortId: string;
      name: string;
      programName: string;
      enrollments: number;
      completionRate: number;
      meetingAttendanceRate: number;
      revenue: number;
    }[];
    programLeaderboard: {
      programId: string;
      name: string;
      enrollments: number;
      completed: number;
      completionRate: number;
      revenue: number;
    }[];
    assessmentAnalytics: {
      gradingBacklog: number;
      programStats: {
        programId: string;
        programName: string;
        totalAssessments: number;
        totalSubmissions: number;
        passRate: number | null;
        avgScore: number | null;
        pendingGrading: number;
      }[];
    };
  };
};

type PaymentsResponse = {
  monthly: Record<string, { total: number; successful: number; failed: number }>;
};

type InstructorScorecard = {
  instructorId: string;
  name: string;
  role: string;
  assessmentsCreated: number;
  submissionsGraded: number;
  avgTurnaroundHours: number | null;
  avgFeedbackLength: number | null;
  studentPassRate: number | null;
};

type InstructorScorecardResponse = {
  scorecards: InstructorScorecard[];
};

type TrendMiniCardProps<TPoint extends { label: string }> = {
  title: string;
  subtitle: string;
  points: TPoint[];
  colorClass: string;
  getValue: (point: TPoint) => number;
  formatValue?: (value: number) => string;
};

type RecommendationTone = "focus" | "opportunity" | "critical";

type Recommendation = {
  title: string;
  detail: string;
  action: string;
  tone: RecommendationTone;
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function TrendMiniCard<TPoint extends { label: string }>(props: TrendMiniCardProps<TPoint>) {
  const max = useMemo(() => {
    const values = props.points.map((point) => props.getValue(point));
    return Math.max(1, ...values);
  }, [props]);

  const total = useMemo(
    () => props.points.reduce((sum, point) => sum + props.getValue(point), 0),
    [props],
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{props.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{props.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            {props.formatValue ? props.formatValue(total) : total}
          </p>
        </div>
      </div>
      <div className="mt-3 flex h-24 items-end gap-1.5">
        {props.points.map((point) => {
          const value = props.getValue(point);
          const heightPercent = Math.round((value / max) * 100);
          const barHeight = value === 0 ? 4 : Math.max(12, heightPercent);
          return (
            <div key={`${props.title}-${point.label}`} className="group relative flex flex-1 items-end">
              <div
                className={cn("w-full rounded-sm transition-opacity group-hover:opacity-90", props.colorClass)}
                style={{ height: `${barHeight}%` }}
                title={`${point.label}: ${props.formatValue ? props.formatValue(value) : value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>{props.points[0]?.label ?? ""}</span>
        <span>{props.points[Math.floor(props.points.length / 2)]?.label ?? ""}</span>
        <span>{props.points[props.points.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}

function formatLastLogin(value: number | null) {
  if (value === null) {
    return "Never";
  }
  if (value <= 0) {
    return "Today";
  }
  if (value === 1) {
    return "1 day ago";
  }
  return `${value} days ago`;
}

function PercentageBar({ value, colorClass }: { value: number; colorClass: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
      <div className={cn("h-full rounded-full", colorClass)} style={{ width: `${width}%` }} />
    </div>
  );
}

function riskBadgeClass(score: number) {
  if (score >= 8) {
    return "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400";
  }
  if (score >= 5) {
    return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400";
  }
  return "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400";
}

function recommendationToneClass(tone: RecommendationTone) {
  if (tone === "critical") {
    return "border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/30";
  }
  if (tone === "opportunity") {
    return "border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/30";
  }
  return "border-sky-200 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-900/30";
}

export function AnalyticsPanel() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeValue>("30d");
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [monthlyPayments, setMonthlyPayments] = useState<PaymentsResponse["monthly"]>({});
  const [scorecards, setScorecards] = useState<InstructorScorecard[]>([]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const analyticsResponse = await fetch(`/api/analytics?range=${range}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!analyticsResponse.ok) {
          if (active) {
            setAnalytics(null);
          }
          return;
        }
        const payload = (await analyticsResponse.json()) as AnalyticsResponse;
        if (active) {
          setAnalytics(payload);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [range]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadPayments = async () => {
      const paymentsResponse = await fetch("/api/payments", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!paymentsResponse.ok) {
        return;
      }
      const payload = (await paymentsResponse.json()) as PaymentsResponse;
      if (active) {
        setMonthlyPayments(payload.monthly ?? {});
      }
    };
    void loadPayments();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadScorecards = async () => {
      const res = await fetch("/api/analytics/instructors", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) return;
      const payload = (await res.json()) as InstructorScorecardResponse;
      if (active) setScorecards(payload.scorecards ?? []);
    };
    void loadScorecards();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const paymentRows = useMemo(
    () =>
      Object.entries(monthlyPayments)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 8),
    [monthlyPayments],
  );

  const userTrendPoints = useMemo(() => analytics?.userAnalytics.trends.points ?? [], [analytics]);
  const platformTrendPoints = useMemo(
    () => analytics?.platformAnalytics?.trends.points ?? [],
    [analytics],
  );
  const primaryActivityLabel = analytics?.userAnalytics.activityLabel ?? "Assessments Submitted";

  const headlineSignals = useMemo(() => {
    if (!analytics?.platformAnalytics) {
      return [
        `${analytics?.userAnalytics.unreadMessages ?? 0} unread message(s)`,
        `${analytics?.userAnalytics.upcomingMeetings ?? 0} upcoming meeting(s)`,
      ];
    }

    const riskCount = analytics.platformAnalytics.riskAlerts.length;
    const topProgram = analytics.platformAnalytics.programLeaderboard[0];
    const rangeRevenue = platformTrendPoints.reduce((sum, point) => sum + point.revenue, 0);

    return [
      `${riskCount} attention flag${riskCount === 1 ? "" : "s"} currently`,
      topProgram
        ? `${topProgram.name} leads at ${topProgram.completionRate}% completion`
        : "No completion lead yet",
      `NGN ${Math.round(rangeRevenue).toLocaleString()} in ${range.toUpperCase()}`,
    ];
  }, [analytics, platformTrendPoints, range]);

  const exportOverviewCsv = () => {
    if (!analytics) {
      return;
    }

    const rows: Array<Array<string | number | null>> = [
      ["Scope", analytics.scope],
      ["Range", analytics.range],
      [],
      ["User Metrics"],
      ["Logins (30d)", analytics.userAnalytics.loginStats30d],
      [primaryActivityLabel, analytics.userAnalytics.assessmentsSubmitted],
      ["Unread Messages", analytics.userAnalytics.unreadMessages],
      ["Upcoming Meetings", analytics.userAnalytics.upcomingMeetings],
    ];

    if (analytics.platformAnalytics) {
      rows.push(
        [],
        ["Institution Metrics"],
        ["Enrollments", analytics.platformAnalytics.enrollmentCount],
        ["Revenue", analytics.platformAnalytics.totalRevenue],
        ["Activity Events (7d)", analytics.platformAnalytics.activityEvents7d],
      );
    }

    downloadCsv(`analytics-overview-${range}.csv`, rows);
  };

  const exportRiskCsv = () => {
    if (!analytics?.platformAnalytics) {
      return;
    }

    const rows: Array<Array<string | number | null>> = [
      ["Name", "Role", "Unread Messages", "Upcoming Meetings", "Last Login Days Ago", "Overdue Assessments", "Pass Rate (%)", "Days Since Last Submission", "Risk Score"],
      ...analytics.platformAnalytics.riskAlerts.map((alert) => [
        alert.name,
        alert.role,
        alert.unreadMessages,
        alert.upcomingMeetings,
        alert.lastLoginDaysAgo,
        alert.overdueAssessments,
        alert.passRate,
        alert.daysSinceLastSubmission,
        alert.riskScore,
      ]),
    ];

    downloadCsv(`analytics-risk-${range}.csv`, rows);
  };

  const exportCohortCsv = () => {
    if (!analytics?.platformAnalytics) {
      return;
    }

    const rows: Array<Array<string | number>> = [
      ["Cohort", "Program", "Enrollments", "Completion Rate (%)", "Attendance Rate (%)", "Revenue"],
      ...analytics.platformAnalytics.cohortLeaderboard.map((cohort) => [
        cohort.name,
        cohort.programName,
        cohort.enrollments,
        cohort.completionRate,
        cohort.meetingAttendanceRate,
        cohort.revenue,
      ]),
    ];

    downloadCsv(`analytics-cohorts-${range}.csv`, rows);
  };

  const exportProgramCsv = () => {
    if (!analytics?.platformAnalytics) {
      return;
    }

    const rows: Array<Array<string | number>> = [
      ["Program", "Enrollments", "Completed", "Completion Rate (%)", "Revenue"],
      ...analytics.platformAnalytics.programLeaderboard.map((program) => [
        program.name,
        program.enrollments,
        program.completed,
        program.completionRate,
        program.revenue,
      ]),
    ];

    downloadCsv(`analytics-programs-${range}.csv`, rows);
  };

  const exportRevenueCsv = () => {
    const rows: Array<Array<string | number>> = [
      ["Month", "Total", "Successful", "Failed"],
      ...paymentRows.map(([month, value]) => [month, value.total, value.successful, value.failed]),
    ];
    downloadCsv(`analytics-revenue-${range}.csv`, rows);
  };

  const exportScorecardCsv = () => {
    const rows: Array<Array<string | number | null>> = [
      ["Name", "Role", "Assessments Created", "Submissions Graded", "Avg Turnaround (hrs)", "Avg Feedback Length (chars)", "Student Pass Rate (%)"],
      ...scorecards.map((s) => [
        s.name,
        s.role,
        s.assessmentsCreated,
        s.submissionsGraded,
        s.avgTurnaroundHours,
        s.avgFeedbackLength,
        s.studentPassRate,
      ]),
    ];
    downloadCsv("analytics-instructor-scorecard.csv", rows);
  };

  const exportPdf = () => {
    if (!analytics) {
      return;
    }

    const reportDate = new Date().toLocaleString();
    const reportTitle =
      analytics.scope === "platform"
        ? "Institution Analytics Report"
        : "Personal Analytics Report";

    const renderTable = (
      title: string,
      headers: string[],
      rows: Array<Array<string | number | null | undefined>>,
      emptyMessage: string,
    ) => {
      const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
      const body =
        rows.length === 0
          ? `<tr><td class="empty" colspan="${headers.length}">${escapeHtml(emptyMessage)}</td></tr>`
          : rows
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
              )
              .join("");
      return `
        <section class="section">
          <h2>${escapeHtml(title)}</h2>
          <table>
            <thead><tr>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </section>
      `;
    };

    const keyMetrics = [
      ["Logins (30d)", analytics.userAnalytics.loginStats30d],
      [primaryActivityLabel, analytics.userAnalytics.assessmentsSubmitted],
      ["Unread Messages", analytics.userAnalytics.unreadMessages],
      ["Upcoming Meetings", analytics.userAnalytics.upcomingMeetings],
    ];

    const sections: string[] = [];
    sections.push(`
      <section class="section">
        <h2>Overview</h2>
        <div class="cards">
          <article class="card"><p class="label">Scope</p><p class="value">${escapeHtml(analytics.scope)}</p></article>
          <article class="card"><p class="label">Range</p><p class="value">${escapeHtml(analytics.range.toUpperCase())}</p></article>
          <article class="card"><p class="label">Generated</p><p class="value">${escapeHtml(reportDate)}</p></article>
        </div>
      </section>
    `);

    sections.push(renderTable("User Metrics", ["Metric", "Value"], keyMetrics, "No user metrics available."));

    sections.push(
      renderTable(
        "Top Recommendations",
        ["Title", "Detail", "Action"],
        topRecommendations.map((item) => [item.title, item.detail, item.action]),
        "No recommendations available.",
      ),
    );

    if (analytics.platformAnalytics) {
      const platform = analytics.platformAnalytics;
      const roleRows = Object.entries(platform.roleBreakdown).map(([role, count]) => [role, count]);
      const riskRows = platform.riskAlerts.map((alert) => [
        alert.name,
        alert.role,
        alert.unreadMessages,
        alert.upcomingMeetings,
        formatLastLogin(alert.lastLoginDaysAgo),
        alert.overdueAssessments,
        alert.passRate !== null ? `${alert.passRate}%` : "—",
        alert.daysSinceLastSubmission !== null ? `${alert.daysSinceLastSubmission}d ago` : "—",
        alert.riskScore,
      ]);
      const cohortRows = platform.cohortLeaderboard.map((cohort) => [
        cohort.name,
        cohort.programName,
        cohort.enrollments,
        `${cohort.completionRate}%`,
        `${cohort.meetingAttendanceRate}%`,
        `NGN ${cohort.revenue.toLocaleString()}`,
      ]);
      const programRows = platform.programLeaderboard.map((program) => [
        program.name,
        program.enrollments,
        program.completed,
        `${program.completionRate}%`,
        `NGN ${program.revenue.toLocaleString()}`,
      ]);

      sections.push(
        renderTable(
          "Institution Metrics",
          ["Metric", "Value"],
          [
            ["Enrollments", platform.enrollmentCount],
            ["Revenue", `NGN ${Number(platform.totalRevenue).toLocaleString()}`],
            ["Activity Events (7d)", platform.activityEvents7d],
          ],
          "No institution metrics available.",
        ),
      );
      sections.push(
        renderTable("Role Breakdown", ["Role", "Count"], roleRows, "No role breakdown available."),
      );
      sections.push(
        renderTable(
          "Risk & Attention Queue",
          ["Name", "Role", "Unread", "Upcoming Meetings", "Last Login", "Overdue", "Pass %", "Last Submit", "Risk Score"],
          riskRows,
          "No urgent attention signals right now.",
        ),
      );
      sections.push(
        renderTable(
          "Cohort Leaderboard",
          ["Cohort", "Program", "Enrollments", "Completion", "Attendance", "Revenue"],
          cohortRows,
          "No cohort analytics yet.",
        ),
      );
      sections.push(
        renderTable(
          "Program Leaderboard",
          ["Program", "Enrollments", "Completed", "Completion", "Revenue"],
          programRows,
          "No program analytics yet.",
        ),
      );

      if (platform.assessmentAnalytics) {
        const assessmentRows = platform.assessmentAnalytics.programStats.map((p) => [
          p.programName,
          p.totalAssessments,
          p.totalSubmissions,
          p.passRate !== null ? `${p.passRate}%` : "—",
          p.avgScore !== null ? p.avgScore : "—",
          p.pendingGrading,
        ]);
        sections.push(
          renderTable(
            `Assessment Performance (Grading Backlog: ${platform.assessmentAnalytics.gradingBacklog})`,
            ["Program", "Assessments", "Submissions", "Pass Rate", "Avg Score", "Pending Grading"],
            assessmentRows,
            "No assessment data yet.",
          ),
        );
      }
    }

    if (scorecards.length > 0) {
      sections.push(
        renderTable(
          "Instructor Scorecard",
          ["Name", "Role", "Assessments", "Graded", "Turnaround (hrs)", "Avg Feedback (chars)", "Pass Rate"],
          scorecards.map((s) => [
            s.name,
            s.role,
            s.assessmentsCreated,
            s.submissionsGraded,
            s.avgTurnaroundHours ?? "—",
            s.avgFeedbackLength ?? "—",
            s.studentPassRate !== null ? `${s.studentPassRate}%` : "—",
          ]),
          "No instructor data yet.",
        ),
      );
    }

    sections.push(
      renderTable(
        "Monthly Revenue Tracking",
        ["Month", "Total", "Successful", "Failed"],
        paymentRows.map(([month, value]) => [
          month,
          `NGN ${value.total.toLocaleString()}`,
          `NGN ${value.successful.toLocaleString()}`,
          `NGN ${value.failed.toLocaleString()}`,
        ]),
        "No payment analytics yet.",
      ),
    );

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(reportTitle)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      color: #0f172a;
      background: #ffffff;
    }
    header { margin-bottom: 18px; }
    h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
    }
    .meta {
      margin-top: 6px;
      color: #475569;
      font-size: 12px;
    }
    .section {
      margin-top: 14px;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      break-inside: avoid;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #334155;
    }
    .cards {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #f8fafc;
    }
    .card .label {
      margin: 0;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .card .value {
      margin: 4px 0 0;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      padding: 8px 6px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    td.empty {
      color: #64748b;
      font-style: italic;
    }
    @media print {
      body { padding: 12mm; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(reportTitle)}</h1>
    <p class="meta">Range: ${escapeHtml(range.toUpperCase())} | Generated: ${escapeHtml(reportDate)}</p>
  </header>
  ${sections.join("")}
</body>
</html>`;

    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const frameWindow = printFrame.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      document.body.removeChild(printFrame);
      window.print();
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    frameWindow.setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      window.setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 800);
    }, 320);
  };

  const topRecommendations = useMemo<Recommendation[]>(() => {
    const list: Recommendation[] = [];
    if (!analytics) {
      return list;
    }

    if (analytics.platformAnalytics) {
      const highestRisk = analytics.platformAnalytics.riskAlerts[0];
      if (highestRisk && highestRisk.riskScore >= 5) {
        list.push({
          title: "Prioritize high-risk follow-up",
          detail: `${highestRisk.name} (${highestRisk.role}) is at risk score ${highestRisk.riskScore} with ${highestRisk.unreadMessages} unread messages.`,
          action: "Assign an admin check-in and clear unread backlog within 24 hours.",
          tone: "critical",
        });
      }

      const mid = Math.max(1, Math.floor(platformTrendPoints.length / 2));
      const revenueFirst = platformTrendPoints.slice(0, mid).reduce((sum, point) => sum + point.revenue, 0);
      const revenueSecond = platformTrendPoints.slice(mid).reduce((sum, point) => sum + point.revenue, 0);
      if (revenueSecond > revenueFirst * 1.05) {
        list.push({
          title: "Scale the current revenue momentum",
          detail: `Revenue improved from NGN ${Math.round(revenueFirst).toLocaleString()} to NGN ${Math.round(revenueSecond).toLocaleString()} in this period.`,
          action: "Repeat acquisition and payment follow-up campaigns from the strongest half.",
          tone: "opportunity",
        });
      } else if (revenueSecond < revenueFirst * 0.9) {
        list.push({
          title: "Stabilize payment performance",
          detail: `Revenue softened from NGN ${Math.round(revenueFirst).toLocaleString()} to NGN ${Math.round(revenueSecond).toLocaleString()}.`,
          action: "Trigger failed-payment recovery and review enrollment conversion touchpoints.",
          tone: "critical",
        });
      }

      const topProgram = analytics.platformAnalytics.programLeaderboard[0];
      if (topProgram) {
        list.push({
          title: "Replicate top program playbook",
          detail: `${topProgram.name} leads with ${topProgram.completionRate}% completion and NGN ${Math.round(topProgram.revenue).toLocaleString()} revenue.`,
          action: "Apply the same curriculum pacing and mentorship rhythm to lower-performing programs.",
          tone: "focus",
        });
      }

      // Grading backlog alert
      const backlog = analytics.platformAnalytics.assessmentAnalytics?.gradingBacklog ?? 0;
      if (backlog >= 5) {
        list.push({
          title: "Clear the grading backlog",
          detail: `${backlog} submission${backlog === 1 ? "" : "s"} are awaiting grading. Delayed feedback hurts learner progress.`,
          action: "Assign grading tasks to available instructors and aim to clear within 48 hours.",
          tone: "critical",
        });
      }

      // Low pass rate program alert
      const weakProgram = analytics.platformAnalytics.assessmentAnalytics?.programStats.find(
        (p) => p.passRate !== null && p.passRate < 60 && p.totalSubmissions >= 5,
      );
      if (weakProgram) {
        list.push({
          title: "Investigate low pass rate",
          detail: `${weakProgram.programName} has a ${weakProgram.passRate}% pass rate across ${weakProgram.totalSubmissions} submissions.`,
          action: "Review assessment difficulty, learner support resources, and instructor feedback quality.",
          tone: "critical",
        });
      }
    } else {
      if (analytics.userAnalytics.unreadMessages > 0) {
        list.push({
          title: "Clear communication backlog",
          detail: `You currently have ${analytics.userAnalytics.unreadMessages} unread messages.`,
          action: "Block 15 minutes to respond and remove pending blockers.",
          tone: analytics.userAnalytics.unreadMessages >= 8 ? "critical" : "focus",
        });
      }

      const mid = Math.max(1, Math.floor(userTrendPoints.length / 2));
      const loginFirst = userTrendPoints.slice(0, mid).reduce((sum, point) => sum + point.logins, 0);
      const loginSecond = userTrendPoints.slice(mid).reduce((sum, point) => sum + point.logins, 0);
      if (loginSecond < loginFirst) {
        list.push({
          title: "Get back to consistent activity",
          detail: `Login activity dropped from ${loginFirst} to ${loginSecond} across this window.`,
          action: "Set fixed daily check-in slots to protect consistency.",
          tone: "focus",
        });
      }

      if (analytics.userAnalytics.upcomingMeetings === 0) {
        list.push({
          title: "Plan upcoming learning sessions",
          detail: "No upcoming meetings are currently scheduled.",
          action: "Schedule at least one meeting for continuity this week.",
          tone: "opportunity",
        });
      }
    }

    const fallback: Recommendation[] = [
      {
        title: "Keep analytics review cadence weekly",
        detail: "Performance stays stable when trend shifts are reviewed before they compound.",
        action: "Create a 20-minute weekly review ritual with your core team.",
        tone: "focus",
      },
      {
        title: "Convert insight into one clear task",
        detail: "Dashboards are strongest when each review ends with a concrete execution step.",
        action: "Assign one owner and deadline to each key signal.",
        tone: "opportunity",
      },
      {
        title: "Protect intervention speed",
        detail: "Response speed to risk alerts has outsized impact on learner outcomes.",
        action: "Escalate any high-risk profile within one business day.",
        tone: "critical",
      },
    ];

    const unique = new Set<string>();
    const merged = [...list, ...fallback].filter((item) => {
      if (unique.has(item.title)) {
        return false;
      }
      unique.add(item.title);
      return true;
    });

    return merged.slice(0, 3);
  }, [analytics, platformTrendPoints, userTrendPoints]);

  return (
    <div className="space-y-4 max-[360px]:space-y-3">
      <section className="kat-card relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_40%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Analytics Focus</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Switch analysis window to compare short-term vs long-term behavior.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {headlineSignals.map((signal) => (
              <span key={signal} className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-300">
                {signal}
              </span>
            ))}
          </div>
        </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select value={range} onValueChange={(value) => setRange(value as RangeValue)}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800 px-3 text-sm text-slate-700 dark:text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-200 sm:w-40">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto" position="popper" side="bottom" align="start" sideOffset={6}>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-center gap-2 print:hidden sm:w-auto"
              onClick={exportOverviewCsv}
              disabled={!analytics}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-center gap-2 print:hidden sm:w-auto"
              onClick={exportPdf}
              disabled={!analytics}
            >
              <Printer className="size-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </section>

      <section className="kat-card">
        <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">Top 3 Recommendations</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Priority actions auto-generated from current analytics signals.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
          {loading || !analytics
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-1 h-3 w-[90%]" />
                  <Skeleton className="mt-3 h-3 w-[80%]" />
                </div>
              ))
            : topRecommendations.map((item) => (
                <div key={item.title} className={cn("rounded-xl border p-3", recommendationToneClass(item.tone))}>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{item.detail}</p>
                  <p className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200">{item.action}</p>
                </div>
              ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading || !analytics
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="kat-card space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))
          : [
              { label: "Logins (30d)", value: analytics.userAnalytics.loginStats30d },
              { label: primaryActivityLabel, value: analytics.userAnalytics.assessmentsSubmitted },
              { label: "Unread Messages", value: analytics.userAnalytics.unreadMessages },
              { label: "Upcoming Meetings", value: analytics.userAnalytics.upcomingMeetings },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                className="kat-card bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/60"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <p className="text-sm text-slate-600 dark:text-slate-400">{item.label}</p>
                <p className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-semibold text-slate-900 dark:text-slate-100">
                  {item.value}
                </p>
              </motion.div>
            ))}
      </section>

      <section className="kat-card">
        <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">My Activity Trend</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Daily movement across communication, learning, and attendance.</p>
        {loading || !analytics ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full" />
            ))}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TrendMiniCard
              title="Logins"
              subtitle={`${range.toUpperCase()} activity`}
              points={userTrendPoints}
              colorClass="bg-blue-500"
              getValue={(point) => point.logins}
            />
            <TrendMiniCard
              title="Messages Received"
              subtitle="Incoming message volume"
              points={userTrendPoints}
              colorClass="bg-cyan-500"
              getValue={(point) => point.messagesReceived}
            />
            <TrendMiniCard
              title={primaryActivityLabel}
              subtitle="Role activity volume"
              points={userTrendPoints}
              colorClass="bg-emerald-500"
              getValue={(point) => point.submissions}
            />
            <TrendMiniCard
              title="Meeting Joins"
              subtitle="Attendance activity"
              points={userTrendPoints}
              colorClass="bg-amber-500"
              getValue={(point) => point.meetingsJoined}
            />
          </div>
        )}
      </section>

      {analytics?.platformAnalytics ? (
        <>
          <section className="kat-card">
            <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">Platform Metrics</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Enrollments</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {analytics.platformAnalytics.enrollmentCount}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">Revenue</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  NGN {Number(analytics.platformAnalytics.totalRevenue).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">Activity Events (7d)</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {analytics.platformAnalytics.activityEvents7d}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(analytics.platformAnalytics.roleBreakdown).map(([role, count]) => (
                <div key={role} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{role}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{count}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="kat-card">
            <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">Organization Trend</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Daily pulse for growth, revenue, and communication output.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <TrendMiniCard
                title="New Enrollments"
                subtitle={`${range.toUpperCase()} acquisition`}
                points={platformTrendPoints}
                colorClass="bg-violet-500"
                getValue={(point) => point.newEnrollments}
              />
              <TrendMiniCard
                title="Revenue"
                subtitle="Successful payment inflow"
                points={platformTrendPoints}
                colorClass="bg-emerald-500"
                getValue={(point) => point.revenue}
                formatValue={(value) => `NGN ${Math.round(value).toLocaleString()}`}
              />
              <TrendMiniCard
                title="Activity Events"
                subtitle="Tracked institution events"
                points={platformTrendPoints}
                colorClass="bg-sky-500"
                getValue={(point) => point.activityEvents}
              />
              <TrendMiniCard
                title="Messages Sent"
                subtitle="Conversation throughput"
                points={platformTrendPoints}
                colorClass="bg-amber-500"
                getValue={(point) => point.messagesSent}
              />
            </div>
          </section>

          {analytics.platformAnalytics.assessmentAnalytics && (
            <section className="kat-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold max-[360px]:text-base">Assessment Performance</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-[360px]:text-xs">
                    Pass rates and submission activity per program.
                  </p>
                </div>
                {analytics.platformAnalytics.assessmentAnalytics.gradingBacklog > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2">
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {analytics.platformAnalytics.assessmentAnalytics.gradingBacklog} pending grading
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">across all programs</span>
                  </div>
                )}
              </div>
              <div className="mt-3 overflow-x-auto overflow-y-auto pb-1">
                <table className="min-w-[720px] w-full text-sm max-[360px]:text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="pb-2">Program</th>
                      <th className="pb-2">Assessments</th>
                      <th className="pb-2">Submissions</th>
                      <th className="pb-2">Pass Rate</th>
                      <th className="pb-2">Avg Score</th>
                      <th className="pb-2">Pending Grading</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {analytics.platformAnalytics.assessmentAnalytics.programStats.length === 0 ? (
                      <tr>
                        <td className="py-3 text-slate-600 dark:text-slate-400" colSpan={6}>No assessment data yet.</td>
                      </tr>
                    ) : (
                      analytics.platformAnalytics.assessmentAnalytics.programStats.map((prog) => (
                        <tr key={prog.programId}>
                          <td className="py-3 font-medium">{prog.programName}</td>
                          <td className="py-3">{prog.totalAssessments}</td>
                          <td className="py-3">{prog.totalSubmissions}</td>
                          <td className="py-3">
                            {prog.passRate === null ? (
                              <span className="text-slate-400 dark:text-slate-500">—</span>
                            ) : (
                              <div className="flex min-w-[110px] items-center gap-2">
                                <div className="flex-1">
                                  <PercentageBar
                                    value={prog.passRate}
                                    colorClass={prog.passRate >= 75 ? "bg-emerald-500" : prog.passRate >= 60 ? "bg-amber-500" : "bg-rose-500"}
                                  />
                                </div>
                                <span className={cn("text-xs font-semibold", prog.passRate >= 75 ? "text-emerald-700 dark:text-emerald-400" : prog.passRate >= 60 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400")}>
                                  {prog.passRate}%
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3">
                            {prog.avgScore === null ? <span className="text-slate-400 dark:text-slate-500">—</span> : prog.avgScore}
                          </td>
                          <td className="py-3">
                            {prog.pendingGrading > 0 ? (
                              <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                {prog.pendingGrading}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 text-xs">All graded</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="kat-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold max-[360px]:text-base">Risk & Attention Queue</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-[360px]:text-xs">
                    Learners/instructors likely needing intervention based on unread load and inactivity.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-center gap-2 print:hidden sm:w-auto"
                  onClick={exportRiskCsv}
                >
                  <Download className="size-4" />
                  Export
                </Button>
              </div>
              <div className="mt-3 overflow-x-auto overflow-y-auto pb-1 max-[360px]:max-h-[38dvh]">
                <table className="min-w-[900px] w-full text-sm max-[360px]:text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="pb-2 max-[360px]:pb-1.5">Name</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Role</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Unread</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Last Login</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Overdue</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Pass %</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Last Submit</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {analytics.platformAnalytics.riskAlerts.length === 0 ? (
                      <tr>
                        <td className="py-3 text-slate-600 dark:text-slate-400 max-[360px]:py-2" colSpan={8}>
                          No urgent attention signals right now.
                        </td>
                      </tr>
                    ) : (
                      analytics.platformAnalytics.riskAlerts.map((alert) => (
                        <tr key={alert.userId}>
                          <td className="py-3 max-[360px]:py-2">{alert.name}</td>
                          <td className="py-3 text-xs uppercase text-slate-600 dark:text-slate-400 max-[360px]:py-2 max-[360px]:text-[10px]">{alert.role}</td>
                          <td className="py-3 max-[360px]:py-2">{alert.unreadMessages}</td>
                          <td className="py-3 max-[360px]:py-2">{formatLastLogin(alert.lastLoginDaysAgo)}</td>
                          <td className="py-3 max-[360px]:py-2">
                            {alert.overdueAssessments > 0 ? (
                              <span className="font-semibold text-rose-600 dark:text-rose-400">{alert.overdueAssessments}</span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3 max-[360px]:py-2">
                            {alert.passRate === null ? (
                              <span className="text-slate-400 dark:text-slate-500">—</span>
                            ) : (
                              <span className={cn("font-semibold", alert.passRate < 60 ? "text-rose-600 dark:text-rose-400" : alert.passRate < 75 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                                {alert.passRate}%
                              </span>
                            )}
                          </td>
                          <td className="py-3 max-[360px]:py-2">
                            {alert.daysSinceLastSubmission === null ? (
                              <span className="text-slate-400 dark:text-slate-500">—</span>
                            ) : (
                              <span className={alert.daysSinceLastSubmission >= 14 ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"}>
                                {alert.daysSinceLastSubmission === 0 ? "Today" : `${alert.daysSinceLastSubmission}d ago`}
                              </span>
                            )}
                          </td>
                          <td className="py-3 max-[360px]:py-2">
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", riskBadgeClass(alert.riskScore))}>
                              {alert.riskScore}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="kat-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold max-[360px]:text-base">Cohort Leaderboard</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-[360px]:text-xs">Completion + attendance quality ranked across cohorts.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-center gap-2 print:hidden sm:w-auto"
                  onClick={exportCohortCsv}
                >
                  <Download className="size-4" />
                  Export
                </Button>
              </div>
              <div className="mt-3 overflow-x-auto overflow-y-auto pb-1 max-[360px]:max-h-[38dvh]">
                <table className="min-w-[760px] w-full text-sm max-[360px]:text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="pb-2 max-[360px]:pb-1.5">Cohort</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Program</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Complete %</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Attendance %</th>
                      <th className="pb-2 max-[360px]:pb-1.5">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {analytics.platformAnalytics.cohortLeaderboard.length === 0 ? (
                      <tr>
                        <td className="py-3 text-slate-600 dark:text-slate-400 max-[360px]:py-2" colSpan={5}>
                          No cohort analytics yet.
                        </td>
                      </tr>
                    ) : (
                      analytics.platformAnalytics.cohortLeaderboard.map((cohort) => (
                        <tr key={cohort.cohortId}>
                          <td className="py-3 max-[360px]:py-2">{cohort.name}</td>
                          <td className="py-3 max-[360px]:py-2">{cohort.programName}</td>
                          <td className="py-3 max-[360px]:py-2">
                            <div className="flex min-w-[120px] items-center gap-2 sm:min-w-[130px]">
                              <div className="flex-1">
                                <PercentageBar value={cohort.completionRate} colorClass="bg-emerald-500" />
                              </div>
                              <span className="text-xs text-slate-600 dark:text-slate-400">{cohort.completionRate}%</span>
                            </div>
                          </td>
                          <td className="py-3 max-[360px]:py-2">
                            <div className="flex min-w-[120px] items-center gap-2 sm:min-w-[130px]">
                              <div className="flex-1">
                                <PercentageBar value={cohort.meetingAttendanceRate} colorClass="bg-sky-500" />
                              </div>
                              <span className="text-xs text-slate-600 dark:text-slate-400">{cohort.meetingAttendanceRate}%</span>
                            </div>
                          </td>
                          <td className="py-3 max-[360px]:py-2">NGN {cohort.revenue.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="kat-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold max-[360px]:text-base">Program Leaderboard</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-[360px]:text-xs">Program outcomes ranked by completion quality and revenue.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full justify-center gap-2 print:hidden sm:w-auto"
                onClick={exportProgramCsv}
              >
                <Download className="size-4" />
                Export
              </Button>
            </div>
            <div className="mt-3 overflow-x-auto overflow-y-auto pb-1 max-[360px]:max-h-[38dvh]">
              <table className="min-w-[760px] w-full text-sm max-[360px]:text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="pb-2 max-[360px]:pb-1.5">Program</th>
                    <th className="pb-2 max-[360px]:pb-1.5">Enrollments</th>
                    <th className="pb-2 max-[360px]:pb-1.5">Completed</th>
                    <th className="pb-2 max-[360px]:pb-1.5">Completion %</th>
                    <th className="pb-2 max-[360px]:pb-1.5">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {analytics.platformAnalytics.programLeaderboard.length === 0 ? (
                    <tr>
                      <td className="py-3 text-slate-600 dark:text-slate-400 max-[360px]:py-2" colSpan={5}>
                        No program analytics yet.
                      </td>
                    </tr>
                  ) : (
                    analytics.platformAnalytics.programLeaderboard.map((program) => (
                      <tr key={program.programId}>
                        <td className="py-3 max-[360px]:py-2">{program.name}</td>
                        <td className="py-3 max-[360px]:py-2">{program.enrollments}</td>
                        <td className="py-3 max-[360px]:py-2">{program.completed}</td>
                        <td className="py-3 max-[360px]:py-2">
                          <div className="flex min-w-[120px] items-center gap-2 sm:min-w-[130px]">
                            <div className="flex-1">
                              <PercentageBar value={program.completionRate} colorClass="bg-indigo-500" />
                            </div>
                            <span className="text-xs text-slate-600 dark:text-slate-400">{program.completionRate}%</span>
                          </div>
                        </td>
                        <td className="py-3 max-[360px]:py-2">NGN {program.revenue.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {analytics?.scope === "platform" && scorecards.length > 0 && (
        <section className="kat-card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold max-[360px]:text-base">Instructor Scorecard</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-[360px]:text-xs">
                Grading performance, feedback quality, and learner pass rates per instructor/fellow.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-center gap-2 print:hidden sm:w-auto"
              onClick={exportScorecardCsv}
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>
          <div className="mt-3 overflow-x-auto overflow-y-auto pb-1">
            <table className="min-w-[760px] w-full text-sm max-[360px]:text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="pb-2 max-[360px]:pb-1.5">Instructor</th>
                  <th className="pb-2 max-[360px]:pb-1.5">Role</th>
                  <th className="pb-2 max-[360px]:pb-1.5">Created</th>
                  <th className="pb-2 max-[360px]:pb-1.5">Graded</th>
                  <th className="pb-2 max-[360px]:pb-1.5">Avg Turnaround</th>
                  <th className="pb-2 max-[360px]:pb-1.5">Avg Feedback</th>
                  <th className="pb-2 max-[360px]:pb-1.5">Pass Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {scorecards.map((s) => (
                  <tr key={s.instructorId}>
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100 max-[360px]:py-2">{s.name}</td>
                    <td className="py-3 text-xs uppercase text-slate-600 dark:text-slate-400 max-[360px]:py-2 max-[360px]:text-[10px]">{s.role}</td>
                    <td className="py-3 max-[360px]:py-2">{s.assessmentsCreated}</td>
                    <td className="py-3 max-[360px]:py-2">{s.submissionsGraded}</td>
                    <td className="py-3 max-[360px]:py-2">
                      {s.avgTurnaroundHours === null ? (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      ) : (
                        <span className={cn("font-semibold", s.avgTurnaroundHours <= 24 ? "text-emerald-700 dark:text-emerald-400" : s.avgTurnaroundHours <= 72 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400")}>
                          {s.avgTurnaroundHours < 24
                            ? `${s.avgTurnaroundHours}h`
                            : `${round1(s.avgTurnaroundHours / 24)}d`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 max-[360px]:py-2">
                      {s.avgFeedbackLength === null ? (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      ) : (
                        <span className={cn("font-semibold", s.avgFeedbackLength >= 100 ? "text-emerald-700 dark:text-emerald-400" : s.avgFeedbackLength >= 40 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400")}>
                          {s.avgFeedbackLength} chars
                        </span>
                      )}
                    </td>
                    <td className="py-3 max-[360px]:py-2">
                      {s.studentPassRate === null ? (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      ) : (
                        <div className="flex min-w-[110px] items-center gap-2">
                          <div className="flex-1">
                            <PercentageBar
                              value={s.studentPassRate}
                              colorClass={s.studentPassRate >= 75 ? "bg-emerald-500" : s.studentPassRate >= 60 ? "bg-amber-500" : "bg-rose-500"}
                            />
                          </div>
                          <span className={cn("text-xs font-semibold", s.studentPassRate >= 75 ? "text-emerald-700 dark:text-emerald-400" : s.studentPassRate >= 60 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400")}>
                            {s.studentPassRate}%
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="kat-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100 max-[360px]:text-base">Monthly Revenue Tracking</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full justify-center gap-2 print:hidden sm:w-auto"
            onClick={exportRevenueCsv}
          >
            <Download className="size-4" />
            Export
          </Button>
        </div>
        <div className="mt-3 overflow-x-auto overflow-y-auto pb-1 max-[360px]:max-h-[34dvh]">
          <table className="min-w-[620px] w-full text-sm max-[360px]:text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="pb-2 max-[360px]:pb-1.5">Month</th>
                <th className="pb-2 max-[360px]:pb-1.5">Total</th>
                <th className="pb-2 max-[360px]:pb-1.5">Successful</th>
                <th className="pb-2 max-[360px]:pb-1.5">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paymentRows.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-600 dark:text-slate-400 max-[360px]:py-2" colSpan={4}>
                    No payment analytics yet.
                  </td>
                </tr>
              ) : (
                paymentRows.map(([month, value]) => (
                  <tr key={month}>
                    <td className="py-3 max-[360px]:py-2">{month}</td>
                    <td className="py-3 max-[360px]:py-2">NGN {value.total.toLocaleString()}</td>
                    <td className="py-3 text-emerald-700 dark:text-emerald-400 max-[360px]:py-2">NGN {value.successful.toLocaleString()}</td>
                    <td className="py-3 text-rose-700 dark:text-rose-400 max-[360px]:py-2">NGN {value.failed.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
