import { z } from "zod";
import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { generateCredentialId } from "@/lib/certificate";
import { isModuleComplete, buildCertificateSnapshot } from "@/lib/school-certificate";
import { getLicensedTermNumbers } from "@/lib/school-license";
import { termNumberForModule } from "@/lib/school-term";

const issueSchema = z.object({
  userId: z.string().min(1),
  moduleId: z.string().min(1),
  // Parental consent to show the pupil's name on the public verification page (default off).
  nameConsent: z.boolean().optional(),
});

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

const LIST_SELECT = {
  id: true,
  credentialId: true,
  kind: true,
  moduleId: true,
  moduleTitle: true,
  programTitle: true,
  sessionLabel: true,
  termNumber: true,
  pupilName: true,
  nameConsent: true,
  status: true,
  issuedAt: true,
  user: { select: { id: true, firstName: true, lastName: true } },
} as const;

// GET, list this school's issued certificates. Admins and teachers of the school.
export async function GET() {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN, SchoolRole.TEACHER]));
  } catch (error) {
    return guardFail(error);
  }

  // TENANT ISOLATION: scoped to the caller's active school, derived from the session, never the request.
  const certificates = await prisma.schoolCertificate.findMany({
    where: { schoolId },
    orderBy: { issuedAt: "desc" },
    select: LIST_SELECT,
  });
  return ok({ certificates });
}

// POST, issue a term (module) certificate for a pupil. SCHOOL_ADMIN only.
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const parsed = issueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());
  const { userId, moduleId, nameConsent = false } = parsed.data;

  // The certificate is for finishing THIS term, so resolve the module's program to check enrolment.
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { sortOrder: true, version: { select: { curriculum: { select: { programId: true } } } } },
  });
  if (!mod) return fail("Module not found.", 404);
  const programId = mod.version.curriculum.programId;

  // TENANT ISOLATION: the pupil must hold a school enrolment in THIS school for the module's program.
  // schoolId comes from the session guard above, never from the request body.
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, programId, schoolId, schoolClassId: { not: null } },
    select: {
      schoolClassId: true,
      schoolClass: { select: { sessionLabel: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (!enrollment?.schoolClassId || !enrollment.schoolClass) {
    return fail("This pupil is not enrolled in this school for that term.", 422);
  }

  // A school may only certify a term it actually LICENSED. Gate on an ACTIVE, in-window licence for
  // this module's term in the class's session, the same term gate the learn path enforces.
  const licensedTerms = await getLicensedTermNumbers(schoolId, enrollment.schoolClass.sessionLabel);
  if (!licensedTerms.has(termNumberForModule(mod.sortOrder))) {
    return fail("Your school does not hold an active licence for this term, so its certificate cannot be issued.", 403);
  }

  if (!(await isModuleComplete(userId, moduleId))) {
    return fail("This pupil has not completed every lesson in this term yet.", 422);
  }

  const existing = await prisma.schoolCertificate.findUnique({
    where: { userId_moduleId: { userId, moduleId } },
    select: { id: true },
  });
  if (existing) return fail("A certificate for this pupil and term already exists.", 409);

  const snapshot = await buildCertificateSnapshot(userId, moduleId);
  if (!snapshot) return fail("Module not found.", 404);

  const pupilName =
    `${enrollment.user.firstName ?? ""} ${enrollment.user.lastName ?? ""}`.trim() || "Pupil";

  const certificate = await prisma.schoolCertificate.create({
    data: {
      credentialId: generateCredentialId(),
      schoolId,
      userId,
      schoolClassId: enrollment.schoolClassId,
      moduleId,
      pupilName,
      programTitle: snapshot.programTitle,
      moduleTitle: snapshot.moduleTitle,
      sessionLabel: enrollment.schoolClass.sessionLabel,
      termNumber: snapshot.termNumber,
      highlightLessons: snapshot.highlightLessons,
      nameConsent,
      issuedById: session.user.id,
    },
    select: LIST_SELECT,
  });

  return ok({ certificate }, 201);
}
