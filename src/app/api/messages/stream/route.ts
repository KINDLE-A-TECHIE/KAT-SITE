import { fail } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { subscribeToMessageEvents, type MessageRealtimeEvent } from "@/lib/messages-realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auto-close SSE connection after 10 minutes; clients reconnect automatically.
const MAX_SSE_AGE_MS = 10 * 60 * 1000;

type StreamEvent = MessageRealtimeEvent | { type: "connected"; at: string };

function serializeSseEvent(event: StreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(serializeSseEvent(event)));
        } catch {
          // Controller may be closed; ignore write errors.
        }
      };

      write({ type: "connected", at: new Date().toISOString() });

      const unsubscribe = subscribeToMessageEvents(session.user.id, (event) => {
        write(event);
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));
        } catch {
          // Ignore — stream may have been closed.
        }
      }, 25000);

      // Auto-close after MAX_SSE_AGE_MS; the client will reconnect.
      const maxAgeTimeout = setTimeout(() => {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
        cleanup();
      }, MAX_SSE_AGE_MS);

      cleanup = () => {
        clearInterval(heartbeat);
        clearTimeout(maxAgeTimeout);
        unsubscribe();
      };

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
