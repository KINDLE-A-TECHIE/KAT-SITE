import Link from "next/link";
import { BookOpen, ClipboardCheck, Code2, FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { termNumberForModule } from "@/lib/school-term";
import { MyCertificates } from "@/components/school/my-certificates";

/**
 * The framed learner view: this pupil's units and lessons.
 *
 * Deliberately thin. It reuses the existing curriculum records rather than a second engine, and it
 * shows the pupil ONLY their own programme, no roster, no classmates, no scores of others. An
 * iframe on a school's page is the least-trusted surface we have, so it renders the least.
 *
 * Lessons link to /learn/lessons/<id>, which is guarded by ensureSchoolStudent and the licence gate
 * exactly as it is outside the frame. The embed adds no new way to reach content.
 */
export async function EmbedLessons({
  programId,
  firstName,
  schoolName,
  licensedTerms,
  schoolSlug,
}: {
  programId: string;
  firstName: string;
  schoolName: string;
  /** Term numbers the school has unlocked. Modules of other terms render locked. */
  licensedTerms: number[];
  schoolSlug: string;
}) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { programId },
    select: {
      program: { select: { name: true } },
      versions: {
        where: { isActive: true },
        take: 1,
        select: {
          modules: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              strand: true,
              sortOrder: true,
              lessons: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true },
              },
            },
          },
        },
      },
    },
  });

  const modules = curriculum?.versions[0]?.modules ?? [];
  const licensed = new Set(licensedTerms);

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 font-body">
      <header className="flex items-start justify-between gap-3 border-b border-stone-200 pb-4 dark:border-stone-800">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">{schoolName}</p>
          <h1 className="mt-1 font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
            Hello {firstName}
          </h1>
        </div>
        <Link
          href={`/embed/${encodeURIComponent(schoolSlug)}/assessments`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/40"
        >
          <ClipboardCheck className="size-3.5" />
          Tests &amp; exams
        </Link>
      </header>

      <div className="mt-6">
        <MyCertificates apiPath="/api/school/embed/certificates" />
      </div>

      {modules.length === 0 ? (
        <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
          Your teacher has not opened any lessons yet.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {modules.map((m, i) => {
            const termNumber = termNumberForModule(m.sortOrder);
            const isLocked = !licensed.has(termNumber);
            return (
              <section key={m.id} className={isLocked ? "opacity-70" : undefined}>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
                    {i + 1}. {m.title}
                  </h2>
                  <Badge variant="secondary" className="gap-1">
                    {m.strand === "DIGLIT" ? (
                      <FileText className="size-3" />
                    ) : (
                      <Code2 className="size-3" />
                    )}
                    {m.strand === "DIGLIT" ? "Digital literacy" : "Coding"}
                  </Badge>
                </div>

                {isLocked ? (
                  <p className="mt-2 flex items-center gap-2 py-2.5 text-sm text-stone-500 dark:text-stone-400">
                    <Lock className="size-3.5 shrink-0" />
                    Term {termNumber} isn&apos;t licensed yet.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-stone-100 dark:divide-stone-800">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/learn/lessons/${l.id}`}
                          target="_top"
                          className="flex items-center gap-2 py-2.5 text-sm text-stone-700 transition hover:text-orange-600 dark:text-stone-300"
                        >
                          <BookOpen className="size-3.5 shrink-0 text-stone-400" />
                          {l.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
