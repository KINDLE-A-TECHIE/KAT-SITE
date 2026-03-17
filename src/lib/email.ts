import "server-only";
import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    // Return null so callers can log a warning instead of crashing.
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

// ── Templates ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KAT Learning</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;max-width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0D1F45 0%,#132B5E 45%,#1E5FAF 100%);padding:28px 32px;">
              <p style="margin:0;color:#93c5fd;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;">KAT Learning</p>
              <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">kindleatechie.com</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f1f5f9;padding:20px 32px;background:#f8fafc;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                © ${new Date().getFullYear()} KAT Learning · kindleatechie.com<br/>
                If you didn't expect this email, you can safely ignore it.
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

// ── Password Reset ────────────────────────────────────────────────────────────

export function buildPasswordResetEmail(opts: { firstName: string; resetUrl: string }) {
  const content = `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">Reset your password</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
      Hi ${opts.firstName}, we received a request to reset your KAT Learning password.
      Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${opts.resetUrl}"
         style="display:inline-block;background:#0D1F45;color:#ffffff;font-size:14px;font-weight:600;
                padding:12px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.02em;">
        Reset Password
      </a>
    </div>
    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 24px;font-size:11px;color:#94a3b8;word-break:break-all;">${opts.resetUrl}</p>
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      If you didn't request a password reset, you can safely ignore this email.
      Your password will remain unchanged.
    </p>
  `;
  return emailWrapper(content);
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
              <td style="padding:8px 4px;font-size:13px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${p.programName}</td>
              <td style="padding:8px 4px;font-size:13px;color:#475569;text-align:center;border-bottom:1px solid #f1f5f9;">${p.submissionsLastMonth}</td>
              <td style="padding:8px 4px;font-size:13px;color:#475569;text-align:center;border-bottom:1px solid #f1f5f9;">${p.avgScore !== null ? `${p.avgScore} pts` : "—"}</td>
              <td style="padding:8px 4px;font-size:13px;text-align:center;border-bottom:1px solid #f1f5f9;${p.passRate !== null && p.passRate < 60 ? "color:#dc2626;font-weight:600;" : "color:#475569;"}">${p.passRate !== null ? `${p.passRate}%` : "—"}</td>
            </tr>`,
        )
        .join("");

      const tableOrEmpty = hasActivity
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
             <thead>
               <tr>
                 <th style="padding:0 4px 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;text-align:left;">Program</th>
                 <th style="padding:0 4px 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;text-align:center;">Submissions</th>
                 <th style="padding:0 4px 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;text-align:center;">Avg Score</th>
                 <th style="padding:0 4px 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;text-align:center;">Pass Rate</th>
               </tr>
             </thead>
             <tbody>${programRows}</tbody>
           </table>`
        : `<p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">No assessment activity last month.</p>`;

      const alerts: string[] = [];
      if (child.overdueAssessments > 0) {
        alerts.push(
          `<span style="display:inline-block;margin-top:8px;padding:4px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:12px;color:#dc2626;font-weight:600;">${child.overdueAssessments} overdue assessment${child.overdueAssessments > 1 ? "s" : ""}</span>`,
        );
      }
      if (child.upcomingMeetings > 0) {
        alerts.push(
          `<span style="display:inline-block;margin-top:8px;padding:4px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;color:#1d4ed8;">${child.upcomingMeetings} upcoming meeting${child.upcomingMeetings > 1 ? "s" : ""}</span>`,
        );
      }

      return `
        <div style="margin:0 0 16px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${child.firstName} ${child.lastName}</p>
          ${tableOrEmpty}
          <div style="margin-top:4px;">${alerts.join(" ")}</div>
        </div>`;
    })
    .join("");

  const html = emailWrapper(`
    <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a;">Monthly Progress Report</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">${opts.month}</p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${opts.parentFirstName}, here is a summary of your child's academic activity at KAT Learning for <strong>${opts.month}</strong>.
    </p>
    ${childSections}
    <table cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <tr>
        <td style="border-radius:10px;background:#1E5FAF;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
            View Full Grades →
          </a>
        </td>
      </tr>
    </table>
  `);

  const text =
    `Monthly Progress Report — ${opts.month}\n\n` +
    `Hi ${opts.parentFirstName},\n\n` +
    `Here is a summary of your child's activity at KAT Learning.\n\n` +
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
    `\n\nView full grades: ${dashboardUrl}\n\n© ${new Date().getFullYear()} KAT Learning`;

  return { html, text };
}

export function buildFellowApprovalEmail(opts: {
  firstName: string;
  cohortName?: string;
  reviewNotes?: string | null;
}) {
  const loginUrl = `${BASE_URL}/login`;
  const dashboardUrl = `${BASE_URL}/dashboard`;

  const cohortLine = opts.cohortName
    ? `<p style="margin:0 0 12px;color:#475569;">You have been placed in <strong>${opts.cohortName}</strong>.</p>`
    : "";

  const notesLine = opts.reviewNotes
    ? `<p style="margin:0 0 16px;padding:12px 16px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:4px;font-size:14px;color:#166534;">
        <em>${opts.reviewNotes}</em>
       </p>`
    : "";

  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Congratulations, ${opts.firstName}! 🎉</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
      Your application to join the <strong>KAT Learning Fellowship Programme</strong> has been
      <strong style="color:#16a34a;">approved</strong>. Your account has been upgraded to Fellow.
    </p>
    ${cohortLine}
    ${notesLine}
    <p style="margin:0 0 8px;color:#475569;font-size:14px;font-weight:600;">What happens next?</p>
    <ul style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
      <li>Log in using your existing email and password.</li>
      <li>Your dashboard now reflects your Fellow role.</li>
      <li>You can begin mentoring students assigned to you.</li>
      <li>Check your dashboard for cohort schedules and assessments.</li>
    </ul>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="border-radius:10px;background:#1E5FAF;">
          <a href="${loginUrl}"
             style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
            Log in to Dashboard →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Or copy this link: <a href="${dashboardUrl}" style="color:#1E5FAF;">${dashboardUrl}</a>
    </p>
  `);

  const text = `Congratulations, ${opts.firstName}!

Your KAT Learning fellowship application has been approved. Your account has been upgraded to Fellow.

Log in here: ${loginUrl}

What's next:
- Log in with your existing credentials
- Your dashboard now shows your Fellow role
- Begin mentoring students assigned to you

© ${new Date().getFullYear()} KAT Learning`;

  return { html, text };
}

export function buildFellowRejectionEmail(opts: {
  firstName: string;
  reviewNotes?: string | null;
}) {
  const applyUrl = `${BASE_URL}/dashboard/fellows/apply`;

  const notesLine = opts.reviewNotes
    ? `<p style="margin:0 0 16px;padding:12px 16px;background:#fff7ed;border-left:3px solid #f97316;border-radius:4px;font-size:14px;color:#9a3412;">
        Reviewer feedback: <em>${opts.reviewNotes}</em>
       </p>`
    : "";

  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Fellowship Application Update</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
      Hi ${opts.firstName}, thank you for applying to the KAT Learning Fellowship Programme.
      After careful review, we were unable to approve your application at this time.
    </p>
    ${notesLine}
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      We encourage you to keep learning and apply again in a future cohort. Your progress
      as a student is valued and we look forward to seeing you grow.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="border-radius:10px;background:#f1f5f9;border:1px solid #e2e8f0;">
          <a href="${applyUrl}"
             style="display:inline-block;padding:12px 28px;color:#1E5FAF;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
            View My Application
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#94a3b8;">You can re-apply once your current application is closed.</p>
  `);

  const text = `Hi ${opts.firstName},

Thank you for applying to the KAT Learning Fellowship. After review, we were unable to approve your application at this time.
${opts.reviewNotes ? `\nFeedback: ${opts.reviewNotes}\n` : ""}
We encourage you to keep learning and apply again in a future cohort.

View your application: ${applyUrl}

© ${new Date().getFullYear()} KAT Learning`;

  return { html, text };
}

// ── Enrollment Payment Reminder ───────────────────────────────────────────────

export type PaymentReminderKind = "due_soon" | "grace_started" | "suspended";

export function buildPaymentReminderEmail(opts: {
  parentFirstName: string;
  childFirstName: string;
  programName: string;
  dueDate: string;         // human-readable e.g. "20 Mar 2026"
  amount: number;
  currency: string;
  kind: PaymentReminderKind;
  payUrl: string;
}) {
  function formatAmount() {
    if (opts.currency === "NGN") return "₦" + opts.amount.toLocaleString("en-NG");
    return `${opts.currency} ${opts.amount.toLocaleString()}`;
  }

  const kindConfig: Record<PaymentReminderKind, { subject: string; headline: string; body: string; accent: string }> = {
    due_soon: {
      subject: `Payment due in 3 days — ${opts.childFirstName}'s ${opts.programName} enrolment`,
      headline: "Payment Due in 3 Days",
      body: `${opts.childFirstName}'s enrolment in <strong>${opts.programName}</strong> is due for renewal on <strong>${opts.dueDate}</strong>. Please pay before the due date to avoid a disruption to their learning.`,
      accent: "#1E5FAF",
    },
    grace_started: {
      subject: `Grace period started — ${opts.childFirstName}'s ${opts.programName} enrolment`,
      headline: "4-Day Grace Period Has Started",
      body: `${opts.childFirstName}'s enrolment in <strong>${opts.programName}</strong> expired on <strong>${opts.dueDate}</strong>. You have <strong>4 days</strong> to pay before their access is suspended.`,
      accent: "#D97706",
    },
    suspended: {
      subject: `Enrolment suspended — ${opts.childFirstName}'s ${opts.programName}`,
      headline: "Enrolment Suspended",
      body: `${opts.childFirstName}'s access to <strong>${opts.programName}</strong> has been suspended due to non-payment. Pay now to restore access immediately.`,
      accent: "#DC2626",
    },
  };

  const cfg = kindConfig[opts.kind];

  const html = emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">${cfg.headline}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      Hi ${opts.parentFirstName}, ${cfg.body}
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <tr style="background:#f8fafc;">
        <td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Programme</td>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #e2e8f0;">${opts.programName}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#64748b;">Amount due</td>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#0f172a;">${formatAmount()}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${opts.payUrl}"
         style="display:inline-block;background:${cfg.accent};color:#ffffff;font-size:14px;font-weight:600;
                padding:12px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.02em;">
        Pay Now
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      If you have already paid, please allow a few minutes for verification to complete.
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

  const feeNote = opts.requiresPayment && opts.fee !== null
    ? `<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
        An application fee of <strong style="color:#0f172a;">${formatNaira(opts.fee)}</strong> will be required if your application is approved.
        We'll send you full payment and account setup details at that point.
       </p>`
    : "";

  return emailWrapper(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">Application Received!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      Hi ${opts.firstName}, thanks for applying to the <strong style="color:#0f172a;">${opts.cohortName}</strong>
      cohort of the <strong style="color:#0f172a;">${opts.programName}</strong> Fellowship Programme.
      Your application has been submitted and is now under review by our team.
    </p>
    ${feeNote}
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
      We'll be in touch via this email address with a decision. This usually takes a few business days.
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      If you have questions, reply to this email or contact us at support@kindleatechie.com.
    </p>
  `);
}
