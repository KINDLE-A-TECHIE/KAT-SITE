import { PrismaClient } from "@prisma/client";

// Connection-reset messages that appear before our retry logic kicks in.
// These are expected with Neon's idle-suspension and are not real errors.
const CONN_NOISE = ["kind: Closed", "kind: Io", "ConnectionReset", "Can't reach database server"];

function makePrismaClient() {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "error" },
      { emit: "stdout", level: "warn" },
    ],
  });

  // Only forward errors that aren't connection-reset noise
  client.$on("error", (e) => {
    if (!CONN_NOISE.some((s) => e.message.includes(s))) {
      console.error("prisma:error", e.message);
    }
  });

  return client.$extends({
    query: {
      async $allOperations({ operation: _operation, model: _model, args, query }) {
        // Retry up to 3 times on connection errors (handles Neon cold-start timeouts).
        // Delays: 1 s → 2 s → 4 s (total max ~7 s), covering Neon's typical wake-up window.
        const delays = [1000, 2000, 4000];
        let lastError: unknown;
        for (let attempt = 0; attempt <= delays.length; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;
            const msg = error instanceof Error ? error.message : String(error);
            const raw = String(error);
            const code = (error as { code?: string })?.code;
            const isConnError =
              msg.includes("Can't reach database server") ||
              msg.includes("Connection refused") ||
              msg.includes("ECONNREFUSED") ||
              msg.includes("connect_timeout") ||
              msg.includes("ConnectionReset") ||
              msg.includes("Timed out fetching a new connection") ||
              msg.includes("kind: Closed") ||
              raw.includes("kind: Closed") ||
              raw.includes("kind: Io") ||
              raw.includes("ConnectionReset") ||
              code === "P1001" ||
              code === "P1002" ||
              code === "P2024"; // connection pool exhausted — wait for in-flight queries to finish
            if (!isConnError || attempt === delays.length) break;
            await new Promise((r) => setTimeout(r, delays[attempt]));
          }
        }
        throw lastError;
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof makePrismaClient>;

const globalForExtended = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForExtended.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForExtended.prisma = prisma;
}
