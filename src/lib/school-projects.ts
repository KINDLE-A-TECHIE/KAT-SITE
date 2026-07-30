import { GateStatus, ProjectTeamStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Apply a project team's review to its members' module project gate. APPROVED passes the gate for every
 * member; anything else marks it in-progress (so an un-approval does not leave a stale pass). REPORT-ONLY,
 * like the assessment gate: it records mastery, it never blocks advancement. Never throws.
 */
export async function applyProjectGate(team: {
  moduleId: string;
  status: ProjectTeamStatus;
  members: { userId: string }[];
}): Promise<void> {
  try {
    const moduleRecord = await prisma.module.findUnique({
      where: { id: team.moduleId },
      select: { version: { select: { curriculum: { select: { programId: true } } } } },
    });
    const programId = moduleRecord?.version?.curriculum?.programId;
    if (!programId) return;

    const passed = team.status === ProjectTeamStatus.APPROVED;
    const gate = passed ? GateStatus.PASSED : GateStatus.IN_PROGRESS;
    const projectPassedAt = passed ? new Date() : null;

    for (const member of team.members) {
      const enrollment = await prisma.enrollment.findFirst({
        where: { userId: member.userId, programId },
        select: { id: true },
      });
      if (!enrollment) continue;
      await prisma.moduleGateStatus.upsert({
        where: { userId_moduleId: { userId: member.userId, moduleId: team.moduleId } },
        create: { userId: member.userId, moduleId: team.moduleId, enrollmentId: enrollment.id, projectGate: gate, projectPassedAt },
        update: { projectGate: gate, projectPassedAt },
      });
    }
  } catch {
    /* a gate is a signal, never crash the review request over it */
  }
}
