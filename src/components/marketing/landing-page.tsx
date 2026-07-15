import type { Build } from "./landing-tokens";
import { LandingHeader } from "./sections/landing-header";
import { HeroSection } from "./sections/hero-section";
import { BuildLogMarquee } from "./sections/build-log-marquee";
import { FeaturesSection } from "./sections/features-section";
import { HowItWorksSection } from "./sections/how-it-works-section";
import { TracksSection } from "./sections/tracks-section";
import { FellowshipSection } from "./sections/fellowship-section";
import { EventsSection } from "./sections/events-section";
import { TestimonialsSection } from "./sections/testimonials-section";
import { PricingSection } from "./sections/pricing-section";
import { FaqSection } from "./sections/faq-section";
import { CtaSection } from "./sections/cta-section";
import { SiteFooter } from "@/components/site-footer";
import { EnrollmentChat } from "./enrollment-chat";

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

type DbTestimonial = {
  id: string;
  quote: string;
  rating: number;
  childName: string | null;
  author: { firstName: string; lastName: string; profile: { avatarUrl: string | null } | null };
};

type LandingPageProps = {
  enrollments: number;
  passRate: number;
  openCohorts: OpenCohort[];
  testimonials?: DbTestimonial[];
  builds: Build[];
};

export function LandingPage({
  enrollments,
  passRate,
  openCohorts,
  testimonials,
  builds,
}: LandingPageProps) {
  return (
    /*
     * No inline token object and no gradient blobs. The palette comes from :root
     * (globals.css) and the page sits on warm paper with a faint blueprint grid,
     * a workbench, not a SaaS landing. The blobs were the other half of the
     * template look; they are gone, not restyled.
     */
    <main className="kat-blueprint relative overflow-x-clip">
      <LandingHeader />
      <HeroSection enrollments={enrollments} passRate={passRate} builds={builds} />

      {/* The signature element. Renders nothing when no real build has been approved. */}
      <BuildLogMarquee builds={builds} />

      <FeaturesSection />
      <HowItWorksSection />
      <TracksSection />
      <FellowshipSection cohorts={openCohorts} />
      <EventsSection />
      <TestimonialsSection testimonials={testimonials} />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <SiteFooter />
      <EnrollmentChat />
    </main>
  );
}
