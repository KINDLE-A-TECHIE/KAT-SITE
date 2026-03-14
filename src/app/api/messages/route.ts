import { NotificationType, Prisma, ThreadType, UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  messageSchema,
  messageEditSchema,
  messageDeleteSchema,
  MAX_GROUP_SIZE,
  MESSAGE_RATE_LIMIT_WINDOW_MS,
  MESSAGE_RATE_LIMIT_MAX,
} from "@/lib/validators";
import { canMessageUser } from "@/lib/rbac";
import { trackEvent } from "@/lib/analytics";
import { publishMessageEvent } from "@/lib/messages-realtime";

// ── Rate limiting ─────────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);
  if (!entry || now - entry.windowStart > MESSAGE_RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MESSAGE_RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const groupThreadManageSchema = z
  .object({
    threadId: z.string().cuid(),
    title: z.string().trim().max(120).optional().nullable(),
    description: z.string().trim().max(2000).optional().nullable(),
    addUserIds: z.array(z.string().cuid()).min(1).optional(),
    removeUserId: z.string().cuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.title === undefined &&
      data.description === undefined &&
      data.addUserIds === undefined &&
      data.removeUserId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide title, description, addUserIds, or removeUserId.",
        path: ["threadId"],
      });
    }
  });

const pinMessageSchema = z.object({
  action: z.enum(["PIN", "UNPIN"]),
  messageId: z.string().cuid(),
});

const createGroupThreadSchema = z.object({
  action: z.literal("CREATE_GROUP"),
  recipientIds: z.array(z.string().cuid()).min(2),
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const MESSAGE_NOTIFICATION_PREVIEW_LIMIT = 240;
const DEFAULT_THREAD_MESSAGE_LIMIT = 80;
const MAX_THREAD_MESSAGE_LIMIT = 200;

type MessageNotificationBodyPayload = {
  text: string;
  threadId: string;
  messageId: string;
  targetPath: string;
};

function buildMessageNotificationPreview(body: string) {
  const compact = body.trim().replace(/\s+/g, " ");
  if (compact.length <= MESSAGE_NOTIFICATION_PREVIEW_LIMIT) {
    return compact;
  }
  return `${compact.slice(0, MESSAGE_NOTIFICATION_PREVIEW_LIMIT - 3)}...`;
}

function buildMessageNotificationBody(payload: MessageNotificationBodyPayload) {
  return JSON.stringify(payload);
}

function parseMessagePageLimit(raw: string | null) {
  if (!raw) {
    return DEFAULT_THREAD_MESSAGE_LIMIT;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_THREAD_MESSAGE_LIMIT;
  }
  return Math.min(Math.floor(parsed), MAX_THREAD_MESSAGE_LIMIT);
}

function parseDateQueryValue(raw: string | null) {
  if (!raw) {
    return { valid: true as const, value: null as Date | null };
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false as const, value: null as Date | null };
  }
  return { valid: true as const, value: parsed };
}

function directThreadLookup(senderId: string, recipientId: string): Prisma.MessageThreadWhereInput {
  return {
    type: ThreadType.DIRECT,
    participants: {
      some: { userId: senderId },
    },
    AND: [
      { participants: { some: { userId: recipientId } } },
      { participants: { none: { userId: { notIn: [senderId, recipientId] } } } },
    ],
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId");

  if (threadId) {
    const limit = parseMessagePageLimit(url.searchParams.get("limit"));
    const beforeCursor = parseDateQueryValue(url.searchParams.get("before"));
    const afterCursor = parseDateQueryValue(url.searchParams.get("after"));

    if (!beforeCursor.valid || !afterCursor.valid) {
      return fail("Invalid message cursor.", 400);
    }
    if (beforeCursor.value && afterCursor.value) {
      return fail("Use only one cursor direction at a time.", 400);
    }

    const membership = await prisma.threadParticipant.findUnique({
      where: {
        threadId_userId: {
          threadId,
          userId: session.user.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return fail("Thread not found.", 404);
    }

    const createdAtFilter: Prisma.DateTimeFilter | undefined = beforeCursor.value
      ? { lt: beforeCursor.value }
      : afterCursor.value
        ? { gt: afterCursor.value }
        : undefined;

    const newestFirst = !afterCursor.value;
    const queriedMessages = await prisma.message.findMany({
      where: {
        threadId,
        deletedAt: null,
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      orderBy: {
        createdAt: newestFirst ? "desc" : "asc",
      },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
        receipts: {
          select: { userId: true, readAt: true },
        },
        pinnedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    const messages = newestFirst ? [...queriedMessages].reverse() : queriedMessages;

    const unreadMessageIds = messages
      .filter((message) => message.senderId !== session.user.id)
      .filter((message) => !message.receipts.some((receipt) => receipt.userId === session.user.id))
      .map((message) => message.id);

    if (unreadMessageIds.length > 0) {
      await prisma.messageReadReceipt.createMany({
        data: unreadMessageIds.map((messageId) => ({
          messageId,
          userId: session.user.id,
        })),
        skipDuplicates: true,
      });

      await prisma.threadParticipant.update({
        where: {
          threadId_userId: {
            threadId,
            userId: session.user.id,
          },
        },
        data: { lastReadAt: new Date() },
      });
    }

    const oldestMessageAt = messages[0]?.createdAt ?? null;
    const newestMessageAt = messages[messages.length - 1]?.createdAt ?? null;

    return ok({
      messages,
      meta: {
        limit,
        hasMoreOlder: newestFirst && queriedMessages.length === limit,
        oldestMessageAt,
        newestMessageAt,
      },
    });
  }

  const threads = await prisma.messageThread.findMany({
    where: {
      participants: { some: { userId: session.user.id, leftAt: null } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        where: { leftAt: null },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          senderId: true,
          body: true,
          createdAt: true,
          receipts: {
            where: { userId: session.user.id },
            select: { id: true },
          },
        },
      },
    },
  });

  const enriched = threads.map((thread) => {
    const lastMessage = thread.messages[0];
    return {
      id: thread.id,
      type: thread.type,
      title: thread.title,
      description: thread.description,
      participants: thread.participants.map((participant) => participant.user),
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            senderId: lastMessage.senderId,
            body: lastMessage.body,
            createdAt: lastMessage.createdAt,
            isRead: lastMessage.senderId === session.user.id || lastMessage.receipts.length > 0,
          }
        : null,
    };
  });

  return ok({ threads: enriched });
}

// ── POST (send message) ───────────────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  if (!checkRateLimit(session.user.id)) {
    return fail("Too many messages. Slow down.", 429);
  }

  try {
    const body = await request.json();
    const createGroupParsed = createGroupThreadSchema.safeParse(body);

    if (createGroupParsed.success) {
      if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ADMIN) {
        return fail("Only admins can create group messages.", 403);
      }

      const senderId = session.user.id;
      const recipientIds = [...new Set(createGroupParsed.data.recipientIds.filter((id) => id !== senderId))];
      if (recipientIds.length < 2) {
        return fail("Select at least two members besides yourself.", 400);
      }
      if (recipientIds.length + 1 > MAX_GROUP_SIZE) {
        return fail(`Group cannot exceed ${MAX_GROUP_SIZE} members.`, 400);
      }

      const foundUsers = await prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true },
      });
      if (foundUsers.length !== recipientIds.length) {
        return fail("One or more selected users do not exist.", 400);
      }

      const title = createGroupParsed.data.title?.trim() || null;
      const description = createGroupParsed.data.description?.trim() || null;

      const createdThread = await prisma.messageThread.create({
        data: {
          type: ThreadType.GROUP,
          title,
          description,
          createdById: senderId,
          participants: {
            createMany: {
              data: [senderId, ...recipientIds].map((userId) => ({ userId })),
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      await trackEvent({
        userId: senderId,
        organizationId: session.user.organizationId,
        eventType: "message",
        eventName: "group_thread_created",
        payload: {
          threadId: createdThread.id,
          participantCount: createdThread.participants.length,
        },
      });

      return ok(
        {
          threadId: createdThread.id,
          thread: {
            id: createdThread.id,
            type: createdThread.type,
            title: createdThread.title,
            description: createdThread.description,
            participants: createdThread.participants.map((participant) => participant.user),
            lastMessage: null,
          },
        },
        201,
      );
    }

    const parsed = messageSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid message payload.", 400, parsed.error.flatten());
    }

    const senderId = session.user.id;
    const normalizedRecipientIds = parsed.data.recipientIds
      ? [...new Set(parsed.data.recipientIds.filter((id) => id !== senderId))]
      : [];
    const directRecipientId =
      parsed.data.recipientId ?? (normalizedRecipientIds.length === 1 ? normalizedRecipientIds[0] : undefined);
    const groupRecipientIds = normalizedRecipientIds.length > 1 ? normalizedRecipientIds : [];

    let threadId = parsed.data.threadId;
    let threadRecipients: string[] = [];
    let resolvedThreadType: ThreadType | null = null;
    let resolvedThreadTitle: string | null = null;

    if (threadId) {
      const thread = await prisma.messageThread.findUnique({
        where: { id: threadId },
        select: {
          id: true,
          type: true,
          title: true,
          participants: {
            where: { leftAt: null },
            select: { userId: true },
          },
        },
      });

      if (!thread) {
        return fail("Thread not found.", 404);
      }

      resolvedThreadType = thread.type;
      resolvedThreadTitle = thread.title;

      let memberIds = thread.participants.map((participant) => participant.userId);
      if (!memberIds.includes(senderId)) {
        return fail("You are not part of this thread.", 403);
      }

      if (normalizedRecipientIds.length > 0) {
        if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ADMIN) {
          return fail("Only admins can add members to a group.", 403);
        }
        if (thread.type !== ThreadType.GROUP) {
          return fail("You can only add members to group threads.", 400);
        }

        const addableRecipientIds = normalizedRecipientIds.filter((id) => !memberIds.includes(id));
        if (addableRecipientIds.length > 0) {
          if (memberIds.length + addableRecipientIds.length > MAX_GROUP_SIZE) {
            return fail(`Group cannot exceed ${MAX_GROUP_SIZE} members.`, 400);
          }

          const foundUsers = await prisma.user.findMany({
            where: { id: { in: addableRecipientIds } },
            select: { id: true },
          });
          if (foundUsers.length !== addableRecipientIds.length) {
            return fail("One or more selected users do not exist.", 400);
          }

          await prisma.threadParticipant.createMany({
            data: addableRecipientIds.map((userId) => ({
              threadId: thread.id,
              userId,
            })),
            skipDuplicates: true,
          });

          memberIds = [...memberIds, ...addableRecipientIds];
        }
      }

      threadRecipients = memberIds.filter((id) => id !== senderId);
    } else if (groupRecipientIds.length > 0) {
      if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ADMIN) {
        return fail("Only admins can create group messages.", 403);
      }
      if (groupRecipientIds.length + 1 > MAX_GROUP_SIZE) {
        return fail(`Group cannot exceed ${MAX_GROUP_SIZE} members.`, 400);
      }

      const foundUsers = await prisma.user.findMany({
        where: { id: { in: groupRecipientIds } },
        select: { id: true },
      });
      if (foundUsers.length !== groupRecipientIds.length) {
        return fail("One or more selected users do not exist.", 400);
      }

      const createdThread = await prisma.messageThread.create({
        data: {
          type: ThreadType.GROUP,
          title: parsed.data.title ?? null,
          description: parsed.data.description ?? null,
          createdById: senderId,
          participants: {
            createMany: {
              data: [senderId, ...groupRecipientIds].map((userId) => ({ userId })),
            },
          },
        },
        select: { id: true },
      });
      threadId = createdThread.id;
      threadRecipients = groupRecipientIds;
      resolvedThreadType = ThreadType.GROUP;
      resolvedThreadTitle = parsed.data.title?.trim() || null;
    } else if (directRecipientId) {
      const allowed = await canMessageUser(senderId, directRecipientId);
      if (!allowed) {
        return fail("You are not allowed to message this user.", 403);
      }

      let thread = await prisma.messageThread.findFirst({
        where: directThreadLookup(senderId, directRecipientId),
        select: { id: true },
      });

      if (!thread) {
        thread = await prisma.messageThread.create({
          data: {
            type: ThreadType.DIRECT,
            createdById: senderId,
            participants: {
              createMany: {
                data: [{ userId: senderId }, { userId: directRecipientId }],
              },
            },
          },
          select: { id: true },
        });
      }
      threadId = thread.id;
      threadRecipients = [directRecipientId];
      resolvedThreadType = ThreadType.DIRECT;
      resolvedThreadTitle = null;
    } else {
      return fail("Choose at least one recipient.", 400);
    }

    if (!threadId) {
      return fail("Could not resolve target thread.", 500);
    }

    const resolvedThreadId = threadId;

    const message = await prisma.message.create({
      data: {
        threadId: resolvedThreadId,
        senderId,
        body: parsed.data.body,
        receipts: {
          create: { userId: senderId },
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            profile: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    await prisma.messageThread.update({
      where: { id: resolvedThreadId },
      data: { updatedAt: new Date() },
    });

    if (threadRecipients.length > 0) {
      const senderFullName = `${message.sender.firstName} ${message.sender.lastName}`.trim();
      const messagePreview = buildMessageNotificationPreview(parsed.data.body);
      const isGroupThread = resolvedThreadType === ThreadType.GROUP;
      const groupNameSuffix = resolvedThreadTitle ? ` in ${resolvedThreadTitle}` : "";
      const title = isGroupThread
        ? `New group message${groupNameSuffix}`
        : `New message from ${senderFullName}`;
      const messageText = isGroupThread ? `${senderFullName}: ${messagePreview}` : messagePreview;
      const body = buildMessageNotificationBody({
        text: messageText,
        threadId: resolvedThreadId,
        messageId: message.id,
        targetPath: `/dashboard/messages?threadId=${resolvedThreadId}`,
      });

      await prisma.notification.createMany({
        data: threadRecipients.map((recipientId) => ({
          recipientId,
          creatorId: senderId,
          type: NotificationType.INFO,
          title,
          body,
        })),
      });
    }

    await trackEvent({
      userId: senderId,
      organizationId: session.user.organizationId,
      eventType: "message",
      eventName: "message_sent",
      payload: {
        threadId: resolvedThreadId,
        recipientIds: threadRecipients,
        mode: threadRecipients.length > 1 ? "group" : "direct",
      },
    });

    publishMessageEvent(
      [senderId, ...threadRecipients],
      {
        type: "message_created",
        threadId: resolvedThreadId,
        messageId: message.id,
        senderId,
        recipientId: threadRecipients[0] ?? senderId,
        recipientIds: threadRecipients,
        createdAt: message.createdAt.toISOString(),
      },
    );

    return ok({ threadId: resolvedThreadId, message }, 201);
  } catch (error) {
    console.error("[POST /api/messages] Error:", error);
    return fail("Could not send message.", 500, error instanceof Error ? error.message : error);
  }
}

// ── PUT (edit message body) ───────────────────────────────────────────────────
export async function PUT(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const parsed = messageEditSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid edit payload.", 400, parsed.error.flatten());
    }

    const message = await prisma.message.findUnique({
      where: { id: parsed.data.messageId },
      select: { id: true, threadId: true, senderId: true, deletedAt: true },
    });

    if (!message) {
      return fail("Message not found.", 404);
    }
    if (message.senderId !== session.user.id) {
      return fail("You can only edit your own messages.", 403);
    }
    if (message.deletedAt) {
      return fail("Cannot edit a deleted message.", 400);
    }

    const now = new Date();
    await prisma.message.update({
      where: { id: message.id },
      data: { body: parsed.data.body, editedAt: now },
    });

    // Fetch active thread members for realtime broadcast
    const participants = await prisma.threadParticipant.findMany({
      where: { threadId: message.threadId, leftAt: null },
      select: { userId: true },
    });
    const memberIds = participants.map((p) => p.userId);

    publishMessageEvent(memberIds, {
      type: "message_updated",
      threadId: message.threadId,
      messageId: message.id,
      body: parsed.data.body,
      editedAt: now.toISOString(),
    });

    return ok({ messageId: message.id, editedAt: now });
  } catch (error) {
    return fail("Could not edit message.", 500, error instanceof Error ? error.message : error);
  }
}

// ── DELETE (soft delete message) ─────────────────────────────────────────────
export async function DELETE(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    const url = new URL(request.url);
    const rawBody = url.searchParams.get("messageId")
      ? { messageId: url.searchParams.get("messageId") }
      : await request.json().catch(() => ({}));

    const parsed = messageDeleteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail("Invalid delete payload.", 400, parsed.error.flatten());
    }

    const message = await prisma.message.findUnique({
      where: { id: parsed.data.messageId },
      select: { id: true, threadId: true, senderId: true, deletedAt: true },
    });

    if (!message) {
      return fail("Message not found.", 404);
    }

    const isAdmin =
      session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;

    if (message.senderId !== session.user.id && !isAdmin) {
      return fail("You can only delete your own messages.", 403);
    }
    if (message.deletedAt) {
      return fail("Message already deleted.", 400);
    }

    const now = new Date();
    await prisma.message.update({
      where: { id: message.id },
      data: { deletedAt: now },
    });

    // Broadcast to all thread members
    const participants = await prisma.threadParticipant.findMany({
      where: { threadId: message.threadId, leftAt: null },
      select: { userId: true },
    });
    const memberIds = participants.map((p) => p.userId);

    publishMessageEvent(memberIds, {
      type: "message_deleted",
      threadId: message.threadId,
      messageId: message.id,
      deletedAt: now.toISOString(),
    });

    return ok({ messageId: message.id, deletedAt: now });
  } catch (error) {
    return fail("Could not delete message.", 500, error instanceof Error ? error.message : error);
  }
}

// ── PATCH (pin/unpin message OR manage group thread) ─────────────────────────
export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ADMIN) {
    return fail("Only admins can manage group threads.", 403);
  }

  try {
    const body = await request.json();

    // ── Pin / Unpin ───────────────────────────────────────────────────────────
    const pinParsed = pinMessageSchema.safeParse(body);
    if (pinParsed.success) {
      if (session.user.role !== UserRole.SUPER_ADMIN) {
        return fail("Only super admins can pin messages.", 403);
      }

      const message = await prisma.message.findUnique({
        where: { id: pinParsed.data.messageId },
        select: { id: true, threadId: true, deletedAt: true, thread: { select: { type: true } } },
      });

      if (!message) return fail("Message not found.", 404);
      if (message.deletedAt) return fail("Cannot pin a deleted message.", 400);
      if (message.thread.type !== ThreadType.GROUP) return fail("Pinning is only available in group threads.", 400);

      const membership = await prisma.threadParticipant.findUnique({
        where: { threadId_userId: { threadId: message.threadId, userId: session.user.id } },
        select: { id: true },
      });
      if (!membership) return fail("You are not part of this thread.", 403);

      const isPinning = pinParsed.data.action === "PIN";
      const now = new Date();

      // Unpin any currently pinned message in this thread first
      await prisma.message.updateMany({
        where: { threadId: message.threadId, pinnedAt: { not: null } },
        data: { pinnedAt: null, pinnedById: null },
      });

      if (isPinning) {
        await prisma.message.update({
          where: { id: message.id },
          data: { pinnedAt: now, pinnedById: session.user.id },
        });
      }

      const participants = await prisma.threadParticipant.findMany({
        where: { threadId: message.threadId, leftAt: null },
        select: { userId: true },
      });

      publishMessageEvent(
        participants.map((p) => p.userId),
        isPinning
          ? { type: "message_pinned", threadId: message.threadId, messageId: message.id, pinnedAt: now.toISOString(), pinnedById: session.user.id }
          : { type: "message_unpinned", threadId: message.threadId, messageId: message.id, pinnedAt: null, pinnedById: null },
      );

      return ok({ messageId: message.id, pinned: isPinning });
    }

    const parsed = groupThreadManageSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid group thread payload.", 400, parsed.error.flatten());
    }

    const thread = await prisma.messageThread.findUnique({
      where: { id: parsed.data.threadId },
      select: {
        id: true,
        type: true,
        participants: {
          where: { leftAt: null },
          select: { userId: true },
        },
      },
    });

    if (!thread) {
      return fail("Thread not found.", 404);
    }
    if (thread.type !== ThreadType.GROUP) {
      return fail("Only group threads can be managed here.", 400);
    }

    let memberIds = thread.participants.map((participant) => participant.userId);
    if (!memberIds.includes(session.user.id)) {
      return fail("You are not part of this thread.", 403);
    }

    const updateData: Prisma.MessageThreadUpdateInput = {};
    if (parsed.data.title !== undefined) {
      const nextTitle = parsed.data.title?.trim() ?? "";
      updateData.title = nextTitle.length > 0 ? nextTitle : null;
    }
    if (parsed.data.description !== undefined) {
      const nextDescription = parsed.data.description?.trim() ?? "";
      updateData.description = nextDescription.length > 0 ? nextDescription : null;
    }

    let addedUserIds: string[] = [];
    let removedUserId: string | null = null;

    await prisma.$transaction(async (tx) => {
      if (parsed.data.addUserIds && parsed.data.addUserIds.length > 0) {
        const normalizedAddUserIds = [...new Set(parsed.data.addUserIds.filter((id) => id !== session.user.id))];
        if (normalizedAddUserIds.length === 0) {
          throw new Error("Select at least one valid user to add.");
        }

        const addableUserIds = normalizedAddUserIds.filter((id) => !memberIds.includes(id));
        if (addableUserIds.length === 0) {
          throw new Error("Selected user is already a member of this group.");
        }
        if (memberIds.length + addableUserIds.length > MAX_GROUP_SIZE) {
          throw new Error(`Group cannot exceed ${MAX_GROUP_SIZE} members.`);
        }

        const foundUsers = await tx.user.findMany({
          where: { id: { in: addableUserIds } },
          select: { id: true },
        });
        if (foundUsers.length !== addableUserIds.length) {
          throw new Error("One or more selected users do not exist.");
        }

        await tx.threadParticipant.createMany({
          data: addableUserIds.map((userId) => ({
            threadId: thread.id,
            userId,
          })),
          skipDuplicates: true,
        });

        memberIds = [...memberIds, ...addableUserIds];
        addedUserIds = addableUserIds;
      }

      if (parsed.data.removeUserId) {
        if (parsed.data.removeUserId === session.user.id) {
          throw new Error("You cannot remove yourself from this group.");
        }

        if (!memberIds.includes(parsed.data.removeUserId)) {
          throw new Error("Selected user is not a member of this group.");
        }

        const remainingMembers = memberIds.filter((userId) => userId !== parsed.data.removeUserId);
        if (remainingMembers.length < 2) {
          throw new Error("A group must have at least two members.");
        }

        await tx.threadParticipant.delete({
          where: {
            threadId_userId: {
              threadId: thread.id,
              userId: parsed.data.removeUserId,
            },
          },
        });
        memberIds = remainingMembers;
        removedUserId = parsed.data.removeUserId;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.messageThread.update({
          where: { id: thread.id },
          data: updateData,
        });
      }
    });

    const updated = await prisma.messageThread.findUnique({
      where: { id: thread.id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!updated) {
      return fail("Thread not found after update.", 404);
    }

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "message",
      eventName: "group_thread_updated",
      payload: {
        threadId: thread.id,
        editedTitle: parsed.data.title !== undefined,
        editedDescription: parsed.data.description !== undefined,
        addedUserIds,
        removedUserId,
      },
    });

    return ok({
      thread: {
        id: updated.id,
        type: updated.type,
        title: updated.title,
        description: updated.description,
        participants: updated.participants.map((participant) => participant.user),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return fail(error.message, 400);
    }
    return fail("Could not manage group thread.", 500, error);
  }
}
