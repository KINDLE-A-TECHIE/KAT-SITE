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
    sub: "Monitor health, revenue, and access across the entire KAT Academy platform.",
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
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0D1F45] px-6 py-7 text-white">
        {/* Subtle background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-12 left-8 h-40 w-40 rounded-full bg-indigo-600/10 blur-2xl" />
        </div>

        <div className="relative">
          <span className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-blue-300">
            {meta.label}
          </span>
          <h1 className="mt-3 [font-family:var(--font-space-grotesk)] text-2xl font-bold tracking-tight">
            {role === "FELLOW" || role === "STUDENT" || role === "PARENT"
              ? `Welcome back, ${firstName}`
              : meta.greeting}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-300">
            {meta.sub}
          </p>
        </div>
      </div>

      <OverviewPanel role={role} />
    </section>
  );
}
