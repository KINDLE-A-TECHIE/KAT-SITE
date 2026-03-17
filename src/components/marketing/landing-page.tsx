import type { CSSProperties } from "react";
import { DESIGN_TOKENS } from "./landing-tokens";
import { LandingHeader } from "./sections/landing-header";
import { HeroSection } from "./sections/hero-section";
import { StatsBar } from "./sections/stats-bar";
import { FeaturesSection } from "./sections/features-section";
import { HowItWorksSection } from "./sections/how-it-works-section";
import { TracksSection } from "./sections/tracks-section";
import { FellowshipSection } from "./sections/fellowship-section";
import { TestimonialsSection } from "./sections/testimonials-section";
import { PricingSection } from "./sections/pricing-section";
import { ScheduleWaitlistSection } from "./sections/schedule-waitlist-section";
import { FaqSection } from "./sections/faq-section";
import { CtaSection } from "./sections/cta-section";
import { SiteFooter } from "@/components/site-footer";

type OpenCohort = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  applicationClosesAt: string | null;
  externalApplicationFee: number | null;
  capacity: number | null;
  applicationCount: number;
  program: { id: string; name: string; level: string; description: string | null };
};

type LandingPageProps = {
  enrollments: number;
  passRate: number;
  openCohorts: OpenCohort[];
};

export function LandingPage({ enrollments, passRate, openCohorts }: LandingPageProps) {
  return (
    <main style={DESIGN_TOKENS as CSSProperties} className="relative overflow-x-clip">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[var(--kat-bg)]" />
        <div className="absolute left-[-20rem] top-[-12rem] h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,rgba(77,179,230,0.16)_0%,transparent_70%)]" />
        <div className="absolute right-[-14rem] top-10 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(30,95,175,0.12)_0%,transparent_70%)]" />
        <div className="absolute bottom-0 left-1/2 h-[28rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(19,43,94,0.05)_0%,transparent_70%)]" />
      </div>

      <LandingHeader />
      <HeroSection enrollments={enrollments} passRate={passRate} />
      <StatsBar enrollments={enrollments} passRate={passRate} />
      <FeaturesSection />
      <HowItWorksSection />
      <TracksSection />
      <FellowshipSection cohorts={openCohorts} />
      <TestimonialsSection />
      <PricingSection />
      <ScheduleWaitlistSection />
      <FaqSection />
      <CtaSection />
      <SiteFooter />
    </main>
  );
}
