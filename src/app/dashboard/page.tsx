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
    sub: "Revenue, activity, and access controls.",
  },
  ADMIN: {
    label: "Admin",
    greeting: "Operations Hub",
    sub: "Cohort progress, payment review, and your messages.",
  },
  INSTRUCTOR: {
    label: "Instructor",
    greeting: "Teaching Hub",
    sub: "Grade submissions and run your live sessions.",
  },
  FELLOW: {
    label: "Fellow",
    greeting: "Fellow Hub",
    sub: "Your mentees, upcoming sessions, and cohort.",
  },
  STUDENT: {
    label: "Student",
    greeting: "My Workspace",
    sub: "Your assessments, classes, and progress.",
  },
  PARENT: {
    label: "Parent",
    greeting: "Parent Portal",
    sub: "Your child's progress, grades, and payments.",
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
