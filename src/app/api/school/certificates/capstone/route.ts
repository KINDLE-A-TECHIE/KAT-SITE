import { z } from "zod";
import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { generateCredentialId } from "@/lib/certificate";
import { getCapstoneProgress, buildCapstoneSnapshot } from "@/lib/school-certificate";

const schema = z.object({
  userId: z.string().min(1),
  programId: z.string().min(1),
  nameConsent: z.boolean().optional(),
});

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

/**
 * POST /api/school/certificates/capstone, issue the YEAR capstone for a pupil who has earned every term
 * certificate in a programme. SCHOOL_ADMIN only. No separate licence check: each underlying term
 * certificate was already licence- and completion-gated at issue, so holding all of them is the gate.
 */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());
  const { userId, programId, nameConsent = false } = parsed.data;

  // TENANT ISOLATION: the pupil must hold a school enrolment in THIS school for the programme.
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, programId, schoolId, schoolClassId: { not: null } },
    select: {
      schoolClassId: true,
      schoolClass: { select: { sessionLabel: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (!enrollment?.schoolClassId || !enrollment.schoolClass) {
    return fail("This pupil is not enrolled in this school for that programme.", 422);
  }

  const progress = await getCapstoneProgress(userId, programId);
  if (!progress.eligible) {
    return fail(
      `This pupil has earned ${progress.earned} of ${progress.moduleCount} term certificates. The year certificate needs all of them.`,
      422,
    );
  }

  const existing = await prisma.schoolCertificate.findUnique({
    where: { userId_programId: { userId, programId } },
    select: { id: true },
  });
  if (existing) return fail("This pupil already has a year certificate for this programme.", 409);

  const snapshot = await buildCapstoneSnapshot(userId, programId);
  if (!snapshot) return fail("Could not build the certificate.", 422);

  const pupilName =
    `${enrollment.user.firstName ?? ""} ${enrollment.user.lastName ?? ""}`.trim() || "Pupil";

  const certificate = await prisma.schoolCertificate.create({
    data: {
      credentialId: generateCredentialId(),
      kind: "SESSION",
      schoolId,
      userId,
      schoolClassId: enrollment.schoolClassId,
      programId,
      moduleId: null,
      moduleTitle: null,
      termNumber: null,
      pupilName,
      programTitle: snapshot.programTitle,
      sessionLabel: enrollment.schoolClass.sessionLabel,
      highlightLessons: snapshot.termTitles,
      nameConsent,
      issuedById: session.user.id,
    },
    select: { credentialId: true, programTitle: true, sessionLabel: true },
  });

  return ok({ certificate }, 201);
}
