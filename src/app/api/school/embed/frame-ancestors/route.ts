import { NextResponse } from "next/server";
import { frameAncestorsFor } from "@/lib/school-embed";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/school/embed/frame-ancestors?slug=…, the CSP frame-ancestors value for one school.
 *
 * Exists solely so middleware (edge runtime, no Prisma) can build a PER-SCHOOL frame-ancestors
 * header. It is unauthenticated on purpose and leaks nothing: the value it returns is emitted as a
 * response header on the school's own embed page, so anyone who can load that page can already read
 * it.
 *
 * FAILS CLOSED. Any error, or a school with no configured origins, yields `'none'`, the embed
 * cannot be framed at all. The failure mode of a framing allow-list must never be "allow".
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ frameAncestors: "'none'" });

  try {
    const frameAncestors = await frameAncestorsFor(slug);
    return NextResponse.json(
      { frameAncestors },
      // Briefly cacheable: an origin change should take effect in about a minute, and this sits on
      // the critical path of every embed page load.
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    captureError(error);
    return NextResponse.json({ frameAncestors: "'none'" });
  }
}
