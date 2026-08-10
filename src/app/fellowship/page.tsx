import type { Metadata } from "next";
import { LandingHeader } from "@/components/marketing/sections/landing-header";
import { FellowshipSection } from "@/components/marketing/sections/fellowship-section";
import { SiteFooter } from "@/components/site-footer";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Fellowship | KAT",
  description:
    "The best KAT students become Fellows: they mentor the next intake, lead community projects, and build a public track record. Enrolled students apply free.",
};

// Revalidate the open-cohort list hourly (same cadence the landing used).
export const revalidate = 3600;

async function getOpenCohorts() {
  try {
    const now = new Date();
    const cohorts = await prisma.cohort.findMany({
      where: {
        applicationOpen: true,
        OR: [{ applicationClosesAt: null }, { applicationClosesAt: { gt: now } }],
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        applicationClosesAt: true,
        externalApplicationFee: true,
        capacity: true,
        program: { select: { id: true, name: true, level: true, description: true } },
        _count: { select: { fellowApplications: true } },
      },
      orderBy: { startsAt: "asc" },
    });
    return cohorts
      .filter((c) => c.program !== null)
      .map((c) => ({
        ...c,
        program: c.program!,
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
        applicationClosesAt: c.applicationClosesAt?.toISOString() ?? null,
        externalApplicationFee: c.externalApplicationFee ? Number(c.externalApplicationFee) : null,
        applicationCount: c._count.fellowApplications,
      }));
  } catch {
    return [];
  }
}

export default async function FellowshipPage() {
  const cohorts = await getOpenCohorts();
  return (
    <main className="kat-blueprint relative overflow-x-clip">
      <LandingHeader />
      <FellowshipSection cohorts={cohorts} />
      <SiteFooter />
    </main>
  );
}
