import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GradesPanel } from "@/components/dashboard/grades-panel";
import { PageHeader } from "@/components/dashboard/page-header";

const ALLOWED: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW, UserRole.PARENT];

export default async function GradesPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (!ALLOWED.includes(session.user.role as UserRole)) redirect("/dashboard");

  const isParent = session.user.role === UserRole.PARENT;

  let children: { id: string; firstName: string; lastName: string; email: string }[] = [];
  if (isParent) {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: session.user.id },
      include: { child: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    children = links.map((l) => l.child);
  }

  return (
    <section className="space-y-4">
      <PageHeader
        badge={isParent ? "Family" : "Academic Record"}
        title={isParent ? "Children's Grades" : "My Grades"}
        subtitle={
          isParent
            ? "Assessment scores, instructor feedback, and progress for each of your enrolled children."
            : "Your scores, pass/fail status, and instructor feedback across every enrolled programme."
        }
      />
      <GradesPanel isParent={isParent} children={isParent ? children : undefined} />
    </section>
  );
}
