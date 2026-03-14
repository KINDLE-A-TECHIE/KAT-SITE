import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FellowApplyPanel } from "@/components/dashboard/fellow-apply-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function FellowApplyPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.STUDENT) redirect("/dashboard");

  const cohorts = await prisma.cohort.findMany({
    where: {
      program: { level: "FELLOWSHIP" },
      endsAt: { gt: new Date() },
    },
    select: { id: true, name: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: "asc" },
  });

  return (
    <section className="space-y-4">
      <PageHeader
        badge="Fellowship"
        title="Apply for Fellowship"
        subtitle="Fellows mentor junior students and lead cohort activities. Tell us why you're ready to step up — applications are reviewed by the admin team."
      />
      <FellowApplyPanel
        cohorts={cohorts.map((c) => ({
          ...c,
          startsAt: c.startsAt.toISOString(),
          endsAt: c.endsAt.toISOString(),
        }))}
      />
    </section>
  );
}
