import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { EMBED_COOKIE, readEmbedSession } from "@/lib/school-embed";
import { AssessmentTake } from "@/components/school/assessment-take";

/**
 * A pupil sitting one test/exam inside the frame. Same take component as the hosted app, pointed at the
 * embed endpoint (auto-grades objective + code client-side, no answer key leaves the server). Every real
 * gate (scheduled, open window, licensed term, single attempt) lives in the embed API it calls.
 */
export default async function EmbedAssessmentTakePage({
  params,
}: {
  params: Promise<{ schoolSlug: string; assessmentId: string }>;
}) {
  const { schoolSlug, assessmentId } = await params;

  const cookieStore = await cookies();
  const session = await readEmbedSession(cookieStore.get(EMBED_COOKIE)?.value);
  if (!session) notFound();

  const school = await prisma.school.findUnique({ where: { slug: schoolSlug }, select: { id: true } });
  if (!school || school.id !== session.schoolId) notFound();

  const base = `/embed/${encodeURIComponent(schoolSlug)}`;
  return (
    <main className="mx-auto max-w-3xl px-5 py-6 font-body">
      <AssessmentTake
        assessmentId={assessmentId}
        apiPath="/api/school/embed/assessments"
        backHref={`${base}/assessments`}
        embed
      />
    </main>
  );
}
