import { cookies } from "next/headers";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { EMBED_COOKIE, assertEmbedOrigin, readEmbedSession } from "@/lib/school-embed";
import { checkEnrollmentLicense, checkModuleLicenseForEnrollment } from "@/lib/school-license";
import { captureError } from "@/lib/sentry";
import { emitLessonCompleted } from "@/lib/school-webhook";

/**
 * POST /api/school/embed/complete, a pupil marks a lesson done, from inside the frame.
 *
 * The ONLY mutation the embed permits. Everything else it does is a read.
 *
 * CSRF. The embed cookie is SameSite=None, so a browser will attach it to a cross-site request too.
 * A mutating endpoint must therefore prove the caller is a page we allow, assertEmbedOrigin checks
 * the Origin against THIS school's allow-list (or ourselves). The client also sends
 * application/json, which a cross-site HTML form cannot produce, forcing a preflight; that is the
 * second lock, not the first.
 *
 * It writes the same LessonProgress row the rest of the platform reads, so a lesson completed in an
 * iframe counts on the teacher's coverage report exactly like one completed in the app.
 */
const bodySchema = z.object({
  lessonId: z.string().trim().min(1).max(64),
  schoolSlug: z.string().trim().min(1).max(128),
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await readEmbedSession(cookieStore.get(EMBED_COOKIE)?.value);
  if (!session) return fail("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400);

  try {
    if (!(await assertEmbedOrigin(request, session.schoolId))) {
      return fail("Forbidden", 403);
    }

    const school = await prisma.school.findUnique({
      where: { slug: parsed.data.schoolSlug },
      select: { id: true },
    });
    if (!school || school.id !== session.schoolId) return fail("Not found.", 404);

    // TENANT ISOLATION: enrollment from the session, never the request.
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: session.userId, schoolId: session.schoolId, status: "ACTIVE" },
      select: { id: true, programId: true, schoolId: true, schoolClassId: true },
    });
    if (!enrollment) return fail("Not found.", 404);

    const gate = await checkEnrollmentLicense(enrollment);
    if (!gate.allowed) return fail(gate.reason, 403);

    // The lesson must be on the pupil's own programme, otherwise an embed session would let a
    // pupil mark ANY lesson on the platform complete by editing the id.
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: parsed.data.lessonId,
        module: { version: { curriculum: { programId: enrollment.programId } } },
      },
      select: { id: true, module: { select: { sortOrder: true } } },
    });
    if (!lesson) return fail("Not found.", 404);

    // PER-MODULE licence (#6): cannot complete a lesson in a term the school has not licensed.
    const moduleGate = await checkModuleLicenseForEnrollment(enrollment, lesson.module.sortOrder);
    if (!moduleGate.allowed) return fail(moduleGate.reason, 403);

    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: session.userId, lessonId: lesson.id } },
      update: {},
      create: { userId: session.userId, lessonId: lesson.id },
    });

    // The SECOND place a lesson can be completed. Both must emit, or the webhook silently drops
    // every completion that happened inside an iframe.
    await emitLessonCompleted(session.userId, lesson.id);

    return ok({ ok: true });
  } catch (error) {
    captureError(error);
    return fail("Could not save your progress.", 500);
  }
}
