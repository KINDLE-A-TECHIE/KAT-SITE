import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES } from "@/lib/roles";
import { buildVisibleProfilePreview } from "@/lib/profile-visibility";

const DEFAULT_CONTACTS_LIMIT = 50;
const MAX_CONTACTS_LIMIT = 200;

function parseContactsLimit(raw: string | null): number {
  if (!raw) return DEFAULT_CONTACTS_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CONTACTS_LIMIT;
  return Math.min(Math.floor(n), MAX_CONTACTS_LIMIT);
}

function parseContactsOffset(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Synchronous permission check using pre-fetched data.
 * Avoids N+1 DB hits by receiving the sender's role from the session
 * and the recipient role from the already-fetched user list.
 * Mentorships are pre-fetched once for STUDENT/FELLOW senders.
 */
function canMessageSync(
  senderRole: UserRole,
  recipientRole: UserRole,
  recipientId: string,
  mentorshipTargetIds: Set<string> | null,
): boolean {
  if (senderRole === UserRole.SUPER_ADMIN) return true;
  if (ADMIN_ROLES.includes(senderRole)) return true;

  switch (senderRole) {
    case UserRole.PARENT:
      return ADMIN_ROLES.includes(recipientRole);

    case UserRole.STUDENT:
      if (recipientRole === UserRole.INSTRUCTOR || ADMIN_ROLES.includes(recipientRole)) return true;
      if (recipientRole === UserRole.FELLOW) return mentorshipTargetIds?.has(recipientId) ?? false;
      return false;

    case UserRole.FELLOW:
      if (recipientRole === UserRole.INSTRUCTOR || ADMIN_ROLES.includes(recipientRole)) return true;
      if (recipientRole === UserRole.STUDENT) return mentorshipTargetIds?.has(recipientId) ?? false;
      return false;

    case UserRole.INSTRUCTOR:
      return (
        recipientRole === UserRole.STUDENT ||
        recipientRole === UserRole.FELLOW ||
        ADMIN_ROLES.includes(recipientRole)
      );

    default:
      return false;
  }
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const url = new URL(request.url);
  const skillQuery = url.searchParams.get("skill")?.trim().toLowerCase() ?? "";
  const limit = parseContactsLimit(url.searchParams.get("limit"));
  const offset = parseContactsOffset(url.searchParams.get("offset"));

  const canFilterBySkill =
    session.user.role === UserRole.SUPER_ADMIN ||
    session.user.role === UserRole.ADMIN ||
    session.user.role === UserRole.INSTRUCTOR;

  const senderRole = session.user.role;

  // Pre-fetch mentorships in a single query for roles that need it.
  // STUDENT: needs fellowIds they are mentored by
  // FELLOW: needs studentIds they are mentoring
  let mentorshipTargetIds: Set<string> | null = null;
  if (senderRole === UserRole.STUDENT || senderRole === UserRole.FELLOW) {
    const mentorships = await prisma.mentorship.findMany({
      where: {
        active: true,
        ...(senderRole === UserRole.STUDENT
          ? { studentId: session.user.id }
          : { fellowId: session.user.id }),
      },
      select: {
        fellowId: true,
        studentId: true,
      },
    });
    mentorshipTargetIds = new Set(
      mentorships.map((m) =>
        senderRole === UserRole.STUDENT ? m.fellowId : m.studentId,
      ),
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { not: session.user.id } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      profile: {
        select: {
          avatarUrl: true,
          headline: true,
          bio: true,
          location: true,
          githubUrl: true,
          linkedinUrl: true,
          twitterUrl: true,
          websiteUrl: true,
          summaryVisibility: true,
          linksVisibility: true,
          skillsVisibility: true,
          educationVisibility: true,
          experienceVisibility: true,
          skills: { select: { name: true } },
          education: {
            select: {
              school: true,
              degree: true,
              fieldOfStudy: true,
              isCurrent: true,
            },
          },
          experience: {
            select: {
              company: true,
              title: true,
              isCurrent: true,
            },
          },
        },
      },
    },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  });

  // Permission filtering — fully synchronous, zero extra DB queries
  const allowedUsers = users.filter((user) =>
    canMessageSync(senderRole, user.role, user.id, mentorshipTargetIds),
  );

  // Skill filter (applied before pagination)
  const filteredUsers =
    skillQuery && canFilterBySkill
      ? allowedUsers.filter((user) =>
          user.profile?.skills.some((skill) => skill.name.toLowerCase().includes(skillQuery)),
        )
      : allowedUsers;

  const total = filteredUsers.length;
  const paginatedUsers = filteredUsers.slice(offset, offset + limit);

  const contacts = paginatedUsers.map((user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.profile?.avatarUrl ?? null,
    profile: buildVisibleProfilePreview({
      context: {
        viewerId: session.user.id,
        viewerOrganizationId: session.user.organizationId,
        targetUserId: user.id,
        targetOrganizationId: user.organizationId,
      },
      visibilitySource: user.profile,
      profile: user.profile,
    }),
  }));

  return ok({
    contacts,
    meta: { total, limit, offset, hasMore: offset + limit < total },
  });
}
