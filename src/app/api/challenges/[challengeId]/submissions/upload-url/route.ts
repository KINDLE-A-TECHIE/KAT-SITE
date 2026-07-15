import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePresignedUploadUrl, r2PublicUrl } from "@/lib/r2";
import { randomUUID } from "crypto";

interface Params { params: Promise<{ challengeId: string }> }

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

const schema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive().max(MAX_SIZE, { message: "File too large (max 50 MB)." }),
});

const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!LEARNER_ROLES.includes(session.user.role as UserRole)) return fail("Only students can submit to challenges.", 403);

  const { challengeId } = await params;
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, published: true },
  });
  if (!challenge?.published) return fail("Challenge not found or not available.", 404);

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const { name, mimeType, size } = parsed.data;
  const ext = name.split(".").pop() ?? "bin";
  const key = `challenges/${challengeId}/submissions/${randomUUID()}.${ext}`;

  const uploadUrl = await generatePresignedUploadUrl(key, mimeType);
  const publicUrl = r2PublicUrl(key);

  return ok({ uploadUrl, key, publicUrl, name, mimeType, size });
}
