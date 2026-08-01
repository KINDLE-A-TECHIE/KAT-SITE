import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { ContentReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EMBED_COOKIE, readEmbedSession } from "@/lib/school-embed";
import { checkEnrollmentLicense, checkModuleLicenseForEnrollment } from "@/lib/school-license";
import { EmbedLessonBody } from "@/components/school/embed-lesson-body";

/**
 * A lesson, inside the frame.
 *
 * This exists because the ordinary /learn route authenticates with the NextAuth cookie, which is
 * SameSite=Lax and therefore is NOT SENT inside a cross-site iframe, a pupil clicking through from
 * the embed would land on a login page, inside their school's website. So the embed serves lessons
 * under its own path, with its own session.
 *
 * It does NOT fork the engine: it reads the same LessonContent records, honours the same
 * PUBLISHED-only review filter as the learner API, and completion writes the same LessonProgress
 * row the rest of the platform reads. Only the shell differs.
 */
export default async function EmbedLessonPage({
  params,
}: {
  params: Promise<{ schoolSlug: string; lessonId: string }>;
}) {
  const { schoolSlug, lessonId } = await params;

  const cookieStore = await cookies();
  const session = await readEmbedSession(cookieStore.get(EMBED_COOKIE)?.value);
  if (!session) notFound();

  const school = await prisma.school.findUnique({
    where: { slug: schoolSlug },
    select: { id: true },
  });
  // The slug in the path must be the school in the session, otherwise a live embed session for
  // school A could read school B's lesson shell.
  if (!school || school.id !== session.schoolId) notFound();

  // TENANT ISOLATION: enrollment resolved from the SESSION's userId + schoolId.
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: session.userId, schoolId: school.id, status: "ACTIVE" },
    select: { programId: true, schoolId: true, schoolClassId: true },
  });
  if (!enrollment) notFound();

  const gate = await checkEnrollmentLicense(enrollment);
  if (!gate.allowed) notFound();

  // The lesson must belong to the programme this pupil is enrolled on. Without this, a valid embed
  // session would be a key to EVERY lesson on the platform simply by changing the id in the URL.
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      module: { version: { curriculum: { programId: enrollment.programId } } },
    },
    select: {
      id: true,
      title: true,
      module: { select: { sortOrder: true } },
      contents: {
        // PUBLISHED only, the same filter the learner API applies. Draft and in-review content is
        // not shown to children here either.
        where: { reviewStatus: ContentReviewStatus.PUBLISHED },
        orderBy: { sortOrder: "asc" },
        select: { id: true, type: true, title: true, body: true, url: true, language: true },
      },
    },
  });
  if (!lesson) notFound();

  // PER-MODULE licence (#6): the lesson's term must be one the school has unlocked.
  const moduleGate = await checkModuleLicenseForEnrollment(enrollment, lesson.module.sortOrder);
  if (!moduleGate.allowed) notFound();

  const done = await prisma.lessonProgress.findFirst({
    where: { userId: session.userId, lessonId: lesson.id },
    select: { id: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 font-body">
      <Link
        href={`/embed/${encodeURIComponent(schoolSlug)}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 dark:text-stone-400"
      >
        <ArrowLeft className="size-3.5" />
        All lessons
      </Link>

      <h1 className="mt-3 font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
        {lesson.title}
      </h1>

      <EmbedLessonBody
        schoolSlug={schoolSlug}
        lessonId={lesson.id}
        contents={lesson.contents}
        completed={Boolean(done)}
      />
    </main>
  );
}
