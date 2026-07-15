import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerAuthSession } from "@/lib/auth";
import { ensureSchoolStudent } from "@/lib/school";
import { prisma } from "@/lib/prisma";
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
        select: { version: { select: { curriculum: { select: { programId: true } } } } },
      },
    },
  });
  if (!lesson) notFound();

  const programId = lesson.module.version.curriculum.programId;

  const enrolled = await prisma.enrollment.findFirst({
    where: { userId: session!.user.id, schoolId, programId },
    select: { id: true },
  });
  if (!enrolled) redirect("/learn");

  return (
    <section className="space-y-4">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 dark:text-stone-400"
      >
        <ArrowLeft className="size-3.5" />
        Back to my course
      </Link>

      {/* The shared learner engine, not a school-specific copy of it. */}
      <LessonViewer
        lessonId={lessonId}
        programId={programId}
        role="STUDENT"
        userId={session!.user.id}
      />
    </section>
  );
}
