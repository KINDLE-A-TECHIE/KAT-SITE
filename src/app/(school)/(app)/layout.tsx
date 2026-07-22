import type { ReactNode } from "react";
import { SchoolRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { r2PublicUrl } from "@/lib/r2";
import { SchoolShell } from "@/components/school/school-shell";

/**
 * The school dashboard chrome (sidebar shell), scoped to /admin, /teach, /learn via this route group,
 * so the embed and /home stay chrome-free. No authorization here: each page enforces its own school +
 * role guard (ensureSchoolMembership / ensureSchoolStudent). The shell only needs display data.
 */
export default async function SchoolAppLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  const memberships = session?.user?.schoolMemberships ?? [];
  const isSchoolAdmin = memberships.some((m) => m.role === SchoolRole.SCHOOL_ADMIN);
  const isTeacher = memberships.some((m) => m.role === SchoolRole.TEACHER);

  // Resolve the active school (name + logo): staff via their membership, a pupil via their enrollment.
  let schoolId: string | null = memberships[0]?.schoolId ?? null;
  if (!schoolId && session?.user?.id) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: session.user.id, schoolId: { not: null } },
      select: { schoolId: true },
    });
    schoolId = enrollment?.schoolId ?? null;
  }
  const school = schoolId
    ? await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, logoKey: true } })
    : null;

  return (
    <SchoolShell
      user={{ firstName: session?.user?.firstName ?? "", lastName: session?.user?.lastName ?? "" }}
      schoolName={school?.name ?? "Your school"}
      logoUrl={school?.logoKey ? r2PublicUrl(school.logoKey) : null}
      isSchoolAdmin={isSchoolAdmin}
      isTeacher={isTeacher}
    >
      {children}
    </SchoolShell>
  );
}
