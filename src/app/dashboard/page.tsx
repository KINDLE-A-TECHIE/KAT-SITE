import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { OverviewPanel } from "@/components/dashboard/overview-panel";

const ROLE_META: Record<
  string,
  { label: string; greeting: string; sub: string }
> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    greeting: "Platform Overview",
    sub: "Monitor health, revenue, and access across the entire KAT Learning platform.",
  },
  ADMIN: {
    label: "Admin",
    greeting: "Operations Hub",
    sub: "Track cohorts, review payments, and stay connected with your team.",
  },
  INSTRUCTOR: {
    label: "Instructor",
    greeting: "Teaching Hub",
    sub: "Grade submissions, run live sessions, and mentor your learners.",
  },
  FELLOW: {
    label: "Fellow",
    greeting: "Fellow Hub",
    sub: "Here's everything you need to mentor and support your students.",
  },
  STUDENT: {
    label: "Student",
    greeting: "My Workspace",
    sub: "Track your assessments, join classes, and manage your learning journey.",
  },
  PARENT: {
    label: "Parent",
    greeting: "Parent Portal",
    sub: "Keep tabs on your child's progress, payments, and learning activity.",
  },
};

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const meta = ROLE_META[role] ?? ROLE_META.STUDENT;

  return (
    <section className="space-y-6">
      {/* Flat typographic header: mono kicker, display title, serif sub, one hairline. */}
      <header className="border-b border-stone-200 pb-5 dark:border-stone-800">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.28em] text-orange-700 dark:text-orange-500">
          {meta.label}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
          {role === "FELLOW" || role === "STUDENT" || role === "PARENT"
            ? `Welcome back, ${firstName}`
            : meta.greeting}
        </h1>
        <p className="mt-1.5 max-w-xl font-body text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          {meta.sub}
        </p>
      </header>

      <OverviewPanel role={role} firstName={firstName} />
    </section>
  );
}
