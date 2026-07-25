import "server-only";
import { prisma } from "@/lib/prisma";
import { termNumberForModule } from "@/lib/school-term";

// A term certificate features at most this many highlight lessons: enough to read like an achievement,
// not so many it becomes a syllabus dump.
export const MAX_CERT_HIGHLIGHTS = 3;

/** True when the pupil has completed EVERY lesson in the module (a term). Empty module never counts. */
export async function isModuleComplete(userId: string, moduleId: string): Promise<boolean> {
  const lessons = await prisma.lesson.findMany({ where: { moduleId }, select: { id: true } });
  if (lessons.length === 0) return false;
  const done = await prisma.lessonProgress.count({
    where: { userId, lessonId: { in: lessons.map((l) => l.id) } },
  });
  return done === lessons.length;
}

export type SchoolCertificateSnapshot = {
  programTitle: string;
  moduleTitle: string;
  termNumber: number;
  highlightLessons: string[];
};

/**
 * Pick the lesson titles to feature on a certificate: up to `max` COMPLETED lessons the author flagged
 * (`certHighlight`), in the given (learning) order. When none are flagged, fall back to the first
 * completed lessons so a certificate is never empty. Pure, so the selection rule is unit-tested.
 */
export function pickHighlightTitles(
  lessons: { id: string; title: string; certHighlight: boolean }[],
  completedIds: Set<string>,
  max = MAX_CERT_HIGHLIGHTS,
): string[] {
  const completed = lessons.filter((l) => completedIds.has(l.id));
  const highlighted = completed.filter((l) => l.certHighlight);
  return (highlighted.length > 0 ? highlighted : completed).slice(0, max).map((l) => l.title);
}

/**
 * Build the immutable snapshot for a module (term) certificate: the program + module titles, the term
 * number, and up to MAX_CERT_HIGHLIGHTS titles of COMPLETED highlight lessons in learning order.
 * "Catchy" is an author's editorial call (Lesson.certHighlight); when none are flagged we fall back to
 * the first completed lessons so a certificate is never empty. Snapshotted so it survives later edits.
 */
export async function buildCertificateSnapshot(
  userId: string,
  moduleId: string,
): Promise<SchoolCertificateSnapshot | null> {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      title: true,
      sortOrder: true,
      version: { select: { curriculum: { select: { program: { select: { name: true } } } } } },
      lessons: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, certHighlight: true },
      },
    },
  });
  if (!mod) return null;

  const lessonIds = mod.lessons.map((l) => l.id);
  const completedIds = new Set(
    (
      await prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    ).map((p) => p.lessonId),
  );

  return {
    programTitle: mod.version.curriculum.program.name,
    moduleTitle: mod.title,
    termNumber: termNumberForModule(mod.sortOrder),
    highlightLessons: pickHighlightTitles(mod.lessons, completedIds),
  };
}
