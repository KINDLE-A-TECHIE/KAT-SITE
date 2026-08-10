import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  CourseAudience,
  AssessmentType,
  AssessmentVerificationStatus,
  QuestionType,
} from "@prisma/client";
import { zipSync, strToU8 } from "fflate";

/**
 * Live end-to-end for SCRATCH auto-grading through the REAL school submit route
 * (POST /api/school/learn/assessments), against the REAL seeded Demo Academy and REAL R2.
 *
 * It proves the whole path a pupil's project takes: a saved .sb3 sitting in R2 is fetched
 * server-side, its project.json analysed, scored against the question's stored checklist, and the
 * autoScore persisted on the submission. Only the session is mocked (so we act AS the seeded pupil);
 * enrollment, scheduling, per-module licence, grading, R2 and persistence all run for real.
 *
 * Out of `npm test` (integration/ is excluded); run via `npm run test:integration` on a DIRECT DB.
 */

// Mock ONLY the session. ensureSchoolStudent still runs its real enrollment query off this id.
const h = vi.hoisted(() => ({ session: null as { user: { id: string; role: string } } | null }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  getServerAuthSession: async () => h.session,
}));

// setup.ts stubs R2 with fake creds so unit tests never touch the network. This test DOES need real
// R2, so restore ONLY the R2_* values from .env.local (leaving DATABASE_URL = the direct URL the runner
// passes in) BEFORE @/lib/r2 builds its client/bucket at import.
const { config: loadEnv } = await import("dotenv");
const realEnv = loadEnv({ path: ".env.local", processEnv: {} as Record<string, string> }).parsed ?? {};
for (const [k, v] of Object.entries(realEnv)) if (k.startsWith("R2_")) process.env[k] = v;

// This is a LIVE test against real R2. Locally, .env.local supplies the creds (restored above); CI has no
// .env.local and setup.ts stubs R2 with fake creds ("test-account"), so there is no real bucket to hit,
// uploading would fail the TLS handshake to a fake endpoint. Skip there instead of failing the build; the
// grading path is also covered by the pure unit tests in scratch-analysis.test.ts.
const hasRealR2 = Boolean(realEnv.R2_ACCOUNT_ID) && realEnv.R2_ACCOUNT_ID !== "test-account";

const { prisma } = await import("@/lib/prisma");
const { syncRoster } = await import("@/lib/roster-sync");
const { scratchAnswerKey, SCRATCH_SB3_CONTENT_TYPE } = await import("@/lib/scratch-storage");
const { uploadToR2, deleteR2Object } = await import("@/lib/r2");
const { POST } = await import("@/app/api/school/learn/assessments/route");

const CLASS_ID = "seed-demo-jss-class";
// 2 sprites + a loop + a sound pass (2+3+1=6); the 3-backdrops check fails. Total on offer = 7.
const CHECKS = [
  { id: "1", label: "At least 2 sprites", kind: "count", metric: "sprites", min: 2, points: 2 },
  { id: "2", label: "Uses a loop", kind: "concept", concept: "loop", points: 3 },
  { id: "3", label: "At least 3 backdrops", kind: "count", metric: "backdrops", min: 3, points: 1 },
  { id: "4", label: "Uses a sound", kind: "concept", concept: "usesSound", points: 1 },
];
const EXPECTED_EARNED = 6;
const TOTAL_POINTS = 7;

const project = {
  targets: [
    { isStage: true, name: "Stage", costumes: [{ name: "b1" }, { name: "b2" }], sounds: [{ name: "pop" }], variables: {}, blocks: {} },
    { isStage: false, name: "Cat", costumes: [{ name: "c1" }], sounds: [{ name: "Meow" }], variables: {}, blocks: {
      a: { opcode: "event_whenflagclicked" }, b: { opcode: "control_repeat" }, c: { opcode: "looks_say" }, d: { opcode: "sound_play" },
    } },
    { isStage: false, name: "Ball", costumes: [{ name: "d1" }], sounds: [], variables: {}, blocks: { x: { opcode: "motion_movesteps" } } },
  ],
};

let assessmentId = "";
let questionId = "";
let answerKey = "";
let pupilUserId = "";

describe.skipIf(!hasRealR2)("SCRATCH auto-grading via the school submit route (live)", () => {
  beforeAll(async () => {
    // Provision a pupil the canonical way (same as the A3 test): ensure the class has a programme,
    // then syncRoster one child. Idempotent across runs.
    const cls = await prisma.schoolClass.findUnique({ where: { id: CLASS_ID }, select: { schoolId: true, programId: true } });
    if (!cls) throw new Error("Run `npm run prisma:seed` first: the demo school class is missing.");
    let programId = cls.programId;
    if (!programId) {
      const program = await prisma.program.findFirst({ where: { slug: "nerdc-jss-1", audience: CourseAudience.SCHOOL }, select: { id: true } });
      if (!program) throw new Error("Run `npm run prisma:seed` first: the NERDC JSS 1 course is missing.");
      programId = program.id;
      await prisma.schoolClass.update({ where: { id: CLASS_ID }, data: { programId } });
    }
    const rostered = await syncRoster({
      schoolId: cls.schoolId,
      schoolClassId: CLASS_ID,
      candidates: [{ ref: "scratch", name: "Scratch Test Pupil", externalRef: "scratch-seed-pupil" }],
    });
    if ("error" in rostered) throw new Error(`Could not roster the pupil: ${rostered.error}`);

    const enrollment = await prisma.enrollment.findFirst({
      where: { schoolClassId: CLASS_ID, programId },
      select: { userId: true },
      orderBy: { createdAt: "asc" },
    });
    if (!enrollment) throw new Error("No pupil enrolled in the demo class.");
    pupilUserId = enrollment.userId;
    h.session = { user: { id: pupilUserId, role: "SCHOOL_STUDENT" } };

    // The first module (sortOrder 0 → Term 1) is licensed on the seeded Demo Academy.
    const curriculum = await prisma.curriculum.findUnique({
      where: { programId },
      select: { versions: { where: { isActive: true }, take: 1, select: { modules: { orderBy: { sortOrder: "asc" }, take: 1, select: { id: true } } } } },
    });
    const moduleId = curriculum?.versions[0]?.modules[0]?.id;
    if (!moduleId) throw new Error("No module found for the JSS 1 programme.");

    const creator = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
    if (!creator) throw new Error("No creator user found (run the seed).");

    const assessment = await prisma.assessment.create({
      data: {
        programId,
        moduleId,
        title: "[TEST] Scratch practical",
        type: AssessmentType.PROJECT,
        totalPoints: TOTAL_POINTS,
        passScore: 4,
        published: true,
        verificationStatus: AssessmentVerificationStatus.APPROVED,
        createdById: creator.id,
        questions: {
          create: [{
            prompt: "Build a scene with two sprites, a loop and a sound.",
            type: QuestionType.SCRATCH,
            points: TOTAL_POINTS,
            sortOrder: 1,
            scratchChecks: JSON.stringify(CHECKS),
          }],
        },
      },
      select: { id: true, questions: { select: { id: true } } },
    });
    assessmentId = assessment.id;
    questionId = assessment.questions[0].id;

    // Schedule it to the pupil's class, window open now.
    await prisma.schoolClassAssessment.create({
      data: {
        schoolClassId: CLASS_ID,
        assessmentId,
        opensAt: new Date(Date.now() - 60_000),
        closesAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    // Upload the pupil's saved project to R2 under THEIR own answer key (isOwnScratchAnswerKey passes).
    answerKey = scratchAnswerKey(pupilUserId, questionId);
    const sb3 = zipSync({ "project.json": strToU8(JSON.stringify(project)) });
    await uploadToR2(answerKey, Buffer.from(sb3), SCRATCH_SB3_CONTENT_TYPE);
  }, 120_000);

  afterAll(async () => {
    if (assessmentId) {
      await prisma.assessmentSubmission.deleteMany({ where: { assessmentId } });
      await prisma.schoolClassAssessment.deleteMany({ where: { assessmentId } });
      await prisma.assessment.delete({ where: { id: assessmentId } }).catch(() => {});
    }
    if (answerKey) await deleteR2Object(answerKey).catch(() => {});
  });

  it("fetches the .sb3 from R2, grades it against the checklist, and persists the autoScore", async () => {
    const req = new Request("http://localhost/api/school/learn/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId, answers: [{ questionId, responseText: answerKey }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { autoScore: number; totalScore: number; status: string; submissionId: string };

    // 6 of 7 points earned, and because there is manual grading = none, the attempt is fully GRADED.
    expect(json.autoScore).toBe(EXPECTED_EARNED);
    expect(json.totalScore).toBe(EXPECTED_EARNED);
    expect(json.status).toBe("GRADED");

    // The stored answer keeps the .sb3 key and its per-question autoScore.
    const answer = await prisma.assessmentAnswer.findFirst({
      where: { submission: { assessmentId }, questionId },
      select: { autoScore: true, responseText: true },
    });
    expect(answer?.autoScore).toBe(EXPECTED_EARNED);
    expect(answer?.responseText).toBe(answerKey);
  });

  it("refuses a second submission for the same assessment (single-attempt rule)", async () => {
    const req = new Request("http://localhost/api/school/learn/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId, answers: [{ questionId, responseText: answerKey }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
