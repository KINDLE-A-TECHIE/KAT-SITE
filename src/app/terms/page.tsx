import type { Metadata } from "next";
import { LegalLayout } from "../legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service — KAT Learning",
  description: "The terms that govern your use of the KAT Learning platform.",
};

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Terms of Service"
      updated="March 2026"
    >
      <p>
        By registering for or using the KAT Learning platform (&ldquo;the Platform&rdquo;) operated
        by Kindle a Techie (&ldquo;we&rdquo;, &ldquo;us&rdquo;), you agree to these terms. Please
        read them carefully. If you are registering on behalf of a child, you accept these terms on
        their behalf.
      </p>

      <h2>1. Eligibility and accounts</h2>
      <ul>
        <li>
          Student accounts are for learners aged <strong>8 to 19</strong>. A parent or guardian
          must register the account and remains responsible for their child&rsquo;s use of the platform.
        </li>
        <li>
          You are responsible for keeping your login credentials secure. Do not share your password
          with anyone.
        </li>
        <li>
          You must provide accurate information at registration. Accounts created with false information
          may be suspended.
        </li>
      </ul>

      <h2>2. Enrollment and payment</h2>
      <ul>
        <li>
          Enrollment is activated after successful payment. Access is granted immediately upon
          payment confirmation.
        </li>
        <li>
          Billing is monthly per track. You may cancel at any time; your access continues until
          the end of the current billing period.
        </li>
        <li>
          Payments are processed by Paystack. We do not store card details.
        </li>
        <li>
          Refunds are reviewed on a case-by-case basis. Contact{" "}
          <a href="mailto:support@kindleatechie.com">support@kindleatechie.com</a> within 7 days
          of a charge if you believe there has been an error.
        </li>
        <li>
          Scholarship spots are limited and awarded at our discretion. Receiving a scholarship in
          one cohort does not guarantee one in the next.
        </li>
      </ul>

      <h2>3. Platform use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Share your account or class access with anyone outside your enrolled household</li>
        <li>Record, redistribute, or publish live class sessions without written permission</li>
        <li>Upload content that is harmful, abusive, or inappropriate — especially given that
          children use this platform</li>
        <li>Attempt to access parts of the platform you are not authorised to use</li>
        <li>Use the platform for any commercial purpose without our written consent</li>
      </ul>

      <h2>4. Content and intellectual property</h2>
      <ul>
        <li>
          Curriculum materials, videos, and platform content remain the intellectual property of
          Kindle a Techie.
        </li>
        <li>
          Projects and portfolio work created by students belong to the students. By submitting
          work to the platform, students grant us a limited licence to display it within the
          platform (e.g., on a student profile or in a showcase) — nothing more.
        </li>
      </ul>

      <h2>5. Code of conduct</h2>
      <p>
        KAT Learning is a safe learning environment for children and teens. All users — students,
        parents, instructors, and fellows — are expected to treat one another with respect. We
        reserve the right to suspend or remove any account that engages in bullying, harassment,
        hate speech, or any behaviour that harms other users.
      </p>

      <h2>6. Fellowship programme</h2>
      <ul>
        <li>Fellowship applications are reviewed independently for each cohort.</li>
        <li>
          Fellows who are current KAT students apply at no cost. External applicants pay a
          one-time application fee that is non-refundable regardless of the outcome.
        </li>
        <li>
          Being accepted as a Fellow does not constitute employment. Fellows are volunteer mentors
          who benefit from the experience, credentials, and community.
        </li>
      </ul>

      <h2>7. Availability and changes</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted access. We may update
        features, pricing, or these terms at any time. Material changes will be communicated by
        email at least 14 days before taking effect. Continued use of the platform after that
        date constitutes acceptance.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the extent permitted by law, Kindle a Techie is not liable for indirect or consequential
        losses arising from your use of the platform. Our total liability in any 12-month period is
        limited to the amount you paid us during that period.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes will
        be resolved in the courts of Nigeria.
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
