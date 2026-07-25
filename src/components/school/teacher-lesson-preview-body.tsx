"use client";

import { ContentBody, type ContentItem } from "@/components/dashboard/lesson-viewer";

/**
 * A teacher previewing a lesson gets the SAME interactive blocks a pupil does, runnable code
 * playgrounds, the interactive network lab, videos, worksheets, via the shared ContentBody renderer
 * (isCreator=false = the learner-facing, runnable form).
 *
 * What it deliberately leaves out is the MASTERY GATE machinery: blocks are shown stacked with no
 * step-completion, and no `onComplete` is wired, so a teacher's browsing never writes LessonProgress
 * or module-gate rows. Access here is gated only by the school licence (licensed term or a sample),
 * which the page enforces before rendering this.
 */
export function TeacherLessonPreviewBody({
  contents,
  userId,
  programId,
  moduleId,
}: {
  contents: ContentItem[];
  userId?: string;
  programId?: string;
  moduleId?: string;
}) {
  if (contents.length === 0) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">
        This lesson has no published content yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {contents.map((content) => (
        <section key={content.id}>
          <h2 className="mb-2 font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
            {content.title}
          </h2>
          {/* isCreator=false gives the runnable learner playground / interactive lab. No onBlockComplete,
              so a teacher running the block fires no completion gate side-effects. */}
          <ContentBody content={content} isCreator={false} userId={userId} programId={programId} moduleId={moduleId} />
        </section>
      ))}
    </div>
  );
}
