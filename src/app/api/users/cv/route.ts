import { fail } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { getCvData } from "@/lib/cv-data";
import { renderCvPdf } from "@/lib/cv-pdf";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/users/cv: the signed-in user's CV as a PDF.
 *
 * Self-scoped by construction: the user id comes from the session, never from
 * the request, so this route can only export the caller's own data. Any
 * authenticated role may use it (a parent's CV is simply sparse).
 */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  try {
    const cv = await getCvData(session.user.id);
    if (!cv) return fail("User not found.", 404);

    const pdf = await renderCvPdf(cv);
    const slug = cv.identity.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cv";

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cv-${slug}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    captureError(error);
    return fail("Could not generate your CV.", 500);
  }
}
