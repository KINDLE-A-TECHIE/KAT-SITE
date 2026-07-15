import { z } from "zod";
import { NotificationType, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INSTRUCTOR_ROLES: UserRole[] = [UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

const createSchema = z.object({
  contentId:  z.string().cuid(),
  inviteeIds: z.array(z.string().cuid()).min(1).max(50),
  sessionId:  z.string().cuid().optional(),
  message:    z.string().max(500).optional(),
});

// GET /api/playground-invites?contentId=X
// Students fetch their pending invite for a specific playground.
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const contentId = new URL(request.url).searchParams.get("contentId");
  if (!contentId) return fail("contentId is required.", 400);

  const invite = await prisma.playgroundInvite.findFirst({
    where: { contentId, inviteeId: session.user.id, status: "PENDING" },
    select: {
      id:         true,
      sessionId:  true,
      message:    true,
      createdAt:  true,
      invitedBy:  { select: { firstName: true, lastName: true } },
      content:    { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ invite });
}

// POST /api/playground-invites
// Instructor/admin invites one or more students to a playground (optionally into an active session).
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!INSTRUCTOR_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const body = await request.json() as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const { contentId, inviteeIds, sessionId, message } = parsed.data;

  // Verify content exists
  const content = await prisma.lessonContent.findUnique({
    where: { id: contentId },
    select: { id: true, title: true, lesson: { select: { title: true } } },
  });
  if (!content) return fail("Content not found.", 404);

  // Verify session if provided
  if (sessionId) {
    const peerSession = await prisma.peerSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    if (!peerSession || peerSession.status !== "ACTIVE") {
      return fail("Peer session is not active.", 400);
    }
  }

  // Upsert invites and send notifications
  const inviterName = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim();
  const playgroundTitle = content.title ?? "a code playground";

  const created = await Promise.all(
    inviteeIds.map(async (inviteeId) => {
      // Upsert: if already pending, refresh it (new sessionId/message)
      const invite = await prisma.playgroundInvite.upsert({
        where: { contentId_inviteeId: { contentId, inviteeId } },
        create: {
          contentId,
          invitedById: session.user.id,
          inviteeId,
          sessionId:   sessionId ?? null,
          message:     message   ?? null,
          status:      "PENDING",
        },
        update: {
          invitedById: session.user.id,
          sessionId:   sessionId ?? null,
          message:     message   ?? null,
          status:      "PENDING",
          createdAt:   new Date(),
        },
        select: { id: true },
      });

      // Notification
      const notifBody = JSON.stringify({
        text: sessionId
          ? `${inviterName} invited you to join a live coding session on "${playgroundTitle}". Open the lesson to join.`
          : `${inviterName} assigned you to practice on "${playgroundTitle}". Open the lesson to get started.`,
        targetPath: "/dashboard",
      });

      await prisma.notification.create({
        data: {
          recipientId: inviteeId,
          creatorId:   session.user.id,
          type:        sessionId ? NotificationType.SUCCESS : NotificationType.INFO,
          title:       sessionId ? "Live session invite" : "Playground assignment",
          body:        notifBody,
        },
      });

      return invite;
    }),
  );

  return ok({ invites: created }, 201);
}
