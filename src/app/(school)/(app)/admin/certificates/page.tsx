import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { CertificatesPanel } from "@/components/school/certificates-panel";

/**
 * School term certificates. SCHOOL_ADMIN only.
 *
 * Issuance itself is licence-gated (a school can only certify a term it holds an active
 * licence for), but the PAGE is not: an admin must always be able to see what has already
 * been issued, and lapsed-licence troubleshooting starts here same as billing.
 */
export default async function SchoolCertificatesPage() {
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

      <CertificatesPanel />
    </section>
  );
}
