import type { Metadata } from "next";
import { LegalLayout } from "../legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy — KAT Learning",
  description: "How KAT Learning collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Privacy Policy"
      updated="March 2026"
    >
      <p>
        Kindle a Techie (&ldquo;KAT Learning&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates
        the KAT Learning platform at <strong>kindleatechie.com</strong>. This policy explains what
        personal data we collect, why we collect it, and how we protect it. We take the privacy of
        children and families seriously.
      </p>

      <h2>1. Who this policy covers</h2>
      <p>
        This policy applies to all users of the KAT Learning platform: parents, students (ages 8–19),
        instructors, fellows, and administrators. Where a user is under 18, a parent or guardian
        must register on their behalf and consents to this policy on their child&rsquo;s behalf.
      </p>

      <h2>2. Data we collect</h2>
      <h3>Account information</h3>
      <ul>
        <li>Full name and email address (required at registration)</li>
        <li>Password (stored as a one-way bcrypt hash — we cannot read it)</li>
        <li>User role (Parent, Student, Instructor, Fellow, Admin)</li>
        <li>Profile picture (optional — stored securely in Cloudflare R2)</li>
      </ul>
      <h3>Academic data</h3>
      <ul>
        <li>Class attendance records</li>
        <li>Assignment and assessment submissions and scores</li>
        <li>Project files and portfolio links</li>
        <li>Mentor feedback and notes</li>
        <li>Badges and certificates earned</li>
      </ul>
      <h3>Payment data</h3>
      <ul>
        <li>Enrollment and billing records (plan, amount, date)</li>
        <li>Card details are <strong>never stored by us</strong> — all payments are processed by
          Paystack and subject to their privacy policy</li>
      </ul>
      <h3>Communication data</h3>
      <ul>
        <li>Messages sent through the in-platform messaging system</li>
        <li>Meeting attendance and recording metadata (via Jitsi Meet / Jibri)</li>
      </ul>
      <h3>Technical data</h3>
      <ul>
        <li>Session tokens (stored as HTTP-only cookies — see our Cookie Policy)</li>
        <li>Basic server logs (IP address, request timestamps) retained for security purposes</li>
      </ul>

      <h2>3. How we use your data</h2>
      <ul>
        <li>To create and manage your account</li>
        <li>To deliver live classes, assignments, and mentor sessions</li>
        <li>To give parents visibility into their child&rsquo;s progress</li>
        <li>To process enrollment payments and issue receipts</li>
        <li>To send transactional emails (enrollment confirmation, password reset, cohort updates)</li>
        <li>To ensure platform security and prevent abuse</li>
      </ul>
      <p>We do not sell your data. We do not use your data for advertising.</p>

      <h2>4. Children&rsquo;s privacy</h2>
      <p>
        KAT Learning serves students as young as 8 years old. We collect only the minimum data
        necessary to deliver education and give parents visibility. All student accounts are linked
        to a parent account. Parents can request a copy of their child&rsquo;s data or ask for it
        to be deleted at any time by contacting us.
      </p>

      <h2>5. Third parties we share data with</h2>
      <ul>
        <li><strong>Paystack</strong> — payment processing (enrollment billing and receipts)</li>
        <li><strong>Jitsi Meet</strong> — live class video sessions (self-hosted)</li>
        <li><strong>Cloudflare R2</strong> — file storage (avatars and project uploads)</li>
        <li><strong>Neon (PostgreSQL)</strong> — our hosted database provider</li>
      </ul>
      <p>
        All third-party providers are contractually bound to protect your data and may not use it
        for their own purposes.
      </p>

      <h2>6. Data retention</h2>
      <p>
        We retain account data for as long as your account is active. If you close your account,
        we delete personal data within 30 days, except where we are legally required to retain it
        (e.g., payment records for tax purposes, which are kept for 7 years).
      </p>

      <h2>7. Your rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Request a copy of the data we hold about you</li>
        <li>Ask us to correct inaccurate data</li>
        <li>Ask us to delete your data (subject to legal retention obligations)</li>
        <li>Withdraw consent for optional data uses at any time</li>
      </ul>
      <p>
        To exercise any of these rights, email{" "}
        <a href="mailto:support@kindleatechie.com">support@kindleatechie.com</a>.
      </p>

      <h2>8. Security</h2>
      <p>
        Passwords are hashed with bcrypt. Session tokens are HTTP-only cookies transmitted over
        HTTPS. File uploads are stored in private Cloudflare R2 buckets. We review our security
        practices regularly.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We will notify registered users by email of any material changes to this policy before they
        take effect.
      </p>

      <h2>10. Contact</h2>
      <p>
        <a href="mailto:support@kindleatechie.com">support@kindleatechie.com</a>
        <br />
        Kindle a Techie · kindleatechie.com
      </p>
    </LegalLayout>
  );
}
