// DRAFT, PENDING LEGAL REVIEW. A Data Processing Agreement about children's data is
// high-stakes: a Nigerian data-protection lawyer MUST review this before it is offered to
// any school, and every [bracketed placeholder] must be completed (registered entity, DPO,
// NDPC registration, retention periods). Grounded in KAT's real architecture and the NDPA 2023.
import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "../../../legal-layout";

export const metadata: Metadata = {
  title: "Data Processing Agreement. KAT for Schools",
  description:
    "The agreement under which Kindle a Techie processes pupil and staff personal data on behalf of a school, under the Nigeria Data Protection Act 2023.",
};

const sections: LegalSection[] = [
  {
    id: "roles-and-definitions",
    title: "Roles and definitions",
    body: (
      <>
        <p>
          This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of the School Terms of Service
          between the <strong>School</strong> and <strong>Kindle a Techie</strong> (&ldquo;KAT&rdquo;).
          It governs KAT&rsquo;s processing of personal data on the School&rsquo;s behalf and applies
          the terms of the Nigeria Data Protection Act 2023 (&ldquo;NDPA&rdquo;) and subsidiary
          regulation.
        </p>
        <ul>
          <li>The <strong>School is the data controller</strong>: it determines the purposes and means of processing the data of its pupils and staff.</li>
          <li><strong>KAT is the data processor</strong>: it processes that data only for the School and only on the School&rsquo;s documented instructions.</li>
          <li><strong>Data subjects</strong> are the School&rsquo;s pupils and staff.</li>
          <li>Terms such as personal data, processing, and personal data breach carry the meaning given in the NDPA.</li>
        </ul>
      </>
    ),
  },
  {
    id: "instructions",
    title: "Processing only on the School’s instructions",
    body: (
      <p>
        KAT processes personal data only to provide the licensed service and only on the
        School&rsquo;s documented instructions, including the instructions embodied in the platform&rsquo;s
        features and the School Terms of Service. KAT will not process the data for its own purposes,
        will not sell it, and will not use it for advertising. If KAT believes an instruction breaches
        the NDPA, it will inform the School.
      </p>
    ),
  },
  {
    id: "processing-details",
    title: "Details of the processing (Schedule A)",
    body: (
      <ul>
        <li><strong>Subject matter:</strong> delivery of the KAT curriculum service to the School.</li>
        <li><strong>Duration:</strong> for as long as the School holds an active licence, plus the return/deletion period below.</li>
        <li><strong>Nature and purpose:</strong> hosting, delivery of lessons and assessments, recording of learning progress, account management, and security.</li>
        <li><strong>Types of personal data:</strong> staff name, email, role, and hashed password; pupil roster identifiers and minimal roster fields; pupil learning activity (submissions, scores, projects, certificates); and technical data (session cookies, server logs, bot-protection signals).</li>
        <li><strong>Categories of data subjects:</strong> the School&rsquo;s pupils (children under 18) and its staff.</li>
        <li><strong>Special categories:</strong> none are required or requested by the service.</li>
      </ul>
    ),
  },
  {
    id: "confidentiality",
    title: "Confidentiality",
    body: (
      <p>
        KAT ensures that any person authorised to process the School&rsquo;s data is bound by an
        obligation of confidentiality and processes the data only as needed to provide the service.
      </p>
    ),
  },
  {
    id: "security-measures",
    title: "Security measures (Schedule B)",
    body: (
      <>
        <p>KAT maintains technical and organisational measures appropriate to the risk, including:</p>
        <ul>
          <li>Encryption of data in transit over HTTPS.</li>
          <li>Passwords stored only as one-way bcrypt hashes; session tokens as HTTP-only, Secure cookies.</li>
          <li>Pupil files stored in private object storage, served only through access-controlled URLs, with only storage keys held in the database.</li>
          <li><strong>Tenant isolation:</strong> every query for a school&rsquo;s data is scoped to that school and checked against the requesting user&rsquo;s membership and role, enforced in code and covered by an automated authorisation test, so one school cannot access another&rsquo;s data.</li>
          <li>Minimisation for children: pupils addressed by opaque reference; no pupil name or email in URLs, query strings, or logs; per-school framing restrictions for any embedded surface; no roster of minors on surfaces KAT does not control.</li>
          <li>Verification of payment webhooks by HMAC signature; protection against server-side request forgery on any school-supplied URL.</li>
          <li>Rate limiting and error monitoring to detect and respond to abuse.</li>
        </ul>
      </>
    ),
  },
  {
    id: "sub-processors",
    title: "Sub-processors (Schedule C)",
    body: (
      <>
        <p>
          The School authorises KAT to engage sub-processors to provide the service. Each is bound by
          data-protection terms no less protective than this DPA. Current sub-processors:
        </p>
        <ul>
          <li><strong>Neon</strong>, managed PostgreSQL database hosting</li>
          <li><strong>Cloudflare R2</strong>, file storage for pupil project uploads</li>
          <li><strong>Cloudflare</strong>, edge network, bot protection (Turnstile), per-school embed framing</li>
          <li><strong>Paystack</strong>, school invoice payment processing</li>
          <li><strong>Upstash</strong>, rate limiting</li>
          <li><strong>Sentry</strong>, error monitoring</li>
          <li>Email provider for transactional messages; Google for staff Google sign-in; self-hosted Jitsi / Jibri where a school uses live sessions</li>
        </ul>
        <p>
          KAT gives the School at least [notice period, for example 30 days] notice before adding or
          replacing a sub-processor. The School may object on reasonable data-protection grounds; if
          the parties cannot resolve the objection, the School may terminate the affected service.
        </p>
      </>
    ),
  },
  {
    id: "assisting-rights",
    title: "Assisting with data subject rights",
    body: (
      <p>
        Taking account of the nature of the processing, KAT assists the School by appropriate
        technical and organisational measures, so far as possible, to respond to requests from data
        subjects exercising their NDPA rights (access, rectification, erasure, restriction,
        portability, and objection). Where a data subject contacts KAT directly, KAT refers them to
        the School and does not respond substantively unless the School instructs it to.
      </p>
    ),
  },
  {
    id: "breach-notification",
    title: "Personal data breaches",
    body: (
      <p>
        KAT notifies the School without undue delay after becoming aware of a personal data breach
        affecting the School&rsquo;s data, and provides the information the School reasonably needs to
        meet its own NDPA obligation to notify the Nigeria Data Protection Commission (and affected
        data subjects where required) within 72 hours. KAT assists the School in investigating,
        mitigating, and remedying the breach.
      </p>
    ),
  },
  {
    id: "childrens-data",
    title: "Children’s data",
    body: (
      <p>
        The School warrants that it has obtained and recorded the consent of a parent or guardian for
        each pupil, as required by the NDPA for children under 18, and that it will not instruct
        processing beyond the scope of that consent. KAT applies the child-specific minimisation
        measures in Schedule B and will not display a pupil&rsquo;s identity or work publicly absent a
        recorded parental-consent flag.
      </p>
    ),
  },
  {
    id: "international-transfers",
    title: "International transfers",
    body: (
      <p>
        Where a sub-processor hosts data outside Nigeria, KAT transfers data only under the safeguards
        required by Part IX of the NDPA, relying on the sub-processor&rsquo;s contractual commitments
        and any applicable adequacy determination by the Nigeria Data Protection Commission. KAT makes
        the relevant details available to the School on request.
      </p>
    ),
  },
  {
    id: "audits",
    title: "Audits and demonstrating compliance",
    body: (
      <p>
        KAT makes available to the School the information reasonably necessary to demonstrate
        compliance with this DPA, and allows for and contributes to audits, including inspections, by
        the School or an auditor it mandates, on reasonable prior notice, no more than [frequency, for
        example once per year] except where required by the Commission or following a breach.
      </p>
    ),
  },
  {
    id: "return-and-deletion",
    title: "Return and deletion on termination",
    body: (
      <p>
        On termination of the licence, at the School&rsquo;s choice, KAT returns the School&rsquo;s
        data in a commonly used format and/or deletes it within [return/deletion period, for example
        60 days], except where law requires KAT to retain specific records (such as payment records
        for tax purposes), which KAT continues to protect under this DPA until it may lawfully delete
        them. Deactivated pupil records are retained during the licence and are returned or deleted on
        the same basis at termination.
      </p>
    ),
  },
  {
    id: "liability-and-precedence",
    title: "Liability, precedence, and changes",
    body: (
      <ul>
        <li>This DPA is subject to the limitations of liability in the School Terms of Service, save where the NDPA provides otherwise.</li>
        <li>On any conflict between this DPA and the School Terms of Service regarding data protection, this DPA prevails. The NDPA prevails over both.</li>
        <li>KAT may update this DPA to reflect changes in law or the service, on notice to the School; changes that materially reduce protection require the School&rsquo;s agreement.</li>
      </ul>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        <p>
          Data protection queries and instructions under this DPA:{" "}
          <a href="mailto:hello@kindleatechie.com">hello@kindleatechie.com</a>.
        </p>
        <ul>
          <li><strong>Processor:</strong> Kindle a Techie Technologies Limited (RC 9411414)</li>
          <li><strong>Registered office:</strong> On file with the Corporate Affairs Commission (Nigeria), available to licensed schools on request; notices may be sent to <a href="mailto:hello@kindleatechie.com">hello@kindleatechie.com</a>.</li>
          <li><strong>Data Protection Officer:</strong> Onyishi James, <a href="mailto:james@kindleatechie.com">james@kindleatechie.com</a></li>
          <li><strong>NDPC registration:</strong> [registration number, once registered]</li>
        </ul>
      </>
    ),
  },
];

export default function SchoolDpaPage() {
  return (
    <LegalLayout
      eyebrow="KAT for Schools"
      title="Data Processing Agreement"
      updated="July 2026"
      intro={
        <p>
          This agreement sets out how Kindle a Techie processes pupil and staff personal data on
          behalf of a school, as a <strong>processor</strong> acting on the school&rsquo;s
          instructions under the Nigeria Data Protection Act 2023. It forms part of every school
          licence and pairs with the <a href="/schools/terms">School Terms of Service</a> and{" "}
          <a href="/schools/privacy">School Privacy Notice</a>.
        </p>
      }
      sections={sections}
      schoolHost
    />
  );
}
