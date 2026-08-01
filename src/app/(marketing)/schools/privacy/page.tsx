// DRAFT, PENDING LEGAL REVIEW. This is a starting point grounded in KAT's real
// architecture and the NDPA 2023 / NDPR. Before publishing, a Nigerian data-protection
// lawyer must review it, and every [bracketed placeholder] must be completed (registered
// entity, NDPC registration, DPO). See the school terms and DPA pages alongside this one.
import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "../../../legal-layout";

export const metadata: Metadata = {
  title: "School Privacy Notice. KAT for Schools",
  description:
    "How Kindle a Techie processes personal data on behalf of schools that license the KAT curriculum, under the Nigeria Data Protection Act 2023.",
};

const sections: LegalSection[] = [
  {
    id: "our-role",
    title: "Our role: processor, not controller",
    body: (
      <>
        <p>
          When a school licenses the KAT curriculum for its pupils, the <strong>school is the data
          controller</strong> for the personal data of its pupils and staff. It decides what
          data is collected and why. <strong>Kindle a Techie is a data processor</strong>: we process
          that data only to deliver the service, and only on the school&rsquo;s documented
          instructions.
        </p>
        <p>
          This is different from our consumer service, where a parent enrols a single child directly
          and we act as controller. That relationship is covered by our{" "}
          <a href="/privacy">consumer Privacy Policy</a>, which does <strong>not</strong> apply to
          school pupils. The full processor terms for schools are set out in our{" "}
          <a href="/schools/dpa">Data Processing Agreement</a>, which forms part of every school
          licence.
        </p>
      </>
    ),
  },
  {
    id: "who-this-covers",
    title: "Who this notice covers",
    body: (
      <ul>
        <li><strong>School staff</strong>, the administrators and teachers a school gives access to.</li>
        <li><strong>Rostered pupils</strong>, the children a school enrols on the platform through its roster.</li>
      </ul>
    ),
  },
  {
    id: "data-we-process",
    title: "What data we process for your school",
    body: (
      <>
        <h3>Staff accounts</h3>
        <ul>
          <li>Name, email address, and school role (administrator or teacher)</li>
          <li>Password, stored only as a one-way bcrypt hash, we cannot read it</li>
        </ul>
        <h3>Pupil records</h3>
        <ul>
          <li>The identifier the school assigns, held as an opaque reference. We do not put a
            pupil&rsquo;s name or email in URLs, query strings, or logs.</li>
          <li>The minimum roster fields the school supplies to place a pupil (such as first name,
            class, and year), no more than the school chooses to send.</li>
          <li>Learning activity: lesson progress, assessment submissions and scores, capstone
            project files, module completion, and certificates earned.</li>
        </ul>
        <h3>Technical data</h3>
        <ul>
          <li>Session cookies that keep signed-in users authenticated (see our{" "}
            <a href="/cookies">Cookie Policy</a>)</li>
          <li>Basic server logs (IP address, request timestamps) retained for security</li>
          <li>Bot-protection signals on sign-in, processed by Cloudflare Turnstile (see Sub-processors)</li>
        </ul>
        <p>
          Pupil billing data is <strong>not</strong> collected: schools are invoiced per seat, so we
          process a school&rsquo;s billing-contact details, never a pupil&rsquo;s or a parent&rsquo;s
          payment information.
        </p>
      </>
    ),
  },
  {
    id: "why-we-process",
    title: "Why we process it",
    body: (
      <>
        <p>We process school data for one purpose: to deliver the curriculum service the school has licensed. Concretely, to:</p>
        <ul>
          <li>Create and secure staff and pupil accounts</li>
          <li>Deliver lessons, assessments, and projects, and record progress</li>
          <li>Give the school&rsquo;s own teachers and administrators visibility into their pupils</li>
          <li>Keep the platform secure and prevent abuse</li>
        </ul>
        <p>
          We do <strong>not</strong> sell school or pupil data, use it for advertising, or use it for
          our own purposes. We do not combine a school&rsquo;s pupil data with our consumer service.
        </p>
      </>
    ),
  },
  {
    id: "childrens-data",
    title: "Children’s data",
    body: (
      <>
        <p>
          Under the Nigeria Data Protection Act 2023 (NDPA), a child is a person under 18, and
          processing a child&rsquo;s data requires the consent of a parent or guardian. Because the
          school is the controller, <strong>obtaining and recording that parental consent is the
          school&rsquo;s responsibility</strong>. We process pupil data on the school&rsquo;s
          instruction and rely on the school&rsquo;s confirmation that it has the necessary consent.
        </p>
        <p>We build for data minimisation for children by design:</p>
        <ul>
          <li>Pupils are addressed by an opaque reference, never by name or email in URLs or logs.</li>
          <li>A pupil&rsquo;s name or work is never shown on any public page unless a parental-consent
            flag has been recorded for that pupil.</li>
          <li>Pupil records are deactivated rather than hard-deleted, so a child&rsquo;s progress and
            certificates are not silently destroyed. The school can instruct erasure (see Retention).</li>
        </ul>
      </>
    ),
  },
  {
    id: "sub-processors",
    title: "Sub-processors",
    body: (
      <>
        <p>
          We use a small set of vetted infrastructure providers to run the service. Each processes
          data only to provide its function to us, under contract. Current sub-processors:
        </p>
        <ul>
          <li><strong>Neon</strong>, managed PostgreSQL database hosting (the primary data store)</li>
          <li><strong>Cloudflare R2</strong>, file storage for pupil project uploads (private buckets, access-controlled)</li>
          <li><strong>Cloudflare</strong>, edge network, bot protection (Turnstile), and per-school embed framing</li>
          <li><strong>Paystack</strong>, processing of school invoice payments (billing-contact data only)</li>
          <li><strong>Upstash</strong>, rate limiting</li>
          <li><strong>Sentry</strong>, error monitoring (may incidentally process technical data such as IP)</li>
          <li>Our email provider, transactional email (invitations, password resets, notices)</li>
          <li><strong>Google</strong>, only where a staff user chooses to sign in with Google</li>
          <li>Self-hosted Jitsi / Jibri, only where a school uses live video sessions</li>
        </ul>
        <p>
          We maintain a current list and give the school advance notice before adding or replacing a
          sub-processor, so it can object, as required by our{" "}
          <a href="/schools/dpa">Data Processing Agreement</a>.
        </p>
      </>
    ),
  },
  {
    id: "international-transfers",
    title: "International data transfers",
    body: (
      <p>
        Some sub-processors above host data outside Nigeria. Where that happens, we transfer data
        only under the safeguards required by Part IX of the NDPA, relying on the provider&rsquo;s
        contractual data-protection commitments and, where applicable, an adequacy determination by
        the Nigeria Data Protection Commission (NDPC). The school, as controller, remains responsible
        for the lawful basis of any transfer it instructs.
      </p>
    ),
  },
  {
    id: "retention-deletion",
    title: "Retention and deletion",
    body: (
      <ul>
        <li>We retain school data for as long as the school&rsquo;s licence is active.</li>
        <li>A pupil who leaves is deactivated by default, preserving their record, unless the school
          instructs deletion.</li>
        <li>On termination of the licence, we return or delete the school&rsquo;s data on request,
          within the period set out in the Data Processing Agreement, save where law requires us to
          retain specific records (for example, payment records for tax purposes).</li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "How we protect the data",
    body: (
      <ul>
        <li>All traffic is encrypted in transit over HTTPS.</li>
        <li>Passwords are stored only as one-way bcrypt hashes. Session tokens are HTTP-only,
          Secure cookies.</li>
        <li>Pupil project files are stored in private Cloudflare R2 buckets and served only through
          access-controlled URLs.</li>
        <li>Every request for a school&rsquo;s data is scoped to that school and checked against the
          requesting user&rsquo;s membership and role, so one school can never read another&rsquo;s
          data. This isolation is enforced in code and covered by an automated authorisation test.</li>
        <li>Payment webhooks are verified with an HMAC signature before any action is taken.</li>
        <li>Access is rate-limited and errors are monitored so we can detect and respond to abuse.</li>
      </ul>
    ),
  },
  {
    id: "data-subject-rights",
    title: "Pupil and staff rights",
    body: (
      <p>
        The NDPA gives data subjects rights to access, correct, delete, restrict, port, or object to
        the processing of their data, and to withdraw consent. Because the school is the controller,
        <strong> those rights are exercised through the school</strong>. A parent, pupil, or staff
        member should contact their school; the school can act directly in the platform or ask us to
        assist, and we will support the school promptly, as set out in the Data Processing Agreement.
      </p>
    ),
  },
  {
    id: "breaches",
    title: "Data breaches",
    body: (
      <p>
        If we become aware of a personal data breach affecting a school&rsquo;s data, we notify the
        school without undue delay so that the school, as controller, can meet its NDPA obligation to
        notify the NDPC (and affected individuals where required) within 72 hours. We provide the
        information the school reasonably needs to make that notification.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact and data protection queries",
    body: (
      <>
        <p>
          For any data protection question about the school service, contact{" "}
          <a href="mailto:hello@kindleatechie.com">hello@kindleatechie.com</a>.
        </p>
        <p>
          Controller and processor details for the record:
        </p>
        <ul>
          <li><strong>Processor:</strong> Kindle a Techie Technologies Limited (RC 9411414)</li>
          <li><strong>Registered office:</strong> On file with the Corporate Affairs Commission (Nigeria), available to licensed schools on request; notices may be sent to <a href="mailto:hello@kindleatechie.com">hello@kindleatechie.com</a>.</li>
          <li><strong>Data Protection Officer:</strong> Onyishi James, <a href="mailto:james@kindleatechie.com">james@kindleatechie.com</a></li>
          <li><strong>NDPC registration:</strong> [NDPC data controller/processor registration number, once registered]</li>
        </ul>
      </>
    ),
  },
];

export default function SchoolPrivacyPage() {
  return (
    <LegalLayout
      eyebrow="KAT for Schools"
      title="School Privacy Notice"
      updated="July 2026"
      intro={
        <p>
          This notice explains how Kindle a Techie handles personal data for schools that license the
          KAT curriculum. It reflects our role as a <strong>data processor</strong> under the Nigeria
          Data Protection Act 2023, working on the instructions of the school, which is the data
          controller for its pupils and staff.
        </p>
      }
      sections={sections}
      schoolHost
    />
  );
}
