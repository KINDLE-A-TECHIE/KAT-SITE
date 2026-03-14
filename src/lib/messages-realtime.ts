import "server-only";
import { randomUUID } from "crypto";
import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient, type RedisClientType } from "redis";

export type MessageCreatedEvent = {
  type: "message_created";
  threadId: string;
  messageId: string;
  senderId: string;
  recipientId: string;
  recipientIds?: string[];
  createdAt: string;
};

export type MessageDeletedEvent = {
  type: "message_deleted";
  threadId: string;
  messageId: string;
  deletedAt: string;
};

export type MessageUpdatedEvent = {
  type: "message_updated";
  threadId: string;
  messageId: string;
  body: string;
  editedAt: string;
};

export type MessagePinnedEvent = {
  type: "message_pinned";
  threadId: string;
  messageId: string;
  pinnedAt: string;
  pinnedById: string;
};

export type MessageUnpinnedEvent = {
  type: "message_unpinned";
  threadId: string;
  messageId: string;
  pinnedAt: null;
  pinnedById: null;
};

export type TypingEvent = {
  type: "typing_start" | "typing_stop";
  threadId: string;
  userId: string;
};

export type MessageRealtimeEvent =
  | MessageCreatedEvent
  | MessageDeletedEvent
  | MessageUpdatedEvent
  | MessagePinnedEvent
  | MessageUnpinnedEvent
  | TypingEvent;

type MessageRealtimeListener = (event: MessageRealtimeEvent) => void;
type RedisMessageEnvelope = {
  version: 1;
  origin: string;
  userIds: string[];
  event: MessageRealtimeEvent;
  publishedAt: string;
};

type MessageRealtimeStore = {
  listenersByUserId: Map<string, Set<MessageRealtimeListener>>;
  instanceId: string;
  // Publisher: Upstash REST client (stateless HTTP)
  upstashPublisher: UpstashRedis | null;
  // Subscriber: standard TCP/TLS connection (needs persistent socket for pub/sub)
  redisSubscriber: RedisClientType | null;
  redisInitPromise: Promise<void> | null;
};

declare global {
  var __katMessageRealtimeStore: MessageRealtimeStore | undefined;
}

const UPSTASH_REST_URL   = process.env.UPSTASH_REDIS_REST_URL?.trim();
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const REDIS_MESSAGES_CHANNEL = process.env.REDIS_MESSAGES_CHANNEL?.trim() || "kat:messages:events";

/**
 * Build a standard Redis TLS URL from Upstash credentials for the subscriber connection.
 * Upstash REST URL:  https://xxxx.upstash.io
 * TCP URL:           rediss://default:TOKEN@xxxx.upstash.io:6379
 */
function buildUpstashTcpUrl(): string | null {
  if (!UPSTASH_REST_URL || !UPSTASH_REST_TOKEN) return null;
  try {
    const host = new URL(UPSTASH_REST_URL).hostname;
    return `rediss://default:${UPSTASH_REST_TOKEN}@${host}:6379`;
  } catch {
    return null;
  }
}

const hasUpstash = Boolean(UPSTASH_REST_URL && UPSTASH_REST_TOKEN);

function createStore(): MessageRealtimeStore {
  return {
    listenersByUserId: new Map(),
    instanceId: randomUUID(),
    upstashPublisher: null,
    redisSubscriber: null,
    redisInitPromise: null,
  };
}

function getStore(): MessageRealtimeStore {
  if (!globalThis.__katMessageRealtimeStore) {
    globalThis.__katMessageRealtimeStore = createStore();
  }
  return globalThis.__katMessageRealtimeStore;
}

function dispatchToLocalListeners(userIds: string[], event: MessageRealtimeEvent) {
  const store = getStore();
  for (const userId of [...new Set(userIds)]) {
    const listeners = store.listenersByUserId.get(userId);
    if (!listeners || listeners.size === 0) continue;
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[messages-realtime] Listener callback failed:", error);
      }
    }
  }
}

function isValidMessageRealtimeEvent(event: unknown): event is MessageRealtimeEvent {
  if (!event || typeof event !== "object") return false;
  const c = event as Record<string, unknown>;
  const type = c.type;

  if (type === "message_created") {
    return (
      typeof c.threadId === "string" &&
      typeof c.messageId === "string" &&
      typeof c.senderId === "string" &&
      typeof c.recipientId === "string" &&
      typeof c.createdAt === "string"
    );
  }
  if (type === "message_deleted") {
    return (
      typeof c.threadId === "string" &&
      typeof c.messageId === "string" &&
      typeof c.deletedAt === "string"
    );
  }
  if (type === "message_updated") {
    return (
      typeof c.threadId === "string" &&
      typeof c.messageId === "string" &&
      typeof c.body === "string" &&
      typeof c.editedAt === "string"
    );
  }
  if (type === "message_pinned") {
    return (
      typeof c.threadId === "string" &&
      typeof c.messageId === "string" &&
      typeof c.pinnedAt === "string" &&
      typeof c.pinnedById === "string"
    );
  }
  if (type === "message_unpinned") {
    return typeof c.threadId === "string" && typeof c.messageId === "string";
  }
  if (type === "typing_start" || type === "typing_stop") {
    return typeof c.threadId === "string" && typeof c.userId === "string";
  }
  return false;
}

function parseEnvelope(raw: string): RedisMessageEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as Partial<RedisMessageEnvelope>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== 1 || typeof parsed.origin !== "string") return null;
    if (!Array.isArray(parsed.userIds) || !parsed.userIds.every((id) => typeof id === "string")) return null;
    if (!isValidMessageRealtimeEvent(parsed.event)) return null;
    if (typeof parsed.publishedAt !== "string") return null;
    return {
      version: 1,
      origin: parsed.origin,
      userIds: parsed.userIds,
      event: parsed.event,
      publishedAt: parsed.publishedAt,
    };
  } catch {
    return null;
  }
}

async function ensureRedisRealtime() {
  if (!hasUpstash) return;

  const store = getStore();
  if (store.redisSubscriber) return;
  if (store.redisInitPromise) {
    await store.redisInitPromise;
    return;
  }

  // Publisher: Upstash REST client — created once, stateless HTTP calls
  if (!store.upstashPublisher) {
    store.upstashPublisher = new UpstashRedis({
      url: UPSTASH_REST_URL!,
      token: UPSTASH_REST_TOKEN!,
    });
  }

  // Subscriber: standard TCP/TLS connection (pub/sub requires a persistent socket)
  const tcpUrl = buildUpstashTcpUrl();
  if (!tcpUrl) return;

  let subscriber: RedisClientType | null = null;

  store.redisInitPromise = (async () => {
    subscriber = createClient({
      url: tcpUrl,
      socket: { reconnectStrategy: false }, // don't retry — fail fast and fall back to in-memory
    }) as RedisClientType;

    subscriber.on("error", () => { /* suppress per-attempt noise; setup failure is logged below */ });

    await subscriber.connect();

    await subscriber.subscribe(REDIS_MESSAGES_CHANNEL, (rawPayload) => {
      const envelope = parseEnvelope(rawPayload);
      if (!envelope) return;
      if (envelope.origin === store.instanceId) return; // own publish, skip
      dispatchToLocalListeners(envelope.userIds, envelope.event);
    });

    store.redisSubscriber = subscriber;
  })()
    .catch(async (error) => {
      console.error("[messages-realtime] Upstash subscriber setup failed. Falling back to in-memory.", error);
      if (subscriber) {
        try { await subscriber.quit(); } catch { /* ignore */ }
      }
      store.redisSubscriber = null;
    })
    .finally(() => {
      store.redisInitPromise = null;
    });

  await store.redisInitPromise;
}

export function subscribeToMessageEvents(userId: string, listener: MessageRealtimeListener) {
  const store = getStore();
  const existing = store.listenersByUserId.get(userId) ?? new Set<MessageRealtimeListener>();
  existing.add(listener);
  store.listenersByUserId.set(userId, existing);
  void ensureRedisRealtime();

  return () => {
    const listeners = store.listenersByUserId.get(userId);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) store.listenersByUserId.delete(userId);
  };
}

export function publishMessageEvent(userIds: string[], event: MessageRealtimeEvent) {
  // Always dispatch to in-process listeners first (same server instance)
  dispatchToLocalListeners(userIds, event);

  if (!hasUpstash) return;

  void (async () => {
    await ensureRedisRealtime();

    const store = getStore();
    if (!store.upstashPublisher) return;

    const envelope: RedisMessageEnvelope = {
      version: 1,
      origin: store.instanceId,
      userIds: [...new Set(userIds)],
      event,
      publishedAt: new Date().toISOString(),
    };

    try {
      await store.upstashPublisher.publish(REDIS_MESSAGES_CHANNEL, JSON.stringify(envelope));
    } catch (error) {
      console.error("[messages-realtime] Upstash publish failed:", error);
    }
  })();
}