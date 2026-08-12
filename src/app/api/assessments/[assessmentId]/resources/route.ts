import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { capabilityDenied } from "@/lib/capabilities";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ assessmentId: string }> }

const schema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  storageKey: z.string().min(1),
  url: z.string().url(),
  description: z.string().max(500).optional(),
});

const UPLOADER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!UPLOADER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  if (capabilityDenied(session.user, "assessments")) return fail("Forbidden", 403);

  const { assessmentId } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, program: { select: { organizationId: true } } },
  });
  if (!assessment) return fail("Assessment not found.", 404);

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    assessment.program.organizationId !== session.user.organizationId
  ) {
    return fail("Forbidden", 403);
  }

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const resource = await prisma.assessmentResource.create({
    data: {
      assessmentId,
      uploaderId: session.user.id,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType,
      size: parsed.data.size,
      storageKey: parsed.data.storageKey,
      url: parsed.data.url,
      description: parsed.data.description ?? null,
    },
    include: { uploader: { select: { firstName: true, lastName: true } } },
  });

  return ok({ resource }, 201);
}
