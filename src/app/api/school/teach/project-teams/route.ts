import { EnrollmentStatus, ProjectTeamStatus, SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { checkClassLicense } from "@/lib/school-license";
import { teacherDisplayName } from "@/lib/school-teacher-history";
import { applyProjectGate } from "@/lib/school-projects";
import { schoolProjectTeamSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

/**
 * A teacher forms and reviews project TEAMS for one module of their class. Teacher-driven, matching the
 * observed-practical model (robotics builds, group coding projects): the teacher groups pupils, records
 * the team's work, and approves it; approval passes the module project gate for every member.
 *
 * Scoped to a class this teacher owns (schoolId + teacherId). Pupil names travel in the body, never a URL.
 */

async function ownClass(schoolId: string, teacherId: string, classId: string) {
  return prisma.schoolClass.findFirst({
    where: { id: classId, schoolId, teacherId },
    select: { id: true, sessionLabel: true, programId: true },
  });
}

// A team the teacher owns (its class is theirs), or null.
async function ownTeam(schoolId: string, teacherId: string, teamId: string) {
  const team = await prisma.schoolProjectTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      schoolClassId: true,
      moduleId: true,
      schoolClass: { select: { schoolId: true, teacherId: true, sessionLabel: true } },
    },
  });
  if (!team || team.schoolClass.schoolId !== schoolId || team.schoolClass.teacherId !== teacherId) return null;
  return team;
}

export async function GET(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const moduleId = url.searchParams.get("moduleId");
  if (!classId || !moduleId) return fail("classId and moduleId are required.", 400);

  try {
    const cls = await ownClass(schoolId, session!.user.id, classId);
    if (!cls) return fail("Class not found.", 404);
    const gate = await checkClassLicense(schoolId, cls.sessionLabel);
    if (!gate.allowed) return fail(gate.reason, 403);

    const roster = await prisma.enrollment.findMany({
      where: { schoolClassId: classId, schoolId, status: EnrollmentStatus.ACTIVE },
      select: { userId: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    });
    const nameOf = new Map(roster.map((r) => [r.userId, `${r.user.firstName} ${r.user.lastName}`.trim()]));

    const teams = await prisma.schoolProjectTeam.findMany({
      where: { schoolClassId: classId, moduleId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        submissionNote: true,
        submissionUrl: true,
        reviewNote: true,
        reviewedByName: true,
        approvedAt: true,
        members: { select: { userId: true } },
      },
    });

    const assignedUserIds = new Set(teams.flatMap((t) => t.members.map((m) => m.userId)));

    return ok({
      classId,
      moduleId,
      teams: teams.map((t) => ({
        ...t,
        members: t.members.map((m) => ({ userId: m.userId, name: nameOf.get(m.userId) ?? "Former pupil" })),
      })),
      // Pupils not yet on a team for this module, so the UI knows who can still be added.
      roster: roster.map((r) => ({ userId: r.userId, name: nameOf.get(r.userId)!, assigned: assignedUserIds.has(r.userId) })),
    });
  } catch (error) {
    captureError(error);
    return fail("Could not load project teams.", 500);
  }
}

export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();
  const teacherId = session!.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const parsed = schoolProjectTeamSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());
  const p = parsed.data;

  try {
    if (p.action === "create") {
      if (!p.classId || !p.moduleId || !p.name) return fail("classId, moduleId and name are required.", 400);
      const cls = await ownClass(schoolId, teacherId, p.classId);
      if (!cls) return fail("Class not found.", 404);
      const licence = await checkClassLicense(schoolId, cls.sessionLabel);
      if (!licence.allowed) return fail(licence.reason, 403);
      // The module must belong to this class's course.
      const validModule = await prisma.module.findFirst({
        where: { id: p.moduleId, version: { curriculum: { programId: cls.programId ?? "" } } },
        select: { id: true },
      });
      if (!validModule) return fail("That unit is not part of this class's course.", 422);
      const team = await prisma.schoolProjectTeam.create({
        data: { schoolClassId: p.classId, moduleId: p.moduleId, name: p.name },
        select: { id: true },
      });
      return ok({ teamId: team.id }, 201);
    }

    if (p.action === "addMember") {
      if (!p.teamId || !p.userId) return fail("teamId and userId are required.", 400);
      const team = await ownTeam(schoolId, teacherId, p.teamId);
      if (!team) return fail("Team not found.", 404);
      // The pupil must be an active member of this team's class.
      const enrolled = await prisma.enrollment.findFirst({
        where: { userId: p.userId, schoolClassId: team.schoolClassId, schoolId, status: EnrollmentStatus.ACTIVE },
        select: { id: true },
      });
      if (!enrolled) return fail("That pupil is not in this class.", 422);
      // One team per pupil per module: reject if they are already on a team for this module.
      const already = await prisma.schoolProjectTeamMember.findFirst({
        where: { userId: p.userId, team: { schoolClassId: team.schoolClassId, moduleId: team.moduleId } },
        select: { id: true },
      });
      if (already) return fail("That pupil is already on a team for this unit.", 409);
      await prisma.schoolProjectTeamMember.create({ data: { teamId: p.teamId, userId: p.userId } });
      return ok({ added: true });
    }

    if (p.action === "removeMember") {
      if (!p.teamId || !p.userId) return fail("teamId and userId are required.", 400);
      const team = await ownTeam(schoolId, teacherId, p.teamId);
      if (!team) return fail("Team not found.", 404);
      await prisma.schoolProjectTeamMember.deleteMany({ where: { teamId: p.teamId, userId: p.userId } });
      return ok({ removed: true });
    }

    if (p.action === "review") {
      if (!p.teamId || !p.status) return fail("teamId and status are required.", 400);
      const team = await ownTeam(schoolId, teacherId, p.teamId);
      if (!team) return fail("Team not found.", 404);
      const me = await prisma.user.findUnique({ where: { id: teacherId }, select: { firstName: true, lastName: true } });
      const status = p.status as ProjectTeamStatus;
      await prisma.schoolProjectTeam.update({
        where: { id: p.teamId },
        data: {
          status,
          reviewNote: p.reviewNote ?? null,
          submissionNote: p.submissionNote ?? undefined,
          submissionUrl: p.submissionUrl ?? undefined,
          reviewedById: teacherId,
          reviewedByName: me ? teacherDisplayName(me) : null,
          approvedAt: status === ProjectTeamStatus.APPROVED ? new Date() : null,
        },
      });
      // Pass (or reset) the module project gate for every member.
      const members = await prisma.schoolProjectTeamMember.findMany({ where: { teamId: p.teamId }, select: { userId: true } });
      await applyProjectGate({ moduleId: team.moduleId, status, members });
      return ok({ reviewed: true, status });
    }

    if (p.action === "delete") {
      if (!p.teamId) return fail("teamId is required.", 400);
      const team = await ownTeam(schoolId, teacherId, p.teamId);
      if (!team) return fail("Team not found.", 404);
      await prisma.schoolProjectTeam.delete({ where: { id: p.teamId } });
      return ok({ deleted: true });
    }

    return fail("Unknown action.", 400);
  } catch (error) {
    captureError(error);
    return fail("Could not update project teams.", 500);
  }
}
