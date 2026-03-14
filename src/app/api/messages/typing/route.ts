import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishMessageEvent } from "@/lib/messages-realtime";

const typingSchema = z.object({
  threadId: z.string().cuid(),
  isTyping: z.boolean(),
});

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const parsed = typingSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid typing payload.", 400, parsed.error.flatten());
    }

    // Verify the user is a member of the thread
    const membership = await prisma.threadParticipant.findUnique({
      where: {
        threadId_userId: {
          threadId: parsed.data.threadId,
          userId: session.user.id,
        },
        leftAt: null,
      },
      select: { id: true },
    });

    if (!membership) {
      return fail("Thread not found.", 404);
    }

    // Fetch all other active members to receive the typing event
    const participants = await prisma.threadParticipant.findMany({
      where: {
        threadId: parsed.data.threadId,
        leftAt: null,
        userId: { not: session.user.id },
      },
      select: { userId: true },
    });

    if (participants.length > 0) {
      publishMessageEvent(
        participants.map((p) => p.userId),
        {
          type: parsed.data.isTyping ? "typing_start" : "typing_stop",
          threadId: parsed.data.threadId,
          userId: session.user.id,
        },
      );
    }

    return ok({ ok: true });
  } catch (error) {
    return fail("Could not broadcast typing status.", 500, error instanceof Error ? error.message : error);
  }
}
