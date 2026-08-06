import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { EMBED_COOKIE, readEmbedSession } from "@/lib/school-embed";
import { checkEnrollmentLicense, getLicensedTermNumbers } from "@/lib/school-license";
import { EmbedLauncher } from "@/components/school/embed-launcher";
import { EmbedLessons } from "@/components/school/embed-lessons";

/**
 * The embeddable learner surface, an iframe a school drops into its own portal.
 *
 * ENTRY. The school's server mints a 60-second single-use launch token; the snippet puts it in the
 * URL FRAGMENT (`#t=…`), which never reaches our logs or a Referer header. The client component
 * below reads it, exchanges it for an /embed-scoped session cookie, and strips it from the URL.
 *
 * FRAMING is not this page's job: middleware sets `Content-Security-Policy: frame-ancestors` from
 * this school's SchoolAllowedOrigin list, and next.config.ts omits X-Frame-Options for /embed
 * because XFO cannot express an allow-list. A school with no origins configured is unframeable.
 *
 * LEARNER ONLY. There is deliberately no teacher embed: it would render a roster of minors onto a
 * page whose security we do not control.
 */
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ schoolSlug: string }>;
}) {
  const { schoolSlug } = await params;

  const school = await prisma.school.findUnique({
    where: { slug: schoolSlug },
    select: { id: true, name: true, _count: { select: { origins: true } } },
  });
  if (!school) notFound();

  // Fail closed. A school that has configured no allowed origins cannot be framed (middleware sends
  // frame-ancestors 'none'), so rendering a learner's page here would be pointless at best, and at
  // worst it would work in a top-level tab that nobody authorised.
  if (school._count.origins === 0) notFound();

  const cookieStore = await cookies();
  const session = await readEmbedSession(cookieStore.get(EMBED_COOKIE)?.value);

  // No session yet: the launcher reads the fragment, redeems it, and reloads. It also renders the
  // top-level fallback when the browser refuses us cookies in a third-party frame.
  if (!session || session.schoolId !== school.id) {
    return <EmbedLauncher schoolSlug={schoolSlug} schoolName={school.name} />;
  }

  // TENANT ISOLATION: the enrollment is read by (userId, schoolId) from the SESSION, never from
  // anything in the URL.
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: session.userId, schoolId: school.id, status: "ACTIVE" },
    select: {
      programId: true,
      schoolId: true,
      schoolClassId: true,
      schoolClass: { select: { sessionLabel: true } },
      user: { select: { firstName: true } },
    },
  });
  if (!enrollment) notFound();

  // The same licence gate as /learn. An embed must not be a way around the thing a school pays for.
  const gate = await checkEnrollmentLicense(enrollment);
  if (!gate.allowed) {
    return (
      <main className="p-6 font-body text-stone-700 dark:text-stone-200">
        <p className="text-sm">
          This class is not active. Please ask your school to check their KAT licence.
        </p>
      </main>
    );
  }

  // Which terms are unlocked, so locked modules render locked here too (the lesson page enforces it).
  const licensedTerms = enrollment.schoolClass
    ? [...(await getLicensedTermNumbers(enrollment.schoolId!, enrollment.schoolClass.sessionLabel))]
    : [];

  return (
    <EmbedLessons
      programId={enrollment.programId}
      firstName={enrollment.user.firstName}
      schoolName={school.name}
      licensedTerms={licensedTerms}
      schoolSlug={schoolSlug}
    />
  );
}
