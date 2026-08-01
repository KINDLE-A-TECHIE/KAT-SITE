import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContentReviewStatus, SchoolRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { requireActiveSchool } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { checkClassLicense, checkLessonPreviewLicense } from "@/lib/school-license";
import { resolveClassProgram } from "@/lib/roster-sync";
import { LessonWorksheet, type WorksheetContent } from "@/components/school/lesson-worksheet";
import type { SchoolMembershipClaim } from "@/lib/rbac";

/**
 * A printable worksheet for one lesson. Same guards as the teacher lesson preview (a class this teacher
 * teaches, a licensed term or a sample lesson), because it renders the same PUBLISHED content, just for
 * paper. This is the reliable offline path for classrooms with unstable power or connectivity.
 */
export default async function LessonWorksheetPage({
  params,
}: {
  params: Promise<{ classId: string; lessonId: string }>;
}) {
  const { classId, lessonId } = await params;

  let membership: SchoolMembershipClaim;
  try {
    membership = await requireActiveSchool([SchoolRole.TEACHER]);
  } catch {
    redirect("/home");
  }
  const session = await getServerAuthSession();

  const cls = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId: membership.schoolId, teacherId: session!.user.id },
    select: { id: true, sessionLabel: true, programId: true, nerdcLevel: true },
  });
  if (!cls) redirect("/teach");

  const gate = await checkClassLicense(membership.schoolId, cls.sessionLabel);
  if (!gate.allowed) redirect(`/teach/${classId}`);

  const program = await resolveClassProgram(cls);
  if ("error" in program) redirect(`/teach/${classId}`);

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { version: { curriculum: { programId: program.id } } } },
    select: {
      id: true,
      title: true,
      isSample: true,
      module: {
        select: {
          sortOrder: true,
          title: true,
          version: { select: { curriculum: { select: { program: { select: { name: true } } } } } },
        },
      },
      contents: {
        where: { reviewStatus: ContentReviewStatus.PUBLISHED },
        orderBy: { sortOrder: "asc" },
        select: { type: true, title: true, body: true },
      },
    },
  });
  if (!lesson) notFound();

  const preview = await checkLessonPreviewLicense(
    membership.schoolId,
    cls.sessionLabel,
    lesson.module.sortOrder,
    lesson.isSample,
  );
  if (!preview.allowed) redirect(`/teach/${classId}`);

  const contents: WorksheetContent[] = lesson.contents.map((c) => ({
    type: c.type,
    title: c.title,
    body: c.body,
  }));
  const subtitle = `${lesson.module.version.curriculum.program.name} · ${lesson.module.title}`;

  return (
    <section className="space-y-4">
      <Link
        href={`/teach/${classId}/lessons/${lessonId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 dark:text-stone-400 print:hidden"
      >
        <ArrowLeft className="size-3.5" />
        Back to lesson
      </Link>

      <LessonWorksheet lessonTitle={lesson.title} subtitle={subtitle} contents={contents} />
    </section>
  );
}
