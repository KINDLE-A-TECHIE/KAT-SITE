import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { ApiKeysPanel } from "@/components/school/api-keys-panel";

/**
 * API keys. SCHOOL_ADMIN only, scoped to their own school.
 *
 * Not licence-gated: an admin whose term has lapsed must still be able to revoke a key.
 */
export default async function SchoolApiPage() {
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
          Connect your school&apos;s own systems
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500 dark:text-stone-400">
          Sync your roster from the system where you already keep your pupil records, pull progress
          and results into your own reports, and get a webhook when a pupil finishes a lesson. Send
          your developer to the{" "}
          <a
            href="https://kindleatechie.com/schools/developers"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-orange-600 underline underline-offset-2 hover:text-orange-700"
          >
            developer documentation
          </a>
          .
        </p>
      </div>

      <ApiKeysPanel />
    </section>
  );
}
