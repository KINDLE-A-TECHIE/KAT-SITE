import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchoolRole } from "@prisma/client";
import { requireActiveSchool } from "@/lib/school";
import { SchoolTeachersPanel } from "@/components/school/school-teachers-panel";

/** SCHOOL_ADMIN: invite and manage the teachers who deliver this school's classes. */
export default async function SchoolTeachersPage() {
  try {
    await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]);
  } catch {
    // Wrong role / no membership → /home routes them to the right shell.
    redirect("/home");
  }

  return (
    <section className="space-y-6">
      <header>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-orange-600 dark:text-stone-400"
        >
          <ArrowLeft className="size-4" />
          Back to overview
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
          Teachers
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Invite the teachers who deliver your classes, and remove those who leave. Teachers do not
          use a seat.
        </p>
      </header>

      <SchoolTeachersPanel />
    </section>
  );
}
