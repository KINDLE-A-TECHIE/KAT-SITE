import type { Build } from "./landing-tokens";
import { LandingHeader } from "./sections/landing-header";
import { HeroSection } from "./sections/hero-section";
import { BuildLogMarquee } from "./sections/build-log-marquee";
import { ProductBand } from "./sections/product-band";
import { TracksSection } from "./sections/tracks-section";
import { WhyKatSection } from "./sections/why-kat-section";
import { TestimonialsSection } from "./sections/testimonials-section";
import { PricingSection } from "./sections/pricing-section";
import { FaqSection } from "./sections/faq-section";
import { CtaSection } from "./sections/cta-section";
import { SiteFooter } from "@/components/site-footer";
import { EnrollmentChat } from "./enrollment-chat";

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
  testimonials?: DbTestimonial[];
  builds: Build[];
};

/*
 * The B2C landing, restructured to a tighter funnel. It used to say "what your child gets" across
 * four sections (Features, How It Works, product band, Tracks); now it shows it once (marquee +
 * product band), explains it once (Why KAT, which merged Features and How It Works), and details it
 * once (Tracks). Fellowship and Events moved to their own pages (/fellowship, /events), off the main
 * enroll scroll. The palette, type, and marquee, the page's signature, are untouched.
 */
export function LandingPage({
  enrollments,
  passRate,
  testimonials,
  builds,
}: LandingPageProps) {
  return (
    <main className="kat-blueprint relative overflow-x-clip">
      <LandingHeader />
      <HeroSection enrollments={enrollments} passRate={passRate} builds={builds} />

      {/* The signature element. Renders nothing when no real build has been approved. */}
      <BuildLogMarquee builds={builds} />

      {/* Show it (real screenshots), then detail it (tracks), then explain it (why + how). */}
      <ProductBand />
      <TracksSection />
      <WhyKatSection />

      <TestimonialsSection testimonials={testimonials} />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <SiteFooter />
      <EnrollmentChat />
    </main>
  );
}
