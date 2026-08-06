import { fail, ok } from "@/lib/http";
import { resolveEmbedPupil } from "@/lib/school-embed-pupil";
import { getAssessmentForTake, listOpenAssessments, submitAssessment } from "@/lib/school-assessments";
import { schoolSubmitAssessmentSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * A school pupil's tests and exams from INSIDE the embed. Same engine as /api/school/learn/assessments
 * (same context resolution, key-stripping, and grading), authenticated by the embed session instead of
 * NextAuth. userId + schoolId come from the SIGNED cookie via resolveEmbedPupil, never the request.
 */
export async function GET(request: Request) {
  const auth = await resolveEmbedPupil(request, { mutation: false });
  if (!auth.ok) return fail(auth.error, auth.status);
  const { userId, schoolId } = auth.pupil;

  const assessmentId = new URL(request.url).searchParams.get("assessmentId");
  try {
    if (assessmentId) {
      const r = await getAssessmentForTake(userId, schoolId, assessmentId);
      return r.ok ? ok(r.data) : fail(r.error, r.status);
    }
    return ok(await listOpenAssessments(userId, schoolId));
  } catch (error) {
    captureError(error);
    return fail("Could not load assessments.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);
  const { userId, schoolId } = auth.pupil;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const parsed = schoolSubmitAssessmentSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  try {
    const r = await submitAssessment(userId, schoolId, parsed.data);
    return r.ok ? ok(r.data, 201) : fail(r.error, r.status);
  } catch (error) {
    captureError(error);
    return fail("Could not submit the assessment.", 500);
  }
}
