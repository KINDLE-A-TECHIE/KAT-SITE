import { redirect, notFound } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { ensureSchoolStudent } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { checkModuleLicenseForEnrollment } from "@/lib/school-license";
import { LessonViewer } from "@/components/dashboard/lesson-viewer";

/**
 * A school student viewing one lesson.
 *
 * Renders the EXISTING LessonViewer, the same component the B2C learner uses, so
 * there is exactly one lesson/content/completion engine. CODE_PLAYGROUND content
 * renders inside it for CODING units; a DIGLIT unit is "lighter" simply because
 * it is authored as slides/worksheets (RICH_TEXT / DOCUMENT_LINK) and carries no
 * module gates.
 *
 * Access control is layered: ensureSchoolStudent here, and the lesson APIs the
 * viewer calls independently re-check enrollment + the school's ACTIVE licence.
 */
export default async function SchoolLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  let schoolId: string;
  try {
    ({ schoolId } = await ensureSchoolStudent());
  } catch {
    redirect("/home");
  }

  const { lessonId } = await params;
  const session = await getServerAuthSession();

  // The lesson must belong to the course this student's school class is enrolled in.
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      module: {
        select: {
          sortOrder: true,
          version: { select: { curriculum: { select: { programId: true } } } },
        },
      },
    },
  });
  if (!lesson) notFound();

  const programId = lesson.module.version.curriculum.programId;

  const enrolled = await prisma.enrollment.findFirst({
    where: { userId: session!.user.id, schoolId, programId },
    select: { id: true, schoolId: true, schoolClassId: true },
  });
  if (!enrolled) redirect("/learn");

  // PER-MODULE licence (#6): don't render the viewer for a locked term, its API calls would 403.
  // The lesson API enforces the same rule, this only avoids a dead-end shell.
  const moduleGate = await checkModuleLicenseForEnrollment(enrolled, lesson.module.sortOrder);
  if (!moduleGate.allowed) redirect("/learn");

  return (
    <section className="space-y-4">
      {/* The shared learner engine, not a school-specific copy of it. It renders its OWN back arrow;
          we do not add a second one here. backHref/lessonBasePath keep the pupil inside the school
          shell: its "back" and prev/next links must point at /learn, not the B2C /dashboard/curriculum
          routes the viewer defaults to (a pupil has no B2C surface, and following one lands them on a
          page the dashboard guard bounces back). */}
      <LessonViewer
        lessonId={lessonId}
        programId={programId}
        role="STUDENT"
        userId={session!.user.id}
        backHref="/learn"
        lessonBasePath="/learn/lessons"
        // Faint per-pupil name overlay: deterrence against sharing/leaking the content. Shown only to
        // the pupil on their own screen, never sent anywhere.
        watermark={`${session!.user.firstName} ${session!.user.lastName}`.trim()}
      />
    </section>
  );
}
