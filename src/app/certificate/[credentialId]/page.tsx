import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CertificatePrint } from "./certificate-print";

type Props = { params: Promise<{ credentialId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { credentialId } = await params;
  const cert = await prisma.certificate.findUnique({
    where: { credentialId },
    include: { user: { select: { firstName: true, lastName: true } }, program: { select: { name: true } } },
  });
  if (!cert) return { title: "Certificate Not Found" };
  return {
    title: `${cert.user.firstName} ${cert.user.lastName} — ${cert.program.name} | KAT Academy`,
    description: `Verified certificate of completion for ${cert.program.name}.`,
  };
}

export default async function CertificatePage({ params }: Props) {
  const { credentialId } = await params;

  const cert = await prisma.certificate.findUnique({
    where: { credentialId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      program: { select: { name: true, level: true } },
      issuedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!cert) notFound();

  const LEVEL_LABEL: Record<string, string> = {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
    FELLOWSHIP: "Fellowship",
  };

  return (
    <CertificatePrint
      recipientName={`${cert.user.firstName} ${cert.user.lastName}`}
      programName={cert.program.name}
      programLevel={LEVEL_LABEL[cert.program.level] ?? cert.program.level}
      issuedBy={`${cert.issuedBy.firstName} ${cert.issuedBy.lastName}`}
      issuedAt={cert.issuedAt.toISOString()}
      credentialId={cert.credentialId}
    />
  );
}
