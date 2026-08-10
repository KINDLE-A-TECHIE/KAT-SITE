// List EXACTLY what the public landing page is currently showing from the database, so you can spot
// QA junk (e.g. a test project titled "asdf", a nonsense testimonial) and clean it before real
// families see it. READ-ONLY: this script never writes or deletes anything.
//
//   node --env-file=.env.local scripts/list-landing-content.mjs
//
// It mirrors the two queries the landing runs (src/app/page.tsx): getRealBuilds() and the
// APPROVED+featured testimonials. To remove a junk row, open the dashboard:
//   - Projects  -> set the junk project to Needs Work / Rejected (or delete it) to pull it off the marquee.
//   - /dashboard/testimonials -> reject or un-feature the junk testimonial.
// There is no fabricated fallback, so once the junk is gone the space shows only real, approved work.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function line(n = 72) {
  return "-".repeat(n);
}

async function main() {
  // ── Builds (hero "Latest build" card + build-log marquee) ────────────────────────────────────
  // Same filter as getRealBuilds(): APPROVED, program.audience = B2C, newest first, cap 12.
  const builds = await prisma.project.findMany({
    where: { status: "APPROVED", program: { audience: "B2C" } },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      showcaseConsent: true,
      updatedAt: true,
      student: { select: { firstName: true, lastName: true } },
      program: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  console.log(`\nBUILDS on the landing (hero card + marquee): ${builds.length}`);
  console.log(line());
  if (builds.length === 0) {
    console.log("(none approved yet, the marquee and hero build card render nothing)");
  }
  for (const b of builds) {
    const cover = b.coverImageUrl ? "cover:yes" : "cover:NO ";
    const consent = b.showcaseConsent ? "photo-consent:yes" : "photo-consent:no ";
    const when = b.updatedAt.toISOString().slice(0, 10);
    console.log(
      `  ${cover}  ${consent}  ${when}  ${b.student.firstName} ${b.student.lastName}  ` +
        `[${b.program?.name ?? "no program"}]  "${b.title}"`,
    );
  }

  // ── Testimonials (parents section) ───────────────────────────────────────────────────────────
  const testimonials = await prisma.testimonial.findMany({
    where: { status: "APPROVED", featuredOnPage: true },
    select: {
      id: true,
      quote: true,
      rating: true,
      childName: true,
      submittedAt: true,
      author: { select: { firstName: true, lastName: true } },
    },
    orderBy: { submittedAt: "desc" },
    take: 12,
  });

  console.log(`\nTESTIMONIALS on the landing (parents section): ${testimonials.length}`);
  console.log(line());
  if (testimonials.length === 0) {
    console.log("(none approved+featured yet, the testimonials section renders nothing)");
  }
  for (const t of testimonials) {
    const quote = t.quote.length > 80 ? `${t.quote.slice(0, 77)}...` : t.quote;
    console.log(
      `  ${"*".repeat(t.rating)}  ${t.author.firstName} ${t.author.lastName}` +
        `${t.childName ? ` (parent of ${t.childName})` : ""}`,
    );
    console.log(`      "${quote}"`);
  }

  console.log(
    `\nAnything above that is not real, approved work is what to clean. This script only reads.\n`,
  );
}

main()
  .catch((err) => {
    console.error("FAILED:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
