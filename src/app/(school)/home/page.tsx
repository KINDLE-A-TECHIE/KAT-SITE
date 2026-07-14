import { redirect } from "next/navigation";
import { SchoolRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { getActiveSchool, ensureSchoolStudent } from "@/lib/school";

/**
 * Root of the school host (middleware rewrites `/` here).
 *
 * Routes the caller to their shell by school role. Renders an honest no-access
 * state rather than redirecting when the user has no school context, a redirect
 * would risk a loop, since the shells redirect back here on Forbidden.
 */
export default async function SchoolHomePage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const membership = await getActiveSchool();
  if (membership?.role === SchoolRole.SCHOOL_ADMIN) redirect("/admin");
  if (membership?.role === SchoolRole.TEACHER) redirect("/teach");

  // No membership, they may still be a student enrolled in a school.
  // NOTE: redirect() throws NEXT_REDIRECT, so it must stay OUT of the try block,
  // otherwise this catch would swallow the redirect.
  let isSchoolStudent = false;
  try {
    await ensureSchoolStudent();
    isSchoolStudent = true;
  } catch {
    isSchoolStudent = false;
  }
  if (isSchoolStudent) redirect("/learn");

  return (
    <div className="max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
        No school workspace
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
        Your account isn&apos;t linked to a school
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
        This workspace is for schools licensing the KAT curriculum. Ask your school administrator to
        add you, or request a pilot for your school.
      </p>
    </div>
  );
}
