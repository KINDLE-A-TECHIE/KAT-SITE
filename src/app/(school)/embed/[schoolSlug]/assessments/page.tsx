import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { EMBED_COOKIE, readEmbedSession } from "@/lib/school-embed";
import { AssessmentsList } from "@/components/school/assessments-list";

/**
 * A pupil's tests and exams, inside the frame. Same list component as the hosted app, pointed at the
 * embed endpoint and routing to the embed take page. The API enforces every real gate (scheduled to the
 * pupil's class, open window, licensed term); this shell only guards the session + slug.
 */
export default async function EmbedAssessmentsPage({
  params,
}: {
  params: Promise<{ schoolSlug: string }>;
}) {
  const { schoolSlug } = await params;

  const cookieStore = await cookies();
  const session = await readEmbedSession(cookieStore.get(EMBED_COOKIE)?.value);
  if (!session) notFound();

  const school = await prisma.school.findUnique({ where: { slug: schoolSlug }, select: { id: true } });
  if (!school || school.id !== session.schoolId) notFound();

  const base = `/embed/${encodeURIComponent(schoolSlug)}`;
  return (
    <main className="mx-auto max-w-3xl px-5 py-6 font-body">
      <Link
        href={base}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 dark:text-stone-400"
      >
        <ArrowLeft className="size-3.5" />
        All lessons
      </Link>
      <AssessmentsList apiPath="/api/school/embed/assessments" basePath={`${base}/assessments`} />
    </main>
  );
}
