import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { ensureSchoolStudent } from "@/lib/school";
import { getAssessmentForTake, listOpenAssessments, submitAssessment } from "@/lib/school-assessments";
import { schoolSubmitAssessmentSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

/**
 * A school pupil's tests and exams: list the ones open now, fetch one to take, submit it. NextAuth path;
 * the embed serves the SAME actions at /api/school/embed/assessments with the embed session. Both share
 * the engine in src/lib/school-assessments.ts, so context resolution + key-stripping + grading are
 * identical, and the integrity rules cannot drift between the two entry points.
 */
export async function GET(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await ensureSchoolStudent());
  } catch {
    return fail("Forbidden", 403);
  }
  const session = await getServerAuthSession();
  const userId = session!.user.id;
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
  let schoolId: string;
  try {
    ({ schoolId } = await ensureSchoolStudent());
  } catch {
    return fail("Forbidden", 403);
  }
  const session = await getServerAuthSession();
  const userId = session!.user.id;

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
