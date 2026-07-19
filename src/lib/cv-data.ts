import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Assembles everything the CV PDF needs for ONE user, in a single typed shape.
 *
 * Authorization contract: the caller passes the SESSION user's id (the route
 * derives it from getServerAuthSession, never from a request parameter), so
 * this can only ever read the caller's own record. Profile visibility settings
 * do not apply here: they gate what OTHER people can see, and this document is
 * the owner exporting their own data.
 *
 * Real-data discipline: sections with nothing behind them come back as empty
 * arrays and the template omits them. Nothing is padded or invented.
 */

export type CvData = {
  generatedAt: Date;
  identity: {
    fullName: string;
    email: string;
    headline: string | null;
    bio: string | null;
    phone: string | null;
    location: string | null;
    githubUrl: string | null;
    linkedinUrl: string | null;
    websiteUrl: string | null;
  };
  skills: { name: string; level: string | null; yearsOfExperience: number | null }[];
  experience: {
    company: string;
    title: string;
    startDate: Date | null;
    endDate: Date | null;
    isCurrent: boolean;
    description: string | null;
  }[];
  education: {
    school: string;
    degree: string;
    fieldOfStudy: string | null;
    startDate: Date | null;
    endDate: Date | null;
    isCurrent: boolean;
    description: string | null;
  }[];
  programmes: { name: string; status: "COMPLETED" | "ACTIVE"; completedAt: Date | null }[];
  /** APPROVED only. verifyUrl is the public check anyone can run. */
  certificates: { programName: string; issuedAt: Date; verifyUrl: string }[];
  badges: { name: string; moduleTitle: string; earnedAt: Date }[];
  /** APPROVED only. showcaseUrl is the public page; deployedUrl the live build if any. */
  projects: {
    title: string;
    description: string | null;
    tags: string[];
    deployedUrl: string | null;
    showcaseUrl: string;
  }[];
};

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function getCvData(userId: string): Promise<CvData | null> {
  const [user, enrollments, certificates, userBadges, projects] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        profile: {
          select: {
            headline: true,
            bio: true,
            phone: true,
            location: true,
            githubUrl: true,
            linkedinUrl: true,
            websiteUrl: true,
            skills: {
              select: { name: true, level: true, yearsOfExperience: true },
              orderBy: { createdAt: "asc" },
            },
            experience: {
              select: {
                company: true, title: true, startDate: true, endDate: true,
                isCurrent: true, description: true,
              },
              orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
            },
            education: {
              select: {
                school: true, degree: true, fieldOfStudy: true, startDate: true,
                endDate: true, isCurrent: true, description: true,
              },
              orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
            },
          },
        },
      },
    }),
    prisma.enrollment.findMany({
      where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
      select: { status: true, completedAt: true, program: { select: { name: true } } },
      orderBy: { enrolledAt: "asc" },
    }),
    prisma.certificate.findMany({
      where: { userId, status: "APPROVED" },
      select: { credentialId: true, issuedAt: true, program: { select: { name: true } } },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.userBadge.findMany({
      where: { userId },
      select: {
        earnedAt: true,
        badge: { select: { name: true, module: { select: { title: true } } } },
      },
      orderBy: { earnedAt: "desc" },
    }),
    prisma.project.findMany({
      where: { studentId: userId, status: "APPROVED" },
      select: { id: true, title: true, description: true, tags: true, deployedUrl: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (!user) return null;

  return {
    generatedAt: new Date(),
    identity: {
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      headline: user.profile?.headline ?? null,
      bio: user.profile?.bio ?? null,
      phone: user.profile?.phone ?? null,
      location: user.profile?.location ?? null,
      githubUrl: user.profile?.githubUrl ?? null,
      linkedinUrl: user.profile?.linkedinUrl ?? null,
      websiteUrl: user.profile?.websiteUrl ?? null,
    },
    skills: user.profile?.skills ?? [],
    experience: user.profile?.experience ?? [],
    education: user.profile?.education ?? [],
    programmes: enrollments.map((e) => ({
      name: e.program.name,
      status: e.status as "COMPLETED" | "ACTIVE",
      completedAt: e.completedAt,
    })),
    certificates: certificates.map((c) => ({
      programName: c.program.name,
      issuedAt: c.issuedAt,
      verifyUrl: `${BASE_URL}/certificate/${c.credentialId}`,
    })),
    badges: userBadges.map((b) => ({
      name: b.badge.name,
      moduleTitle: b.badge.module.title,
      earnedAt: b.earnedAt,
    })),
    projects: projects.map((p) => ({
      title: p.title,
      description: p.description,
      tags: p.tags,
      deployedUrl: p.deployedUrl,
      showcaseUrl: `${BASE_URL}/showcase/${p.id}`,
    })),
  };
}
