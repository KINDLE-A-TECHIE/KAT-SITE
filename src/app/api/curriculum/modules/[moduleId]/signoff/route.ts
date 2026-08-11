import { z } from "zod";
import { NotificationType, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { capabilityDenied } from "@/lib/capabilities";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tryCompleteInstructorGate } from "@/lib/mastery";

interface Params { params: Promise<{ moduleId: string }> }

const REVIEWER_ROLES: UserRole[] = [UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

const schema = z.object({ userId: z.string().cuid() });

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!REVIEWER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  if (capabilityDenied(session.user, "curriculum")) return fail("Forbidden", 403);

  const { moduleId } = await params;

  let body: unknown;
  try { body = await request.json(); } catch { return fail("Invalid JSON", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("userId is required.", 400);

  const studentId = parsed.data.userId;

  // Verify the module exists and belongs to this org
  const moduleRecord = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      title: true,
      version: {
        select: {
          curriculum: {
            select: {
              programId: true,
              program: { select: { organizationId: true } },
            },
          },
        },
      },
    },
  });

  if (!moduleRecord) return fail("Module not found.", 404);

  const orgId = moduleRecord.version.curriculum.program.organizationId;
  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.organizationId !== orgId
  ) {
    return fail("Forbidden", 403);
  }

  const programId = moduleRecord.version.curriculum.programId;

  // Verify the student is enrolled
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_programId: { userId: studentId, programId } },
    select: { id: true },
  });
  if (!enrollment) return fail("Student is not enrolled in this program.", 400);

  const result = await tryCompleteInstructorGate(session.user.id, studentId, moduleId);
  if (!result) return fail("Could not complete sign-off. Check that the module is valid.", 500);

  // Notify the student
  await prisma.notification.create({
    data: {
      recipientId: studentId,
      creatorId: session.user.id,
      type: NotificationType.SUCCESS,
      title: "Instructor evaluation passed",
      body: JSON.stringify({
        text: `Your instructor signed off on "${moduleRecord.title}". ${result.allGatesPassed ? "All gates are now complete, the next module is unlocked!" : "Check your remaining gates to unlock the next module."}`,
        targetPath: `/dashboard/curriculum/${programId}`,
      }),
    },
  });

  return ok({ allGatesPassed: result.allGatesPassed });
}
