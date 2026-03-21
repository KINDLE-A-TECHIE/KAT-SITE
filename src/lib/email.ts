import "server-only";
import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const transport = createTransport();

  if (!transport) {
    console.warn(
      "[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). " +
      "Email was not sent to:",
      options.to,
    );
    return false;
  }

  const from =
    process.env.SMTP_FROM ??
    `KAT Learning <${process.env.SMTP_USER ?? "noreply@kindleatechie.com"}>`;

  await transport.sendMail({ from, ...options });
  return true;
}

// ── Shared layout ─────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
// Use LOGO_PNG_URL env var for a publicly accessible PNG (SVGs are blocked by most email clients).
// e.g. set LOGO_PNG_URL=https://pub-xxx.r2.dev/brand/kat-logo.png
const LOGO_PNG_URL = process.env.LOGO_PNG_URL ?? null;
const YEAR = new Date().getFullYear();

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KAT Learning</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Brand header -->
          <tr>
            <td style="padding:0 0 28px;text-align:center;">
              ${LOGO_PNG_URL
                ? `<img src="${LOGO_PNG_URL}" alt="KAT Learning" width="36" height="36"
                        style="display:inline-block;vertical-align:middle;margin-right:10px;" />`
                : ""}
              <span style="font-size:17px;font-weight:700;color:#0f172a;vertical-align:middle;letter-spacing:-0.02em;">
                KAT Learning
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

              <!-- Top accent bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td height="3" style="background:linear-gradient(90deg,#1E5FAF 0%,#4DB3E6 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Content -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:40px 40px 44px;">
                    ${content}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;line-height:1.6;">
                © ${YEAR} KAT Learning &nbsp;·&nbsp;
                <a href="https://kindleatechie.com" style="color:#94a3b8;text-decoration:none;">kindleatechie.com</a>
              </p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;">
                If you didn&apos;t expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function primaryButton(href: string, label: string) {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
      <tr>
        <td style="border-radius:10px;background:linear-gradient(90deg,#1E5FAF,#4DB3E6);">
          <a href="${href}"
             style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:14px;
                    font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function ghostButton(href: string, label: string) {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
      <tr>
        <td style="border-radius:10px;border:1px solid #e2e8f0;">
          <a href="${href}"
             style="display:inline-block;padding:12px 28px;color:#1E5FAF;font-size:14px;
                    font-weight:600;text-decoration:none;border-radius:10px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function infoRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:9px 14px;font-size:12px;font-weight:600;color:#64748b;
                 background:#f8fafc;border-bottom:1px solid #f1f5f9;
                 white-space:nowrap;text-transform:uppercase;letter-spacing:0.06em;
                 width:30%;">${label}</td>
      <td style="padding:9px 14px;font-size:14px;color:#0f172a;
                 border-bottom:1px solid #f1f5f9;">${value}</td>
    </tr>`;
}

function badge(text: string, color: string) {
  return `<span style="display:inline-block;padding:3px 10px;background:${color};
                border-radius:999px;font-size:11px;font-weight:600;
                letter-spacing:0.04em;">${text}</span>`;
}

function sectionLabel(text: string) {
  return `<p style="margin:24px 0 10px;font-size:10px;font-weight:700;color:#94a3b8;
                    text-transform:uppercase;letter-spacing:0.12em;">${text}</p>`;
}

// ── Password Reset ────────────────────────────────────────────────────────────

export function buildPasswordResetEmail(opts: { firstName: string; resetUrl: string }) {
  const html = emailWrapper(`
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
      Reset your password
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${opts.firstName}, we received a request to reset your KAT Learning password.
      Use the button below to choose a new one. This link expires in <strong>1 hour</strong>.
    </p>
    ${primaryButton(opts.resetUrl, "Reset My Password →")}
    ${sectionLabel("Or paste this link into your browser")}
    <p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all;
              padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      ${opts.resetUrl}
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
      Didn&apos;t request this? Your password is safe — you can ignore this email.
    </p>
  `);

  return html;
}

// ── Parent Monthly Digest ─────────────────────────────────────────────────────

type ChildProgramDigest = {
  programName: string;
  submissionsLastMonth: number;
  avgScore: number | null;
  passRate: number | null;
};

type ChildDigest = {
  firstName: string;
  lastName: string;
  programs: ChildProgramDigest[];
  overdueAssessments: number;
  upcomingMeetings: number;
};

export function buildParentDigestEmail(opts: {
  parentFirstName: string;
  month: string;
  children: ChildDigest[];
}) {
  const dashboardUrl = `${BASE_URL}/dashboard/grades`;

  const childSections = opts.children
    .map((child) => {
      const hasActivity = child.programs.some((p) => p.submissionsLastMonth > 0);

      const programRows = child.programs
        .map(
          (p) => `
            <tr>
              <td style="padding:10px 4px;font-size:13px;color:#0f172a;border-bottom:1px solid #f8fafc;">
                ${p.programName}
              </td>
              <td style="padding:10px 4px;font-size:13px;color:#475569;text-align:center;border-bottom:1px solid #f8fafc;">
                ${p.submissionsLastMonth}
              </td>
              <td style="padding:10px 4px;font-size:13px;color:#475569;text-align:center;border-bottom:1px solid #f8fafc;">
                ${p.avgScore !== null ? `${p.avgScore} pts` : "—"}
              </td>
              <td style="padding:10px 4px;font-size:13px;text-align:center;font-weight:600;border-bottom:1px solid #f8fafc;
                         ${p.passRate !== null && p.passRate < 60 ? "color:#dc2626;" : "color:#16a34a;"}">
                ${p.passRate !== null ? `${p.passRate}%` : "—"}
              </td>
            </tr>`,
        )
        .join("");

      const tableOrEmpty = hasActivity
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-radius:8px;overflow:hidden;border:1px solid #f1f5f9;">
             <thead>
               <tr style="background:#f8fafc;">
                 <th style="padding:8px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;text-align:left;">Programme</th>
                 <th style="padding:8px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;text-align:center;">Submissions</th>
                 <th style="padding:8px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;text-align:center;">Avg Score</th>
                 <th style="padding:8px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;text-align:center;">Pass Rate</th>
               </tr>
             </thead>
             <tbody>${programRows}</tbody>
           </table>`
        : `<p style="margin:10px 0 0;font-size:13px;color:#94a3b8;font-style:italic;">No assessment activity this month.</p>`;

      const alerts: string[] = [];
      if (child.overdueAssessments > 0) {
        alerts.push(badge(
          `${child.overdueAssessments} overdue assessment${child.overdueAssessments > 1 ? "s" : ""}`,
          "#fef2f2;color:#dc2626;border:1px solid #fecaca;",
        ));
      }
      if (child.upcomingMeetings > 0) {
        alerts.push(badge(
          `${child.upcomingMeetings} upcoming meeting${child.upcomingMeetings > 1 ? "s" : ""}`,
          "#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;",
        ));
      }

      return `
        <div style="margin:0 0 16px;padding:18px 20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
          <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">
            ${child.firstName} ${child.lastName}
          </p>
          ${tableOrEmpty}
          ${alerts.length > 0 ? `<div style="margin-top:12px;display:flex;gap:6px;">${alerts.join(" ")}</div>` : ""}
        </div>`;
    })
    .join("");

  const html = emailWrapper(`
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;
              text-transform:uppercase;letter-spacing:0.12em;">${opts.month}</p>
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
      Monthly Progress Report
    </h2>
    <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${opts.parentFirstName}, here&apos;s a snapshot of your child&apos;s learning activity at
      KAT for <strong style="color:#0f172a;">${opts.month}</strong>. Keep it up!
    </p>
    ${childSections}
    ${primaryButton(dashboardUrl, "View Full Report →")}
  `);

  const text =
    `Monthly Progress Report — ${opts.month}\n\n` +
    `Hi ${opts.parentFirstName},\n\nHere is your child's KAT Learning activity for ${opts.month}.\n\n` +
    opts.children
      .map((child) => {
        const lines = child.programs
          .filter((p) => p.submissionsLastMonth > 0)
          .map(
            (p) =>
              `  - ${p.programName}: ${p.submissionsLastMonth} submission(s), avg ${p.avgScore ?? "—"} pts, pass rate ${p.passRate !== null ? p.passRate + "%" : "—"}`,
          )
          .join("\n");
        const alerts = [
          child.overdueAssessments > 0 ? `${child.overdueAssessments} overdue` : "",
          child.upcomingMeetings > 0 ? `${child.upcomingMeetings} upcoming meeting(s)` : "",
        ]
          .filter(Boolean)
          .join(", ");
        return (
          `${child.firstName} ${child.lastName}:\n` +
          (lines || "  No activity this month.") +
          (alerts ? `\n  Alerts: ${alerts}` : "")
        );
      })
      .join("\n\n") +
    `\n\nView full report: ${dashboardUrl}\n\n© ${YEAR} KAT Learning`;

  return { html, text };
}

// ── Fellow Approval ───────────────────────────────────────────────────────────

export function buildFellowApprovalEmail(opts: {
  firstName: string;
  cohortName?: string;
  reviewNotes?: string | null;
}) {
  const loginUrl = `${BASE_URL}/login`;
  const dashboardUrl = `${BASE_URL}/dashboard`;

  const cohortLine = opts.cohortName
    ? `<p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">
        You&apos;ve been placed in <strong style="color:#0f172a;">${opts.cohortName}</strong>.
        Your cohort schedule and assigned students will be visible on your dashboard.
       </p>`
    : "";

  const notesLine = opts.reviewNotes
    ? `<div style="margin:0 0 20px;padding:14px 16px;background:#f0fdf4;border-left:3px solid #22c55e;
                   border-radius:0 8px 8px 0;">
         <p style="margin:0;font-size:13px;color:#166534;font-style:italic;">&ldquo;${opts.reviewNotes}&rdquo;</p>
       </div>`
    : "";

  const html = emailWrapper(`
    <p style="margin:0 0 6px;font-size:28px;">🎉</p>
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
      You&apos;re in, ${opts.firstName}!
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
      Your application to the <strong style="color:#0f172a;">KAT Learning Fellowship Programme</strong>
      has been approved. Your account has been upgraded to Fellow — welcome to the team.
    </p>
    ${cohortLine}
    ${notesLine}
    ${sectionLabel("What happens next")}
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:4px;">
      ${[
        "Log in with your existing email and password — your role has already been updated.",
        "Your dashboard now shows your Fellow view, including assigned students and cohort schedules.",
        "Start mentoring students and leading sessions from day one.",
      ].map((step, i) => `
        <tr>
          <td style="width:28px;vertical-align:top;padding:4px 12px 12px 0;">
            <div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#1E5FAF,#4DB3E6);
                        text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#fff;">
              ${i + 1}
            </div>
          </td>
          <td style="padding:4px 0 12px;font-size:14px;color:#475569;line-height:1.6;">${step}</td>
        </tr>`).join("")}
    </table>
    ${primaryButton(loginUrl, "Go to My Dashboard →")}
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      Direct link: <a href="${dashboardUrl}" style="color:#1E5FAF;text-decoration:none;">${dashboardUrl}</a>
    </p>
  `);

  const text = `Congratulations, ${opts.firstName}!\n\nYour KAT Learning fellowship application has been approved.\n\nLog in: ${loginUrl}\n\n© ${YEAR} KAT Learning`;

  return { html, text };
}

// ── Fellow Rejection ──────────────────────────────────────────────────────────

export function buildFellowRejectionEmail(opts: {
  firstName: string;
  reviewNotes?: string | null;
}) {
  const applyUrl = `${BASE_URL}/dashboard/fellows/apply`;

  const notesLine = opts.reviewNotes
    ? `<div style="margin:0 0 20px;padding:14px 16px;background:#fff7ed;border-left:3px solid #f97316;
                   border-radius:0 8px 8px 0;">
         <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#9a3412;
                   text-transform:uppercase;letter-spacing:0.08em;">Reviewer feedback</p>
         <p style="margin:0;font-size:13px;color:#9a3412;font-style:italic;">&ldquo;${opts.reviewNotes}&rdquo;</p>
       </div>`
    : "";

  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
      Fellowship Application Update
    </h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${opts.firstName}, thank you for putting yourself forward for the KAT Fellowship Programme.
      After careful review, we&apos;re not able to move your application forward at this time.
    </p>
    ${notesLine}
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">
      This isn&apos;t the end of the road. Every cohort is a new opportunity — keep building,
      keep shipping, and apply again when the next one opens. We&apos;re rooting for you.
    </p>
    ${ghostButton(applyUrl, "View My Application")}
  `);

  const text = `Hi ${opts.firstName},\n\nThank you for applying to the KAT Fellowship. After review, we're unable to approve your application at this time.\n${opts.reviewNotes ? `\nFeedback: ${opts.reviewNotes}\n` : ""}\nKeep learning — you can re-apply in a future cohort.\n\nView application: ${applyUrl}\n\n© ${YEAR} KAT Learning`;

  return { html, text };
}

// ── Payment Reminder ──────────────────────────────────────────────────────────

export type PaymentReminderKind = "due_soon" | "grace_started" | "suspended";

export function buildPaymentReminderEmail(opts: {
  parentFirstName: string;
  childFirstName: string;
  programName: string;
  dueDate: string;
  amount: number;
  currency: string;
  kind: PaymentReminderKind;
  payUrl: string;
}) {
  function formatAmount() {
    if (opts.currency === "NGN") return "₦" + opts.amount.toLocaleString("en-NG");
    return `${opts.currency} ${opts.amount.toLocaleString()}`;
  }

  const kindConfig: Record<
    PaymentReminderKind,
    { subject: string; headline: string; body: string; accentColor: string; badgeText: string; badgeBg: string }
  > = {
    due_soon: {
      subject: `Payment due in 3 days — ${opts.childFirstName}'s ${opts.programName}`,
      headline: "Payment due in 3 days",
      body: `${opts.childFirstName}&apos;s enrolment in <strong style="color:#0f172a;">${opts.programName}</strong> renews on <strong style="color:#0f172a;">${opts.dueDate}</strong>. Pay before the due date to keep their learning uninterrupted.`,
      accentColor: "#1E5FAF",
      badgeText: "DUE SOON",
      badgeBg: "#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;",
    },
    grace_started: {
      subject: `Grace period started — ${opts.childFirstName}'s ${opts.programName}`,
      headline: "4-day grace period has started",
      body: `${opts.childFirstName}&apos;s enrolment in <strong style="color:#0f172a;">${opts.programName}</strong> expired on <strong style="color:#0f172a;">${opts.dueDate}</strong>. You have <strong>4 days</strong> to pay before access is suspended.`,
      accentColor: "#D97706",
      badgeText: "GRACE PERIOD",
      badgeBg: "#fffbeb;color:#b45309;border:1px solid #fde68a;",
    },
    suspended: {
      subject: `Access suspended — ${opts.childFirstName}'s ${opts.programName}`,
      headline: "Enrolment suspended",
      body: `${opts.childFirstName}&apos;s access to <strong style="color:#0f172a;">${opts.programName}</strong> has been suspended due to an outstanding payment. Pay now to restore access immediately.`,
      accentColor: "#DC2626",
      badgeText: "SUSPENDED",
      badgeBg: "#fef2f2;color:#dc2626;border:1px solid #fecaca;",
    },
  };

  const cfg = kindConfig[opts.kind];

  const html = emailWrapper(`
    <div style="margin:0 0 20px;">${badge(cfg.badgeText, cfg.badgeBg)}</div>
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;text-transform:capitalize;">
      ${cfg.headline}
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${opts.parentFirstName}, ${cfg.body}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:8px;">
      <tbody>
        ${infoRow("Programme", opts.programName)}
        ${infoRow("Amount due", formatAmount())}
        ${infoRow("Due date", opts.dueDate)}
      </tbody>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
      <tr>
        <td style="border-radius:10px;background:${cfg.accentColor};">
          <a href="${opts.payUrl}"
             style="display:inline-block;padding:13px 36px;color:#ffffff;font-size:14px;
                    font-weight:600;text-decoration:none;border-radius:10px;">
            Pay Now →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
      Already paid? Verification can take a few minutes — no action needed.
    </p>
  `);

  return { html, subject: cfg.subject };
}

// ── External Fellow Application Confirmation ──────────────────────────────────

export function buildExternalFellowApplicationEmail(opts: {
  firstName: string;
  cohortName: string;
  programName: string;
  requiresPayment: boolean;
  fee: number | null;
}) {
  function formatNaira(amount: number) {
    return "₦" + amount.toLocaleString("en-NG", { minimumFractionDigits: 0 });
  }

  const feeNote =
    opts.requiresPayment && opts.fee !== null
      ? `<div style="margin:0 0 20px;padding:14px 16px;background:#f0fdf4;border-left:3px solid #22c55e;
                     border-radius:0 8px 8px 0;">
           <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
             An application fee of <strong>${formatNaira(opts.fee)}</strong> will be required if your
             application is approved. We&apos;ll send full payment and onboarding details at that point.
           </p>
         </div>`
      : "";

  return emailWrapper(`
    <p style="margin:0 0 6px;font-size:26px;">✅</p>
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
      Application received
    </h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${opts.firstName}, we&apos;ve received your application for the
      <strong style="color:#0f172a;">${opts.cohortName}</strong> cohort of the
      <strong style="color:#0f172a;">${opts.programName}</strong> Fellowship Programme.
      Our team will review it and get back to you within a few business days.
    </p>
    ${feeNote}
    <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;line-height:1.6;">
      Questions? Reply to this email or write to us at
      <a href="mailto:hello@kindleatechie.com" style="color:#1E5FAF;text-decoration:none;">hello@kindleatechie.com</a>.
    </p>
  `);
}

// ── Partner Enquiry Notification (internal) ───────────────────────────────────

export function buildPartnerEnquiryNotificationEmail(opts: {
  name: string;
  organization: string;
  type: string;
  email: string;
  phone?: string | null;
  message: string;
}) {
  const html = emailWrapper(`
    <div style="margin:0 0 20px;">${badge("NEW ENQUIRY", "#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;")}</div>
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
      Partnership Enquiry
    </h2>
    <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;">
      Submitted via kindleatechie.com/partners
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <tbody>
        ${infoRow("Name", opts.name)}
        ${infoRow("Organisation", opts.organization)}
        ${infoRow("Type", opts.type)}
        ${infoRow("Email", `<a href="mailto:${opts.email}" style="color:#1E5FAF;text-decoration:none;">${opts.email}</a>`)}
        ${opts.phone ? infoRow("Phone", opts.phone) : ""}
      </tbody>
    </table>
    ${sectionLabel("Message")}
    <div style="padding:16px 18px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
      <p style="margin:0;font-size:14px;color:#475569;line-height:1.75;">
        ${opts.message.replace(/\n/g, "<br/>")}
      </p>
    </div>
    ${primaryButton(`mailto:${opts.email}`, `Reply to ${opts.name} →`)}
  `);

  const text =
    `New Partnership Enquiry\n\n` +
    `Name: ${opts.name}\n` +
    `Organisation: ${opts.organization}\n` +
    `Type: ${opts.type}\n` +
    `Email: ${opts.email}\n` +
    (opts.phone ? `Phone: ${opts.phone}\n` : "") +
    `\nMessage:\n${opts.message}\n`;

  return { html, text };
}

// ── Project Status Notification ────────────────────────────────────────────────

export function buildProjectStatusEmail(opts: {
  firstName: string;
  projectTitle: string;
  status: "APPROVED" | "NEEDS_WORK" | "REJECTED";
  feedback?: string;
  projectUrl: string;
}) {
  const configs = {
    APPROVED: {
      badgeText: "PROJECT APPROVED",
      badgeColor: "#f0fdf4;color:#166534;border:1px solid #bbf7d0;",
      heading: "Your project has been approved! 🎉",
      body: `Great work, <strong>${opts.firstName}</strong>! Your project <strong>&ldquo;${opts.projectTitle}&rdquo;</strong> has been reviewed and approved by your instructor.`,
      buttonLabel: "View Your Project →",
    },
    NEEDS_WORK: {
      badgeText: "REVISION REQUESTED",
      badgeColor: "#fffbeb;color:#92400e;border:1px solid #fde68a;",
      heading: "Your project needs a few changes",
      body: `Hi <strong>${opts.firstName}</strong>, your instructor has reviewed <strong>&ldquo;${opts.projectTitle}&rdquo;</strong> and left some feedback for you. Address the notes and resubmit when ready.`,
      buttonLabel: "View Feedback →",
    },
    REJECTED: {
      badgeText: "PROJECT NOT APPROVED",
      badgeColor: "#fef2f2;color:#991b1b;border:1px solid #fecaca;",
      heading: "Your project was not approved",
      body: `Hi <strong>${opts.firstName}</strong>, your project <strong>&ldquo;${opts.projectTitle}&rdquo;</strong> was reviewed and could not be approved at this time. Please read the feedback below and reach out if you have questions.`,
      buttonLabel: "View Project →",
    },
  };

  const cfg = configs[opts.status];

  const html = emailWrapper(`
    <div style="margin:0 0 20px;">${badge(cfg.badgeText, cfg.badgeColor)}</div>
    <h2 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
      ${cfg.heading}
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
      ${cfg.body}
    </p>
    ${opts.feedback ? `
      ${sectionLabel("Instructor feedback")}
      <div style="padding:16px 18px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:8px;">
        <p style="margin:0;font-size:14px;color:#334155;line-height:1.75;">
          ${opts.feedback.replace(/\n/g, "<br/>")}
        </p>
      </div>
    ` : ""}
    ${primaryButton(opts.projectUrl, cfg.buttonLabel)}
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
      Questions? Reply to this email or write to
      <a href="mailto:hello@kindleatechie.com" style="color:#1E5FAF;text-decoration:none;">hello@kindleatechie.com</a>.
    </p>
  `);

  const statusLabel = { APPROVED: "approved", NEEDS_WORK: "needs revision", REJECTED: "not approved" }[opts.status];
  const text =
    `Hi ${opts.firstName},\n\n` +
    `Your project "${opts.projectTitle}" has been reviewed and marked as: ${statusLabel}.\n\n` +
    (opts.feedback ? `Instructor feedback:\n${opts.feedback}\n\n` : "") +
    `View your project: ${opts.projectUrl}\n\n` +
    `© ${YEAR} KAT Learning`;

  return { html, text };
}

