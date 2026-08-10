import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { EMBED_COOKIE, assertEmbedOrigin, readEmbedSession } from "@/lib/school-embed";
import { checkEnrollmentLicense, checkModuleLicenseForEnrollment } from "@/lib/school-license";

/**
 * Shared authorization for embed PUPIL-ACTION routes (`/api/school/embed/*`), so every one enforces the
 * same guards the vetted /complete route established, in one place:
 *   - identity from the SIGNED embed cookie, never the request body (tenant isolation);
 *   - for a mutation, an Origin allow-list check (the cookie is SameSite=None, so a mutation is CSRF-able);
 *   - the pupil's ACTIVE enrollment, resolved from the session;
 *   - the session-level licence gate (an embed must never bypass what the school pays for).
 * Fails closed: any failure returns a typed deny, never a partial success.
 */

type Enrollment = { id: string; programId: string; schoolId: string | null; schoolClassId: string | null };

export type EmbedPupil = { userId: string; schoolId: string; enrollment: Enrollment };

export type EmbedResolve =
  | { ok: true; pupil: EmbedPupil }
  | { ok: false; status: 401 | 403 | 404; error: string };

export async function resolveEmbedPupil(request: Request, opts: { mutation: boolean }): Promise<EmbedResolve> {
  const cookieStore = await cookies();
  const session = await readEmbedSession(cookieStore.get(EMBED_COOKIE)?.value);
  if (!session) return { ok: false, status: 401, error: "Unauthorized" };

  if (opts.mutation && !(await assertEmbedOrigin(request, session.schoolId))) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: session.userId, schoolId: session.schoolId, status: "ACTIVE" },
    select: { id: true, programId: true, schoolId: true, schoolClassId: true },
  });
  if (!enrollment) return { ok: false, status: 404, error: "Not found." };

  const gate = await checkEnrollmentLicense(enrollment);
  if (!gate.allowed) return { ok: false, status: 403, error: gate.reason ?? "This term is not licensed." };

  return { ok: true, pupil: { userId: session.userId, schoolId: session.schoolId, enrollment } };
}

export type EmbedContent = { id: string; type: string; language: string | null; reviewStatus: string };

/**
 * A lesson content the pupil may act on: it must sit on the pupil's OWN programme (so an embed session
 * cannot address arbitrary content by editing an id) AND in a term the school has licensed. Returns the
 * content's type/language/reviewStatus, or a typed deny.
 */
export async function assertContentOnPupilProgramme(
  contentId: string,
  enrollment: Enrollment,
): Promise<{ ok: true; content: EmbedContent } | { ok: false; status: 403 | 404; error: string }> {
  const content = await prisma.lessonContent.findFirst({
    where: {
      id: contentId,
      lesson: { module: { version: { curriculum: { programId: enrollment.programId } } } },
    },
    select: {
      id: true,
      type: true,
      language: true,
      reviewStatus: true,
      lesson: { select: { module: { select: { sortOrder: true } } } },
    },
  });
  if (!content) return { ok: false, status: 404, error: "Not found." };

  const moduleGate = await checkModuleLicenseForEnrollment(enrollment, content.lesson.module.sortOrder);
  if (!moduleGate.allowed) return { ok: false, status: 403, error: moduleGate.reason ?? "This term is not licensed." };

  return { ok: true, content: { id: content.id, type: content.type, language: content.language, reviewStatus: content.reviewStatus } };
}
