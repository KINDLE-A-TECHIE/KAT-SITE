import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { LandingHeader } from "@/components/marketing/sections/landing-header";
import { SiteFooter } from "@/components/site-footer";
import { DESIGN_TOKENS } from "@/components/marketing/landing-tokens";
import { PartnerForm } from "./partner-form";
import { School, Building2, Landmark, Handshake } from "lucide-react";

export const metadata: Metadata = {
  title: "Partner with KAT Learning — Schools, Corporates & Government",
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
    icon: <School className="size-7 text-[var(--kat-primary-blue)]" />,
    title: "Schools",
    who: "Primary, secondary, and tertiary institutions",
    points: [
      "Curriculum-aligned coding clubs and after-school programmes",
      "Teacher support and lesson materials included",
      "Parent visibility dashboards for every student",
      "Cohort certificates and portfolio showcases",
    ],
  },
  {
    icon: <Building2 className="size-7 text-[var(--kat-primary-blue)]" />,
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
    icon: <Landmark className="size-7 text-[var(--kat-primary-blue)]" />,
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
    <div style={DESIGN_TOKENS as CSSProperties} className="relative min-h-screen bg-[var(--kat-bg)]">
      <LandingHeader />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-medium text-[var(--kat-primary-blue)]">
          <Handshake className="size-3.5" />
          Partnership Enquiries
        </div>
        <h1 className="[font-family:var(--font-space-grotesk)] text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
          Bring coding education <br className="hidden sm:block" />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "var(--kat-gradient)" }}
          >
            to your community
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-500">
          KAT Learning partners with schools, corporate organisations, and government bodies to bring
          structured, mentor-led tech education to children and teens across Africa. Tell us about
          your goals and we&apos;ll design a programme that fits.
        </p>
      </section>

      {/* Partnership type cards */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {PARTNER_TYPES.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                {card.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
              <p className="mb-4 mt-1 text-xs text-slate-400">{card.who}</p>
              <ul className="space-y-2.5">
                {card.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-sm text-slate-600">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--kat-gradient)" }}
                    />
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
          <h2 className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900">
            Start the conversation
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Fill in the form and our partnerships team will respond within 2 business days.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <PartnerForm />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
