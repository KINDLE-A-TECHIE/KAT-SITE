import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { r2PublicUrl } from "@/lib/r2";
import { CertificatePrint } from "./certificate-print";

type Props = {
  params: Promise<{ credentialId: string }>;
  searchParams: Promise<{ theme?: string }>;
};

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  FELLOWSHIP: "Fellowship",
};

// Props for the shared <CertificatePrint>, resolved from EITHER a B2C Certificate or a school term
// SchoolCertificate. credentialIds are crypto-random and unique across both, so one page verifies both.
type ResolvedCertificate = {
  recipientName: string;
  programName: string;
  programLevel: string;
  issuedBy: string;
  issuedAt: string;
  credentialId: string;
  highlights?: string[];
  schoolLogoUrl?: string | null;
  brandName?: string;
  verifiedByKat?: boolean;
  // For metadata: a school pupil's name is only shown with recorded parental consent.
  metaName: string | null;
};

async function resolveCertificate(credentialId: string): Promise<ResolvedCertificate | null> {
  const b2c = await prisma.certificate.findUnique({
    where: { credentialId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      program: { select: { name: true, level: true } },
      issuedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (b2c && b2c.status === "APPROVED") {
    return {
      recipientName: `${b2c.user.firstName} ${b2c.user.lastName}`,
      programName: b2c.program.name,
      programLevel: LEVEL_LABEL[b2c.program.level] ?? b2c.program.level,
      issuedBy: `${b2c.issuedBy.firstName} ${b2c.issuedBy.lastName}`,
      issuedAt: b2c.issuedAt.toISOString(),
      credentialId: b2c.credentialId,
      metaName: `${b2c.user.firstName} ${b2c.user.lastName}`,
    };
  }

  const school = await prisma.schoolCertificate.findUnique({
    where: { credentialId },
    include: { school: { select: { name: true, logoKey: true } } },
  });
  if (school && school.status === "ISSUED") {
    // Minors' data: the pupil's name only appears with recorded parental consent. Without it the
    // credential still verifies as authentic, it just does not name the child. Lesson titles are
    // curriculum (not PII) and always show.
    const named = school.nameConsent;
    const highlights = Array.isArray(school.highlightLessons)
      ? (school.highlightLessons as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const isCapstone = school.kind === "SESSION" || school.termNumber === null;
    const chip = isCapstone
      ? `Full year · ${school.sessionLabel}`
      : `Term ${school.termNumber} · ${school.sessionLabel}`;
    // A TERM certificate is the school's own recognition: its logo and name carry the certificate, with
    // KAT named only as the verifier. The YEAR capstone is the platform-endorsed milestone, so it keeps
    // the KAT mark (schoolLogoUrl/brandName left unset) with the school still named as the authoriser.
    const schoolBrand = isCapstone
      ? {}
      : {
          schoolLogoUrl: school.school.logoKey ? r2PublicUrl(school.school.logoKey) : null,
          brandName: school.school.name,
          verifiedByKat: true,
        };
    return {
      recipientName: named ? school.pupilName : `A pupil at ${school.school.name}`,
      programName: school.programTitle,
      programLevel: chip,
      issuedBy: school.school.name,
      issuedAt: school.issuedAt.toISOString(),
      credentialId: school.credentialId,
      highlights,
      ...schoolBrand,
      metaName: named ? school.pupilName : null,
    };
  }

  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { credentialId } = await params;
  const cert = await resolveCertificate(credentialId);
  if (!cert) return { title: "Certificate Not Found" };
  const who = cert.metaName ? `${cert.metaName}, ` : "";
  return {
    title: `${who}${cert.programName} | KAT Learning`,
    description: `Verified certificate of completion for ${cert.programName}.`,
  };
}

export default async function CertificatePage({ params, searchParams }: Props) {
  const { credentialId } = await params;
  const { theme } = await searchParams;

  const cert = await resolveCertificate(credentialId);
  if (!cert) notFound();

  return (
    <CertificatePrint
      recipientName={cert.recipientName}
      programName={cert.programName}
      programLevel={cert.programLevel}
      issuedBy={cert.issuedBy}
      issuedAt={cert.issuedAt}
      credentialId={cert.credentialId}
      highlights={cert.highlights}
      schoolLogoUrl={cert.schoolLogoUrl}
      brandName={cert.brandName}
      verifiedByKat={cert.verifiedByKat}
      initialTheme={theme}
    />
  );
}
