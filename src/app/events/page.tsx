import type { Metadata } from "next";
import { LandingHeader } from "@/components/marketing/sections/landing-header";
import { EventsSection } from "@/components/marketing/sections/events-section";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Events | KAT",
  description:
    "Bootcamps, hackathons, and coding clubs inside schools. KAT's core learning is online; these run physically, virtually, or hybrid depending on the partner and city.",
};

export default function EventsPage() {
  return (
    <main className="kat-blueprint relative overflow-x-clip">
      <LandingHeader />
      <EventsSection />
      <SiteFooter />
    </main>
  );
}
