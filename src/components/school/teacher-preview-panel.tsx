import Link from "next/link";
import { BookOpen, Lock, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getLicensedTermNumbers } from "@/lib/school-license";
import { resolveClassProgram } from "@/lib/roster-sync";
import { termNumberForModule } from "@/lib/school-term";

/**
 * A teacher's read-only preview of the lessons their class studies.
 *
 * Term-gated the same way pupils are (decision D), with ONE difference for staff: on a term the
 * school has not licensed, the term's SAMPLE lesson is still previewable, so the school can evaluate
 * it before buying. Everything else in an unlicensed term stays locked. Pupils never see samples.
 */
export async function TeacherPreviewPanel({
  classId,
  schoolId,
  sessionLabel,
  programId,
  nerdcLevel,
}: {
  classId: string;
  schoolId: string;
  sessionLabel: string;
  programId: string | null;
  nerdcLevel: string;
}) {
  const program = await resolveClassProgram({ programId, nerdcLevel });
  if ("error" in program) return null; // no course assigned yet, nothing to preview

  const curriculum = await prisma.curriculum.findUnique({
    where: { programId: program.id },
    select: {
      versions: {
        where: { isActive: true },
        take: 1,
        select: {
          modules: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              sortOrder: true,
              lessons: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true, isSample: true },
              },
            },
          },
        },
      },
    },
  });
  const modules = curriculum?.versions[0]?.modules ?? [];
  if (modules.length === 0) return null;

  const licensed = await getLicensedTermNumbers(schoolId, sessionLabel);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview lessons</CardTitle>
        <CardDescription>
          Read through what your class studies. Licensed terms are open. For a term you have not
          licensed yet, its sample lesson is previewable so you can see what it covers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {modules.map((m) => {
          const termNumber = termNumberForModule(m.sortOrder);
          const termLicensed = licensed.has(termNumber);
          return (
            <div key={m.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{m.title}</h3>
                {termLicensed ? null : (
                  <Badge className="gap-1 bg-stone-100 text-stone-500 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-400">
                    <Lock className="size-3" />
                    Term {termNumber} not licensed
                  </Badge>
                )}
              </div>
              <ul className="mt-1 divide-y divide-stone-100 dark:divide-stone-800">
                {m.lessons.length === 0 ? (
                  <li className="py-2 text-sm text-stone-400">No lessons in this unit yet.</li>
                ) : (
                  m.lessons.map((l) => {
                    const openable = termLicensed || l.isSample;
                    if (openable) {
                      return (
                        <li key={l.id}>
                          <Link
                            href={`/teach/${classId}/lessons/${l.id}`}
                            className="flex items-center gap-2 py-2 text-sm text-stone-700 transition hover:text-orange-600 dark:text-stone-300"
                          >
                            <BookOpen className="size-3.5 shrink-0 text-stone-400" />
                            {l.title}
                            {!termLicensed && l.isSample ? (
                              <Badge className="ml-auto gap-1 bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400">
                                <Sparkles className="size-3" />
                                Sample
                              </Badge>
                            ) : null}
                          </Link>
                        </li>
                      );
                    }
                    return (
                      <li
                        key={l.id}
                        className="flex items-center gap-2 py-2 text-sm text-stone-400 dark:text-stone-500"
                      >
                        <Lock className="size-3.5 shrink-0" />
                        {l.title}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
