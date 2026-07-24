import sharp from "sharp";
import { SchoolRole } from "@prisma/client";
import { fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { ensureJoinCode, generatePin, hashPin } from "@/lib/student-pin";
import { renderLoginCardsPdf } from "@/lib/login-cards-pdf";
import { r2PublicUrl } from "@/lib/r2";
import { schoolLaunchOrigin } from "@/lib/request-host";
import { captureError } from "@/lib/sentry";

/**
 * Loads a school's logo as a small square PNG data URI for the cards. The logo is stored as WebP,
 * which @react-pdf/renderer cannot embed, so fetch it (it is served publicly) and transcode it, padded
 * to a transparent square so it never distorts at the card's fixed size. A logo problem must never
 * fail card printing, so any error returns null (the cards then show the school name alone).
 */
async function loadSchoolLogoPng(logoKey: string | null): Promise<string | null> {
  if (!logoKey) return null;
  try {
    const res = await fetch(r2PublicUrl(logoKey));
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(120, 120, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (error) {
    captureError(error);
    return null;
  }
}

/**
 * POST /api/school/classes/[classId]/login-cards, mint printable sign-in cards for a class.
 *
 * SCHOOL_ADMIN only, scoped to the active school (a foreign classId matches zero rows). Ensures the
 * class has a join code, then (re)generates a fresh 6-digit PIN for every active pupil, stores only
 * the HASH, and RENDERS the PDF here (server-side) so the plaintext PINs never leave this response
 * and the heavy PDF library stays off the client. This is also the "reset PINs" path: regenerating
 * invalidates any previously printed cards, which is the point when a card is lost.
 *
 * ATOMICITY: the rotation is one transaction. A row-at-a-time loop that failed halfway would leave
 * some pupils with new PINs and no printed card (their old card silently dead) while the admin got
 * an error, locking those children out. All-or-nothing avoids that. Hashes are computed in parallel
 * BEFORE the transaction so bcrypt's cost does not hold it open.
 *
 * Minors' data: names go only to the authenticated admin of THIS school (their own roster), never a
 * public surface, and no pupil identifier travels in the URL.
 */
export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const { classId } = await params;

  try {
    const schoolClass = await prisma.schoolClass.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true, school: { select: { name: true, logoKey: true } } },
    });
    if (!schoolClass) return fail("Class not found.", 404);

    const joinCode = await ensureJoinCode(schoolClass.id);

    const enrollments = await prisma.enrollment.findMany({
      where: { schoolClassId: schoolClass.id, schoolId, status: "ACTIVE" },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { user: { firstName: "asc" } },
    });
    if (enrollments.length === 0) return fail("This class has no pupils to make cards for.", 422);

    // Fresh PIN per pupil. Hash in PARALLEL (CPU-bound; keeps bcrypt off the transaction).
    const rows = await Promise.all(
      enrollments.map(async (e) => {
        const pin = generatePin();
        return {
          enrollmentId: e.id,
          pin,
          pinHash: await hashPin(pin),
          name: `${e.user.firstName} ${e.user.lastName}`.trim(),
        };
      }),
    );

    // Render the PDF FIRST, from the in-hand plaintext, THEN commit the rotation. If rendering fails,
    // nothing is rotated, so a render error can never leave pupils with a dead card and no new one.
    const pdf = await renderLoginCardsPdf({
      schoolName: schoolClass.school.name,
      schoolLogo: await loadSchoolLogoPng(schoolClass.school.logoKey),
      className: schoolClass.name,
      joinCode,
      pupils: rows.map((r) => ({ name: r.name, pin: r.pin })),
      origin: schoolLaunchOrigin(request),
    });

    // Persist all-or-nothing: a mid-way failure never leaves some pupils rotated and others not.
    await prisma.$transaction(
      rows.map((r) =>
        prisma.schoolStudentCredential.upsert({
          where: { enrollmentId: r.enrollmentId },
          update: { pinHash: r.pinHash, failedAttempts: 0, lockedUntil: null },
          create: { enrollmentId: r.enrollmentId, pinHash: r.pinHash },
        }),
      ),
    );

    const slug = schoolClass.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "class";
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sign-in-cards-${slug}.pdf"`,
        // The admin's UI reads this to confirm the class code without re-fetching.
        "X-Join-Code": joinCode,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    captureError(error);
    return fail("Could not generate login cards.", 500);
  }
}
