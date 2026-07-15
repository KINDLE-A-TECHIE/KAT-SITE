import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { BillingPanel } from "@/components/school/billing-panel";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * School billing. SCHOOL_ADMIN only.
 *
 * DELIBERATELY NOT LICENCE-GATED. This is the page the admin comes to when the licence
 * has lapsed; gating it behind an active licence would be a deadlock, the school could
 * never pay its way back in.
 */
export default async function SchoolBillingPage() {
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

      {/* BillingPanel reads the ?reference= Paystack sends back, so it needs Suspense. */}
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
        <BillingPanel />
      </Suspense>
    </section>
  );
}
