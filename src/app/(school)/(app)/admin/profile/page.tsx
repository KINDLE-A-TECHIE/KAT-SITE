import { redirect } from "next/navigation";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { prisma } from "@/lib/prisma";
import { r2PublicUrl } from "@/lib/r2";
import { SchoolLogoUploader } from "@/components/school/school-logo-uploader";
import type { SchoolMembershipClaim } from "@/lib/rbac";

/**
 * A deliberately simple school profile: the school's name and its logo. SCHOOL_ADMIN only.
 * Nothing like the B2C profile; a school's "profile picture" is just its logo.
 */
export default async function SchoolProfilePage() {
  let membership: SchoolMembershipClaim;
  try {
    membership = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]);
  } catch {
    redirect("/home");
  }

  const school = await prisma.school.findUnique({
    where: { id: membership.schoolId },
    select: { name: true, logoKey: true },
  });

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">School profile</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          {school?.name ?? "Your school"}
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Add your school logo. It stands in as your school&apos;s picture across your KAT workspace.
        </p>
      </div>

      <SchoolLogoUploader
        initialLogoUrl={school?.logoKey ? r2PublicUrl(school.logoKey) : null}
        schoolName={school?.name ?? "Your school"}
      />
    </section>
  );
}
