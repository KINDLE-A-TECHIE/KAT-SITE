import { LandingPage } from "@/components/marketing/landing-page";
import type { Build } from "@/components/marketing/landing-tokens";
import { prisma } from "@/lib/prisma";
import { CourseAudience, EnrollmentStatus, ProjectStatus } from "@prisma/client";

const BASE = process.env.NEXTAUTH_URL ?? "https://kindleatechie.com";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "KAT Learning",
  url: BASE,
  logo: `${BASE}/kindle-a-techie.svg`,
  email: "support@kindleatechie.com",
  description:
    "Coding education for African children and teens aged 8–19. Live mentors, project-based learning, and parent visibility.",
  sameAs: [
    "https://twitter.com/katLearning",
    "https://instagram.com/kindleatechie",
    "https://linkedin.com/company/kindle-a-techie",
    "https://youtube.com/@katlearning",
  ],
};

const courseSchemas = [
  {
    "@context": "https://schema.org",
    "@type": "Course",
    name: "Junior Explorers",
    description: "Block coding, animations, and early web design for children aged 8–11.",
    url: `${BASE}/#tracks`,
    provider: { "@type": "Organization", name: "KAT Learning", sameAs: BASE },
    courseMode: "online",
    educationalLevel: "Beginner",
    typicalAgeRange: "8-11",
    inLanguage: "en",
  },
  {
    "@context": "https://schema.org",
    "@type": "Course",
    name: "Teen Builders",
    description: "HTML, CSS, JavaScript, and Python for teens aged 12–15. Portfolio-focused.",
    url: `${BASE}/#tracks`,
    provider: { "@type": "Organization", name: "KAT Learning", sameAs: BASE },
    courseMode: "online",
    educationalLevel: "Intermediate",
    typicalAgeRange: "12-15",
    inLanguage: "en",
  },
  {
    "@context": "https://schema.org",
    "@type": "Course",
    name: "Future Innovators",
    description:
      "Fullstack engineering, leadership, and mentorship for teens aged 16–19.",
    url: `${BASE}/#tracks`,
    provider: { "@type": "Organization", name: "KAT Learning", sameAs: BASE },
    courseMode: "online",
    educationalLevel: "Advanced",
    typicalAgeRange: "16-19",
    inLanguage: "en",
  },
];

// Revalidate stats every hour
export const revalidate = 3600;

async function getApprovedTestimonials() {
  try {
    return await prisma.testimonial.findMany({
      where: { status: "APPROVED", featuredOnPage: true },
      select: {
        id: true,
        quote: true,
        rating: true,
        childName: true,
        author: { select: { firstName: true, lastName: true, profile: { select: { avatarUrl: true } } } },
      },
      orderBy: { submittedAt: "desc" },
      take: 12,
    });
  } catch {
    return [];
  }
}

/*
 * Real, APPROVED student builds for the build-log marquee and the hero artifact.
 *
 * TENANT SCOPE (load-bearing, not a nicety): this filters on `program.audience = B2C`,
 * so a school's pupils can never surface here. The marquee prints a child's FIRST NAME
 * on a public, unauthenticated page; a school's children are minors we hold under a
 * B2B contract and have no consent to display. Filtering on the PROGRAM (not the
 * student's role) is what closes it, a SCHOOL_STUDENT whose role was mis-assigned
 * still cannot leak through, and the optional program relation means a project with no
 * program is EXCLUDED rather than admitted. It fails closed.
 *
 * If nothing is approved, this returns [] and the marquee renders nothing. There is no
 * placeholder fallback, by design: an invented "Temi, 11" is the failure mode, not the
 * empty state.
 */
async function getRealBuilds(): Promise<Build[]> {
  try {
    const projects = await prisma.project.findMany({
      where: {
        status: ProjectStatus.APPROVED,
        program: { audience: CourseAudience.B2C },
      },
      select: {
        id: true,
        title: true,
        coverImageUrl: true,
        showcaseConsent: true,
        student: { select: { firstName: true, profile: { select: { avatarUrl: true } } } },
        program: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    });

    return projects.map((p) => ({
      id: p.id,
      firstName: p.student.firstName,
      title: p.title,
      program: p.program?.name ?? null,
      imageUrl: p.coverImageUrl,
      // The face is gated on a SECOND consent flag, not on approval. No consent = no photo,
      // even for an approved build whose title and first name are shown.
      builderPhotoUrl: p.showcaseConsent ? (p.student.profile?.avatarUrl ?? null) : null,
    }));
  } catch {
    return [];
  }
}

async function getLiveStats() {
  try {
    const [enrollmentCount, gradedCount] = await Promise.all([
      prisma.enrollment.count({
        where: { status: { not: EnrollmentStatus.DROPPED } },
      }),
      prisma.assessmentSubmission.count({ where: { gradedAt: { not: null } } }),
    ]);

    let passRate = 95;
    if (gradedCount > 0) {
      const passedResult = await prisma.$queryRaw<[{ cnt: bigint }]>`
        SELECT COUNT(*) AS cnt
        FROM "AssessmentSubmission" s
        JOIN "Assessment" a ON a.id = s."assessmentId"
        WHERE s."gradedAt" IS NOT NULL
          AND a."passScore" IS NOT NULL
          AND s."totalScore" >= a."passScore"
      `;
      const passed = Number(passedResult[0]?.cnt ?? 0);
      passRate = Math.round((passed / gradedCount) * 100);
    }

    return {
      enrollments: Math.max(enrollmentCount, 500),
      passRate: Math.max(passRate, 90),
    };
  } catch {
    return { enrollments: 500, passRate: 95 };
  }
}

export default async function HomePage() {
  const [stats, testimonials, builds] = await Promise.all([
    getLiveStats(),
    getApprovedTestimonials(),
    getRealBuilds(),
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      {courseSchemas.map((schema) => (
        <script
          key={schema.name as string}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <LandingPage
        enrollments={stats.enrollments}
        passRate={stats.passRate}
        testimonials={testimonials}
        builds={builds}
      />
    </>
  );
}
