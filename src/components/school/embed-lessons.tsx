import Link from "next/link";
import { BookOpen, Code2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

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
}: {
  programId: string;
  firstName: string;
  schoolName: string;
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

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 font-body">
      <header className="border-b border-stone-200 pb-4 dark:border-stone-800">
        <p className="text-xs uppercase tracking-wide text-stone-400">{schoolName}</p>
        <h1 className="mt-1 font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
          Hello {firstName}
        </h1>
      </header>

      {modules.length === 0 ? (
        <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
          Your teacher has not opened any lessons yet.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {modules.map((m, i) => (
            <section key={m.id}>
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
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
