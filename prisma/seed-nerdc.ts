import {
  type PrismaClient,
  ContentReviewStatus,
  CourseAudience,
  LessonContentType,
  NerdcLevel,
  ProgramLevel,
  Strand,
} from "@prisma/client";
import { NERDC_COURSES, type NerdcUnit } from "../src/lib/nerdc-crosswalk";

/**
 * Seeds the SCHOOL-audience NERDC curriculum from the crosswalk.
 *
 * Maps the schemes of work onto the EXISTING primitives, no school-specific
 * content engine:
 *
 *   Course (class year)  → Program (audience=SCHOOL, nerdcLevel, strand)
 *     Term / class unit  → Module  (carrying the unit's strand)
 *       Topic            → Lesson
 *         CODING topic   → a CODE_PLAYGROUND content block (the platform experience)
 *         DIGLIT topic   → no content block; slides/worksheets are attached later
 *                          via the existing content builder
 *
 * WHAT IS DELIBERATELY NOT SEEDED: lesson prose, slide/worksheet documents and
 * assessment questions. Those are real teaching material we do not have, inventing
 * them would put placeholder content in front of children and, for quizzes, would
 * gate their progress on fabricated questions. Coding module gates therefore stay
 * NOT_STARTED until real assessments are authored.
 *
 * IDEMPOTENT, and cheap on re-run: each course's tree is read ONCE, then only the
 * difference is written (bulk createMany). A row-at-a-time loop of upserts issues
 * ~650 sequential round-trips against a remote Postgres and takes minutes, this
 * keeps it to a handful of queries per course, and to ZERO writes when nothing has
 * changed.
 *
 * It never DELETES a lesson: Lesson → LessonProgress cascades, so pruning would
 * silently destroy children's progress. Removing a topic from the crosswalk leaves
 * its lesson behind, to be retired deliberately.
 */

const PROGRAM_LEVEL: Record<string, ProgramLevel> = {
  PRIMARY_1_3: ProgramLevel.BEGINNER,
  PRIMARY_4_6: ProgramLevel.BEGINNER,
  JSS: ProgramLevel.INTERMEDIATE,
  SSS: ProgramLevel.ADVANCED,
};

/** Course slugs from the earlier one-program-per-level seed; now superseded. */
const RETIRED_SLUGS = ["nerdc-primary-1-3", "nerdc-primary-4-6", "nerdc-jss", "nerdc-sss"];

/** A real starter for the unit's language, a tool affordance, not fabricated teaching copy. */
function starterCode(unit: NerdcUnit): { language: string; body: string } {
  switch (unit.playgroundLanguage) {
    case "html":
      return {
        language: "html",
        body: `<!-- ${unit.theme} -->\n<!doctype html>\n<html>\n  <head>\n    <title>My page</title>\n  </head>\n  <body>\n    <h1>Hello</h1>\n  </body>\n</html>\n`,
      };
    case "sql":
      return {
        language: "sql",
        body: `-- ${unit.theme}\n-- Try a query:\nSELECT 'hello' AS greeting;\n`,
      };
    case "python":
    default:
      return {
        language: "python",
        body: `# ${unit.theme}\n# Write your code below and press Run.\n\nprint("Hello, world!")\n`,
      };
  }
}

const moduleTitle = (u: NerdcUnit) => `${u.label}, ${u.theme}`;
const moduleDescription = (u: NerdcUnit) => `${u.theme}. Topics: ${u.topics.join("; ")}.`;

export async function seedNerdcCourses(
  prisma: PrismaClient,
  opts: { organizationId: string; createdById: string },
): Promise<void> {
  // Courses are independent of one another, so seed them concurrently. Serially,
  // the round-trip latency to a remote Postgres dominates and the whole seed takes
  // minutes even when there is nothing to write.
  await Promise.all(NERDC_COURSES.map((course) => seedCourse(prisma, course, opts)));
  await retireSupersededPrograms(prisma);
}

async function seedCourse(
  prisma: PrismaClient,
  course: (typeof NERDC_COURSES)[number],
  opts: { organizationId: string; createdById: string },
): Promise<void> {
  const { organizationId, createdById } = opts;

  {
    const programData = {
      name: course.name,
      // In the update branch too, so a wording fix in the crosswalk reaches
      // existing rows on re-seed instead of living only on fresh databases.
      description: `${course.subject}, ${course.classYear}, NERDC-aligned.`,
      level: PROGRAM_LEVEL[course.nerdcLevel],
      audience: CourseAudience.SCHOOL,
      nerdcLevel: course.nerdcLevel as NerdcLevel,
      strand: course.strand as Strand,
      organizationId,
      // Schools are billed per seat, per term via SchoolInvoice, never the B2C
      // monthly subscription. monthlyFee is required by the model, so it is 0.
      monthlyFee: 0,
      durationWeeks: 36,
      isActive: true,
      // Seeded crosswalk courses are canonical and live, not drafts.
      isPublished: true,
    };

    const program = await prisma.program.upsert({
      where: { slug: course.slug },
      update: programData,
      create: {
        ...programData,
        slug: course.slug,
      },
      select: { id: true },
    });

    const curriculum = await prisma.curriculum.upsert({
      where: { programId: program.id },
      update: {},
      create: { programId: program.id, organizationId },
      select: { id: true },
    });

    // CurriculumVersion has no natural unique key, key on version number.
    let version = await prisma.curriculumVersion.findFirst({
      where: { curriculumId: curriculum.id, versionNumber: 1 },
      select: { id: true },
    });
    if (!version) {
      version = await prisma.curriculumVersion.create({
        data: {
          curriculumId: curriculum.id,
          versionNumber: 1,
          label: "Scheme of work v1",
          isActive: true,
          publishedAt: new Date(),
          createdById,
        },
        select: { id: true },
      });
    }

    // ── Read the whole tree for this course in ONE query ──────────────────────
    let modules = await prisma.module.findMany({
      where: { versionId: version.id },
      select: { id: true, sortOrder: true, title: true, description: true, strand: true },
    });
    const moduleBySort = new Map(modules.map((m) => [m.sortOrder, m]));

    // ── Modules: create the missing, update only the changed ──────────────────
    const missingModules = course.units
      .filter((u) => !moduleBySort.has(u.order - 1))
      .map((u) => ({
        versionId: version!.id,
        title: moduleTitle(u),
        description: moduleDescription(u),
        strand: u.strand as Strand,
        sortOrder: u.order - 1,
      }));
    if (missingModules.length > 0) {
      await prisma.module.createMany({ data: missingModules });
      modules = await prisma.module.findMany({
        where: { versionId: version.id },
        select: { id: true, sortOrder: true, title: true, description: true, strand: true },
      });
      moduleBySort.clear();
      for (const m of modules) moduleBySort.set(m.sortOrder, m);
    }

    for (const unit of course.units) {
      const existing = moduleBySort.get(unit.order - 1);
      if (!existing) continue;
      const title = moduleTitle(unit);
      const description = moduleDescription(unit);
      const strand = unit.strand as Strand;
      // Skip the write entirely when nothing changed, this is what makes a
      // re-seed cost nothing.
      if (
        existing.title !== title ||
        existing.description !== description ||
        existing.strand !== strand
      ) {
        await prisma.module.update({
          where: { id: existing.id },
          data: { title, description, strand },
        });
      }
    }

    const moduleIds = modules.map((m) => m.id);

    // ── Lessons: one read, one bulk create ────────────────────────────────────
    let lessons = await prisma.lesson.findMany({
      where: { moduleId: { in: moduleIds } },
      select: { id: true, moduleId: true, sortOrder: true, title: true },
    });
    const lessonKey = (moduleId: string, sortOrder: number) => `${moduleId}:${sortOrder}`;
    const lessonByKey = new Map(lessons.map((l) => [lessonKey(l.moduleId, l.sortOrder), l]));

    const missingLessons: Array<{ moduleId: string; title: string; sortOrder: number }> = [];
    for (const unit of course.units) {
      const mod = moduleBySort.get(unit.order - 1);
      if (!mod) continue;
      unit.topics.forEach((topic, i) => {
        if (!lessonByKey.has(lessonKey(mod.id, i))) {
          missingLessons.push({ moduleId: mod.id, title: topic, sortOrder: i });
        }
      });
    }
    if (missingLessons.length > 0) {
      await prisma.lesson.createMany({ data: missingLessons });
      lessons = await prisma.lesson.findMany({
        where: { moduleId: { in: moduleIds } },
        select: { id: true, moduleId: true, sortOrder: true, title: true },
      });
      lessonByKey.clear();
      for (const l of lessons) lessonByKey.set(lessonKey(l.moduleId, l.sortOrder), l);
    }

    // Retitle only where the scheme's topic changed.
    for (const unit of course.units) {
      const mod = moduleBySort.get(unit.order - 1);
      if (!mod) continue;
      for (const [i, topic] of unit.topics.entries()) {
        const lesson = lessonByKey.get(lessonKey(mod.id, i));
        if (lesson && lesson.title !== topic) {
          await prisma.lesson.update({ where: { id: lesson.id }, data: { title: topic } });
        }
      }
    }

    // Sample lessons: the first lesson of each module is a free taster a school's staff can preview on
    // an unlicensed term. Reconciled both ways so re-seeding keeps exactly one sample per module.
    await prisma.lesson.updateMany({
      where: { moduleId: { in: moduleIds }, sortOrder: 0 },
      data: { isSample: true },
    });
    await prisma.lesson.updateMany({
      where: { moduleId: { in: moduleIds }, sortOrder: { not: 0 } },
      data: { isSample: false },
    });

    // ── Playgrounds for CODING topics: one read, one bulk create ──────────────
    const codingLessonIds: string[] = [];
    const desiredContent = new Map<string, { title: string; body: string; language: string }>();

    for (const unit of course.units) {
      if (unit.strand !== Strand.CODING) continue; // DIGLIT: no content invented here
      const mod = moduleBySort.get(unit.order - 1);
      if (!mod) continue;
      const { language, body } = starterCode(unit);
      unit.topics.forEach((topic, i) => {
        const lesson = lessonByKey.get(lessonKey(mod.id, i));
        if (!lesson) return;
        codingLessonIds.push(lesson.id);
        desiredContent.set(lesson.id, { title: `${topic}, playground`, body, language });
      });
    }

    if (codingLessonIds.length > 0) {
      const existingContents = await prisma.lessonContent.findMany({
        where: { lessonId: { in: codingLessonIds }, sortOrder: 0 },
        select: { id: true, lessonId: true, title: true, body: true, language: true },
      });
      const contentByLesson = new Map(existingContents.map((c) => [c.lessonId, c]));

      const missingContents = codingLessonIds
        .filter((id) => !contentByLesson.has(id))
        .map((lessonId) => {
          const d = desiredContent.get(lessonId)!;
          return {
            lessonId,
            type: LessonContentType.CODE_PLAYGROUND,
            title: d.title,
            body: d.body,
            language: d.language,
            sortOrder: 0,
            // Learners only ever see PUBLISHED content.
            reviewStatus: ContentReviewStatus.PUBLISHED,
            createdById,
          };
        });
      if (missingContents.length > 0) {
        await prisma.lessonContent.createMany({ data: missingContents });
      }

      for (const [lessonId, d] of desiredContent) {
        const existing = contentByLesson.get(lessonId);
        if (existing && (existing.title !== d.title || existing.body !== d.body || existing.language !== d.language)) {
          await prisma.lessonContent.update({
            where: { id: existing.id },
            data: { title: d.title, body: d.body, language: d.language },
          });
        }
      }
    }
  }
}

/**
 * Removes the one-program-per-level courses from the first pass. They are now
 * ambiguous (three courses share PRIMARY_4_6), so leaving them would pollute the
 * teacher's course picker. Refuses to delete anything a class or student is
 * actually attached to.
 */
async function retireSupersededPrograms(prisma: PrismaClient): Promise<void> {
  for (const slug of RETIRED_SLUGS) {
    const program = await prisma.program.findUnique({
      where: { slug },
      select: { id: true, _count: { select: { enrollments: true, SchoolClass: true } } },
    });
    if (!program) continue;

    if (program._count.enrollments > 0 || program._count.SchoolClass > 0) {
      console.warn(
        `[nerdc] Superseded program "${slug}" still has ${program._count.enrollments} enrollment(s) ` +
          `and ${program._count.SchoolClass} class(es), leaving it in place. Migrate them, then remove it.`,
      );
      continue;
    }

    await prisma.program.delete({ where: { id: program.id } });
  }
}
