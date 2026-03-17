import { NotificationType, UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UNREAD_MESSAGES_SUMMARY_TITLE = "Unread messages";
type NotificationBodyPayload = {
  text: string;
  targetPath?: string;
  threadId?: string;
  messageId?: string;
};

function buildNotificationBody(payload: NotificationBodyPayload) {
  return JSON.stringify(payload);
}

function buildUnreadMessageSummaryBody(count: number) {
  if (count === 1) {
    return buildNotificationBody({
      text: "You have 1 unread message. Open Messages to read it.",
      targetPath: "/dashboard/messages",
    });
  }
  return buildNotificationBody({
    text: `You have ${count} unread messages. Open Messages to read them.`,
    targetPath: "/dashboard/messages",
  });
}

const createNotificationSchema = z.object({
  recipientId: z.string().cuid(),
  type: z.nativeEnum(NotificationType).optional(),
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(2000),
});

const markReadSchema = z.object({
  notificationId: z.string().cuid().optional(),
  markAll: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const recipientId = session.user.id;
  const unreadMessagesCount = await prisma.message.count({
    where: {
      senderId: { not: recipientId },
      thread: {
        participants: {
          some: {
            userId: recipientId,
            leftAt: null,
          },
        },
      },
      receipts: {
        none: {
          userId: recipientId,
        },
      },
    },
  });

  const existingUnreadSummary = await prisma.notification.findFirst({
    where: {
      recipientId,
      creatorId: null,
      title: UNREAD_MESSAGES_SUMMARY_TITLE,
      readAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (unreadMessagesCount > 0) {
    const body = buildUnreadMessageSummaryBody(unreadMessagesCount);
    if (existingUnreadSummary) {
      await prisma.notification.update({
        where: { id: existingUnreadSummary.id },
        data: { body },
      });
    } else {
      await prisma.notification.create({
        data: {
          recipientId,
          creatorId: null,
          type: NotificationType.INFO,
          title: UNREAD_MESSAGES_SUMMARY_TITLE,
          body,
        },
      });
    }
  } else if (existingUnreadSummary) {
    await prisma.notification.update({
      where: { id: existingUnreadSummary.id },
      data: { readAt: new Date() },
    });
  }

  const notifications = await prisma.notification.findMany({
    where: { recipientId, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return ok({ notifications });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ADMIN) {
    return fail("Forbidden", 403);
  }

  const body = await request.json();
  const parsed = createNotificationSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid notification payload.", 400, parsed.error.flatten());
  }

  const notification = await prisma.notification.create({
    data: {
      recipientId: parsed.data.recipientId,
      creatorId: session.user.id,
      type: parsed.data.type ?? NotificationType.INFO,
      title: parsed.data.title,
      body: parsed.data.body,
    },
  });

  return ok({ notification }, 201);
}

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const body = await request.json();
  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid payload.", 400, parsed.error.flatten());
  }

  if (parsed.data.markAll) {
    await prisma.notification.updateMany({
      where: {
        recipientId: session.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return ok({ success: true });
  }

  if (!parsed.data.notificationId) {
    return fail("notificationId is required.", 400);
  }

  const updated = await prisma.notification.updateMany({
    where: { id: parsed.data.notificationId, recipientId: session.user.id },
    data: { readAt: new Date() },
  });
  if (updated.count === 0) {
    return fail("Notification not found.", 404);
  }

  const notification = await prisma.notification.findUnique({
    where: { id: parsed.data.notificationId },
  });

  return ok({ notification });
}
