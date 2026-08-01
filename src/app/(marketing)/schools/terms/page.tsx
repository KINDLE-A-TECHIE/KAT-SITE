// DRAFT, PENDING LEGAL REVIEW. Starting point grounded in KAT's real per-seat/per-term
// licensing model and the NDPA 2023. A Nigerian lawyer must review before publishing, and
// every [bracketed placeholder] must be completed. Pairs with the school privacy notice and DPA.
import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "../../../legal-layout";

export const metadata: Metadata = {
  title: "School Terms of Service. KAT for Schools",
  description:
    "The terms under which a school licenses the KAT curriculum: seats, per-term billing, acceptable use, and data protection.",
};

const sections: LegalSection[] = [
  {
    id: "parties-and-service",
    title: "Parties and the service",
    body: (
      <>
        <p>
          These terms are an agreement between <strong>Kindle a Techie</strong> (&ldquo;KAT&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;) and the <strong>school</strong> that licenses the
          service (&ldquo;you&rdquo;, &ldquo;the School&rdquo;). By confirming a seat count for a
          term, or by using the platform, the School accepts these terms. The person accepting
          confirms they are authorised to bind the School.
        </p>
        <p>
          The service is the KAT &ldquo;Coding &amp; Robotics Curriculum-in-a-Box&rdquo;: a
          NERDC-aligned digital-technologies curriculum, delivered on our platform by the
          School&rsquo;s own teachers to its own pupils.
        </p>
      </>
    ),
  },
  {
    id: "licence-and-seats",
    title: "Licence and seats",
    body: (
      <ul>
        <li>We grant the School a non-exclusive, non-transferable licence to use the curriculum and
          platform for the number of pupil <strong>seats</strong> it has licensed for a given term.</li>
        <li>Access is active only while the School holds a valid licence for the current term and its
          number of enrolled pupils does not exceed its seat limit.</li>
        <li>The licence is for the School&rsquo;s own pupils and staff. It may not be resold,
          sublicensed, or shared with another institution.</li>
      </ul>
    ),
  },
  {
    id: "fees-and-billing",
    title: "Fees and billing",
    body: (
      <ul>
        <li>Fees are charged <strong>per seat, per term</strong>. The School confirms its seat count
          for a term, and we issue an invoice for that term.</li>
        <li>Payment is made through Paystack. A term&rsquo;s access is activated once payment for that
          term&rsquo;s invoice is confirmed.</li>
        <li>Seat counts and fees are set per term. We are not a monthly consumer subscription and the
          consumer billing terms do not apply to schools.</li>
        <li>Invoices are due by the date stated on them. We may suspend access for a term whose
          invoice remains unpaid after its due date, after reasonable notice.</li>
      </ul>
    ),
  },
  {
    id: "roster-and-accounts",
    title: "Your roster and accounts",
    body: (
      <ul>
        <li>The School provides and maintains its own roster of pupils and staff. The School is
          responsible for the accuracy of that roster and for removing users who should no longer
          have access.</li>
        <li>The School is responsible for keeping staff credentials secure and for the activity of
          accounts it creates.</li>
        <li>Staff roles (administrator, teacher) are school-scoped. They grant authority only within
          the School&rsquo;s own tenant, never over another school&rsquo;s pupils or data.</li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>The School and its users agree not to:</p>
        <ul>
          <li>Share access with anyone outside the School&rsquo;s licensed staff and pupils</li>
          <li>Copy, redistribute, or resell the curriculum, lessons, or platform content</li>
          <li>Upload content that is unlawful, harmful, or inappropriate, given that children use the platform</li>
          <li>Attempt to access data or areas the user is not authorised to use, including another school&rsquo;s data</li>
          <li>Probe, scan, or interfere with the security or integrity of the platform</li>
        </ul>
      </>
    ),
  },
  {
    id: "pupils-and-consent",
    title: "Pupils and parental consent",
    body: (
      <p>
        Pupils are children. As the data controller, the School is responsible for having a lawful
        basis to enrol each pupil, which under the NDPA means obtaining and recording the consent of
        each pupil&rsquo;s parent or guardian. The School confirms it holds that consent for every
        pupil it rosters. We will not display a pupil&rsquo;s name or work publicly unless a
        parental-consent flag has been recorded for that pupil. How we handle pupil data is set out
        in the <a href="/schools/privacy">School Privacy Notice</a> and the{" "}
        <a href="/schools/dpa">Data Processing Agreement</a>.
      </p>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    body: (
      <ul>
        <li>The curriculum, lessons, assessments, and platform remain the intellectual property of
          Kindle a Techie. The School receives a licence to use them for the term, nothing more.</li>
        <li>Work created by a pupil belongs to that pupil (and, as applicable, the School). By using
          the platform, the School grants us only the limited licence needed to store and display
          that work within the platform to the School&rsquo;s own staff and, where consent is
          recorded, in a showcase.</li>
      </ul>
    ),
  },
  {
    id: "data-protection",
    title: "Data protection",
    body: (
      <p>
        Our handling of personal data for the School is governed by the{" "}
        <a href="/schools/dpa">Data Processing Agreement</a> and the{" "}
        <a href="/schools/privacy">School Privacy Notice</a>, both of which form part of these terms.
        The School is the controller and Kindle a Techie is the processor. In the event of any
        conflict on data protection matters, the Data Processing Agreement prevails.
      </p>
    ),
  },
  {
    id: "availability-and-support",
    title: "Availability and support",
    body: (
      <p>
        We aim for high availability but do not guarantee uninterrupted access. We may update
        features and curriculum content to keep the service current and NERDC-aligned. We provide
        support to School administrators at{" "}
        <a href="mailto:hello@kindleatechie.com">hello@kindleatechie.com</a>.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the extent permitted by law, Kindle a Techie is not liable for indirect or consequential
        losses arising from use of the platform. Our total liability to the School in any 12-month
        period is limited to the fees the School paid us in that period. Nothing in these terms
        limits liability that cannot be limited by law, including our obligations under the NDPA.
      </p>
    ),
  },
  {
    id: "term-and-termination",
    title: "Term, termination, and data return",
    body: (
      <ul>
        <li>These terms run for as long as the School holds an active licence.</li>
        <li>Either party may decline to renew for a following term. We may suspend or terminate for a
          material breach that is not remedied after reasonable notice.</li>
        <li>On termination, we return or delete the School&rsquo;s data as set out in the Data
          Processing Agreement. Deactivated pupil records are retained, not destroyed, unless the
          School instructs deletion.</li>
      </ul>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms. We will give School administrators at least [notice period, for
        example 30 days] notice of material changes by email before they take effect. Continued use
        after that date constitutes acceptance.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria, and any disputes
        will be resolved in the courts of Nigeria.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        <a href="mailto:hello@kindleatechie.com">hello@kindleatechie.com</a>
        <br />
        Kindle a Techie Technologies Limited (RC 9411414)
        <br />
        Registered office on file with the Corporate Affairs Commission (available on request)
      </p>
    ),
  },
];

export default function SchoolTermsPage() {
  return (
    <LegalLayout
      eyebrow="KAT for Schools"
      title="School Terms of Service"
      updated="July 2026"
      intro={
        <p>
          These terms govern a school&rsquo;s licence to the KAT curriculum: how seats and per-term
          billing work, acceptable use, intellectual property, and how data protection is handled.
          They sit alongside the <a href="/schools/privacy">School Privacy Notice</a> and the{" "}
          <a href="/schools/dpa">Data Processing Agreement</a>.
        </p>
      }
      sections={sections}
      schoolHost
    />
  );
}
