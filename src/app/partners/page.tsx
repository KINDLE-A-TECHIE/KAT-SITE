import type { ReactNode } from "react";
import type { Metadata } from "next";
import { LandingHeader } from "@/components/marketing/sections/landing-header";
import { SiteFooter } from "@/components/site-footer";
import { PartnerForm } from "./partner-form";
import { School, Building2, Landmark, Handshake, Code2, ShieldCheck, GraduationCap, Ticket } from "lucide-react";

export const metadata: Metadata = {
  title: "Partner with KAT Learning. Schools, Corporates & Government",
  description:
    "Bring world-class tech education to your students or workforce. KAT Learning partners with schools, corporate organisations, and government bodies across Africa.",
};

type PartnerCard = {
  icon: ReactNode;
  title: string;
  who: string;
  points: string[];
};

const PARTNER_TYPES: PartnerCard[] = [
  {
    icon: <School className="size-7 text-[var(--kat-clay)]" />,
    title: "Schools",
    who: "Primary and secondary schools, Primary 1 to SS3",
    points: [
      "NERDC-aligned Digital Technologies curriculum, a compulsory core subject, not an elective",
      "Delivered by your own teachers, no specialist to hire; the coding strand runs in a browser on the computers you have",
      "Lesson plans, slides and worksheets for digital literacy; a live platform for the coding strand",
      "Project-based assessment mapped to the SBA capstones at P6, BECE (JSS3) and WASSCE/NECO (SS3)",
      "Progress tracking, auto-graded assessments and capstone reviews in one place",
      "Licensed per seat, per term, run a pilot term before you commit",
    ],
  },
  {
    icon: <Building2 className="size-7 text-[var(--kat-clay)]" />,
    title: "Corporate Organisations",
    who: "Companies investing in community impact or staff families",
    points: [
      "Sponsored student seats under your brand",
      "CSR reporting dashboard with live enrolment data",
      "Co-branded graduation events and media coverage",
      "Talent pipeline into your internship programmes",
    ],
  },
  {
    icon: <Landmark className="size-7 text-[var(--kat-clay)]" />,
    title: "Government Bodies",
    who: "Ministries of Education, ICT agencies, and state governments",
    points: [
      "Scale across districts with one integration point",
      "Scholarship and bursary management built-in",
      "Detailed impact reports for policy documentation",
      "Alignment with national digital economy strategies",
    ],
  },
];

export default function PartnersPage() {
  return (
    <div className="relative min-h-screen bg-[var(--kat-paper)]">
      <LandingHeader />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--kat-border)] bg-[var(--kat-raised)] px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-[var(--kat-clay)]">
          <Handshake className="size-3.5" />
          Partnership enquiries
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--kat-ink)] sm:text-4xl md:text-5xl">
          Bring coding education <br className="hidden sm:block" />
          <span className="text-[var(--kat-clay)]">to your community</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl font-body text-base leading-relaxed text-[var(--kat-muted)]">
          KAT Learning partners with schools, corporate organisations, and government bodies to bring
          structured, real-world tech education to children and teens across Africa. Tell us about
          your goals and we&apos;ll design a programme that fits.
        </p>
      </section>

      {/* School programme types */}
      <section className="mx-auto max-w-4xl px-6 pb-14">
        <p className="kat-eyebrow mb-5 text-center">What we bring to schools</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <ShieldCheck className="size-5" />, label: "NERDC-Aligned" },
            { icon: <GraduationCap className="size-5" />, label: "Your Teachers Deliver" },
            { icon: <Code2 className="size-5" />, label: "Coding + Digital Literacy" },
            { icon: <Ticket className="size-5" />, label: "Per-Seat, Per-Term" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--kat-border)] bg-[var(--kat-raised)] px-4 py-5 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--kat-paper)] text-[var(--kat-clay)]">
                {icon}
              </span>
              <span className="font-display text-sm font-semibold text-[var(--kat-ink)]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Partnership type cards */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {PARTNER_TYPES.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-[var(--kat-border)] bg-[var(--kat-raised)] p-7"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--kat-paper)] text-[var(--kat-clay)]">
                {card.icon}
              </div>
              <h3 className="font-display text-lg font-semibold text-[var(--kat-ink)]">{card.title}</h3>
              <p className="mb-4 mt-1 font-mono text-[0.7rem] uppercase tracking-wider text-[var(--kat-muted)]">{card.who}</p>
              <ul className="space-y-2.5">
                {card.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 font-body text-sm text-[var(--kat-muted)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--kat-clay)]" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Inquiry form */}
      <section
        id="inquiry"
        className="mx-auto max-w-2xl scroll-mt-24 px-6 pb-28"
      >
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold text-[var(--kat-ink)]">
            Start the conversation
          </h2>
          <p className="mt-2 font-body text-sm text-[var(--kat-muted)]">
            Fill in the form and our partnerships team will respond within 2 business days.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--kat-border)] bg-[var(--kat-raised)] p-5 sm:p-8">
          <PartnerForm />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
