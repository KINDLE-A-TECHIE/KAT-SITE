import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { SCHOOL_HOST } from "@/lib/school-host";
import { EmbedSettingsPanel } from "@/components/school/embed-settings-panel";

/**
 * Embed settings. SCHOOL_ADMIN only, scoped to their own school.
 *
 * Not licence-gated: an admin whose term has lapsed must still be able to reach their settings
 * (and billing), same rule as the reports page.
 */
export default async function SchoolEmbedPage() {
  try {
    await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]);
  } catch {
    redirect("/home");
  }

  return (
    <section className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-orange-600 dark:text-stone-400"
      >
        <ArrowLeft className="size-3.5" />
        Back to overview
      </Link>

      <div>
        <h1 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
          Put KAT inside your own website
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500 dark:text-stone-400">
          Pupils click through from your portal and land in their lessons already signed in. No
          second password to remember. Lessons only: a teacher view would put your pupils&apos; names
          on a page we cannot protect.
        </p>
      </div>

      <EmbedSettingsPanel embedHost={SCHOOL_HOST} />
    </section>
  );
}
