import { SchoolApiScope, SchoolRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { issueSchoolApiKey, revokeSchoolApiKey } from "@/lib/school-api-key";
import { isValidOrigin } from "@/lib/school-embed";
import { captureError } from "@/lib/sentry";

/**
 * The school admin's embed settings: API keys and the framing allow-list.
 *
 * SCHOOL_ADMIN only, and every query carries `where: { schoolId }` derived from the session, never
 * from the request.
 */

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

// GET, current keys (prefix only) and origins.
export async function GET() {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  try {
    const [keys, origins, school] = await Promise.all([
      // NEVER hashedKey. The prefix is all a UI needs to tell two keys apart.
      prisma.schoolApiKey.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          // So a school can see which key is stale BEFORE rotating and taking down its own
          // integration.
          lastUsedAt: true,
          revokedAt: true,
          createdAt: true,
        },
      }),
      prisma.schoolAllowedOrigin.findMany({
        where: { schoolId },
        orderBy: { origin: "asc" },
        select: { id: true, origin: true },
      }),
      prisma.school.findUnique({ where: { id: schoolId }, select: { slug: true } }),
    ]);

    return ok({ keys, origins, slug: school?.slug ?? "" });
  } catch (error) {
    captureError(error);
    return fail("Could not load embed settings.", 500);
  }
}

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("issue-key"),
    name: z.string().trim().min(1).max(80).default("Embed key"),
    /** Scopes are explicit. A key issued from the EMBED page defaults to EMBED_MINT and nothing
     *  else, the ability to sign in as a pupil must never ride along on a reporting key. */
    scopes: z
      .array(z.nativeEnum(SchoolApiScope))
      .min(1)
      .default([SchoolApiScope.EMBED_MINT]),
  }),
  z.object({ action: z.literal("add-origin"), origin: z.string().trim().min(1).max(255) }),
]);

// POST, issue a key, or add an origin.
export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400);

  try {
    if (parsed.data.action === "issue-key") {
      const key = await issueSchoolApiKey(schoolId, parsed.data.name, parsed.data.scopes);
      // The ONLY time the secret exists outside the school's own systems. We store a SHA-256 of it
      // and nothing else, so we cannot show it again, which is the point.
      return ok({ secret: key.secret, prefix: key.prefix, id: key.id }, 201);
    }

    const { origin } = parsed.data;
    if (!isValidOrigin(origin)) {
      return fail(
        "Enter an exact origin, https only, e.g. https://portal.yourschool.edu.ng. No paths, and no wildcards: a wildcard would let any subdomain you have forgotten about frame a pupil's session.",
        422,
      );
    }

    const created = await prisma.schoolAllowedOrigin.upsert({
      where: { schoolId_origin: { schoolId, origin } },
      update: {},
      create: { schoolId, origin },
      select: { id: true, origin: true },
    });
    return ok({ origin: created }, 201);
  } catch (error) {
    captureError(error);
    return fail("Could not update embed settings.", 500);
  }
}

const deleteSchema = z.object({
  keyId: z.string().trim().min(1).max(64).optional(),
  originId: z.string().trim().min(1).max(64).optional(),
});

// DELETE, revoke a key, or remove an origin.
export async function DELETE(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400);

  try {
    // Keys are REVOKED, not deleted. A hard delete destroys the record of what a leaked key did,
    // which is exactly what you need to read after it leaks. (Origins carry no history, so those
    // are removed outright.)
    if (parsed.data.keyId) {
      await revokeSchoolApiKey(schoolId, parsed.data.keyId);
    }
    if (parsed.data.originId) {
      await prisma.schoolAllowedOrigin.deleteMany({
        where: { id: parsed.data.originId, schoolId },
      });
    }
    return ok({ ok: true });
  } catch (error) {
    captureError(error);
    return fail("Could not update embed settings.", 500);
  }
}
