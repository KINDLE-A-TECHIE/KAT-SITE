import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Sparkles } from "lucide-react";
import { ContentReviewStatus, EnrollmentStatus, SchoolRole, Strand } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { requireActiveSchool } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { checkClassLicense, checkLessonPreviewLicense } from "@/lib/school-license";
import { resolveClassProgram } from "@/lib/roster-sync";
import { TeacherLessonPreviewBody } from "@/components/school/teacher-lesson-preview-body";
import { LessonPresent } from "@/components/school/lesson-present";
import { DiglitClassComplete } from "@/components/school/diglit-class-complete";
import type { ContentItem } from "@/components/dashboard/lesson-viewer";
import type { SchoolMembershipClaim } from "@/lib/rbac";

/**
 * A teacher previewing one lesson, read-only.
 *
 * Staff preview rule (decision D): the lesson's term must be licensed OR the lesson must be a free
 * sample. Everything is scoped to a class this teacher actually teaches (schoolId + teacherId), so
 * this is not a way to read arbitrary curriculum content, and it never writes progress.
 */
export default async function TeacherLessonPreviewPage({
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

  // The class must be THIS teacher's, in THIS school.
  const cls = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId: membership.schoolId, teacherId: session!.user.id },
    select: { id: true, sessionLabel: true, programId: true, nerdcLevel: true },
  });
  if (!cls) redirect("/teach");

  // Session must be a live customer (same session-level gate as the class dashboard).
  const gate = await checkClassLicense(membership.schoolId, cls.sessionLabel);
  if (!gate.allowed) redirect(`/teach/${classId}`);

  const program = await resolveClassProgram(cls);
  if ("error" in program) redirect(`/teach/${classId}`);

  // The lesson must belong to the course this class delivers, so a valid class cannot be a key to
  // arbitrary lessons by editing the id.
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { version: { curriculum: { programId: program.id } } } },
    select: {
      id: true,
      title: true,
      isSample: true,
      module: { select: { id: true, sortOrder: true, title: true, strand: true } },
      contents: {
        // PUBLISHED only: staff preview the delivered content, not drafts.
        where: { reviewStatus: ContentReviewStatus.PUBLISHED },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          url: true,
          language: true,
          sortOrder: true,
          reviewStatus: true,
          reviewNote: true,
          createdBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!lesson) notFound();

  // PER-MODULE preview gate: licensed term OR a sample lesson.
  const preview = await checkLessonPreviewLicense(
    membership.schoolId,
    cls.sessionLabel,
    lesson.module.sortOrder,
    lesson.isSample,
  );
  if (!preview.allowed) redirect(`/teach/${classId}`);

  // For a digital-literacy lesson, the teacher can record that the class finished it together (it is
  // delivered from the front of the room, so pupils do not each click through). We need the class's
  // active roster size to show and confirm that action. Coding keeps its per-pupil path.
  const isDiglit = lesson.module.strand === Strand.DIGLIT;
  const pupilCount = isDiglit
    ? await prisma.enrollment.count({
        where: { schoolClassId: cls.id, schoolId: membership.schoolId, status: EnrollmentStatus.ACTIVE },
      })
    : 0;

  // Prisma types the enum columns as their enum; the shared ContentBody uses string-literal unions
  // (the shape the learner API serialises to). Same values, so coerce at this boundary.
  const contents: ContentItem[] = lesson.contents.map((c) => ({
    ...c,
    type: c.type as ContentItem["type"],
    reviewStatus: c.reviewStatus as ContentItem["reviewStatus"],
    createdBy: c.createdBy ?? { firstName: "", lastName: "" },
  }));

  return (
    <section className="space-y-4">
      <Link
        href={`/teach/${classId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 dark:text-stone-400"
      >
        <ArrowLeft className="size-3.5" />
        Back to class
      </Link>

      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Preview
          {lesson.isSample ? (
            <span className="inline-flex items-center gap-1 text-orange-500">
              <Sparkles className="size-3" />
              Sample
            </span>
          ) : null}
        </p>
        <h1 className="mt-1 font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
          {lesson.title}
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{lesson.module.title}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={`/teach/${classId}/lessons/${lessonId}/worksheet`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/40"
          >
            <Printer className="size-3.5" />
            Printable worksheet
          </Link>
          <LessonPresent lessonTitle={lesson.title} contents={contents} />
          {isDiglit ? (
            <DiglitClassComplete classId={cls.id} lessonId={lesson.id} pupilCount={pupilCount} />
          ) : null}
        </div>
      </div>

      <TeacherLessonPreviewBody
        contents={contents}
        userId={session!.user.id}
        programId={program.id}
        moduleId={lesson.module.id}
      />
    </section>
  );
}
