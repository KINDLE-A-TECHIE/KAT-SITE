/**
 * MUST live in src/. Next.js looks for instrumentation.ts INSIDE the src directory
 * when the project has one. At the repo root it is silently ignored: register()
 * never runs, so validateRequiredEnv() never fires and the Sentry server/edge
 * configs are never imported. Do not move it back to the root.
 *
 * Sentry (and the OpenTelemetry / Prisma instrumentation tree it drags in) is skipped in
 * local development. Loading the whole @sentry/nextjs + OTel graph adds ~8s to every dev
 * start ("Compiling instrumentation") and emits the OTel "Critical dependency" warning,
 * and you do not need remote error tracking while developing (errors surface in the
 * terminal and browser). It stays fully ON in production/CI (needs a DSN). To exercise
 * Sentry locally, set SENTRY_DEV=true.
 */

const SENTRY_ENABLED =
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) &&
  (process.env.NODE_ENV !== "development" || process.env.SENTRY_DEV === "true");

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Env validation runs regardless of Sentry; it is cheap and must not be skipped.
    const { validateRequiredEnv } = await import("./lib/env");
    validateRequiredEnv();

    if (SENTRY_ENABLED) {
      await import("../sentry.server.config");
    }
  }

  if (process.env.NEXT_RUNTIME === "edge" && SENTRY_ENABLED) {
    await import("../sentry.edge.config");
  }
}

/**
 * Next.js calls this for UNCAUGHT server-side errors, including ones thrown inside
 * nested React Server Components. Route handlers report their own failures via
 * captureError() in their catch blocks; this covers everything that never reaches a
 * catch block, exactly the class of error worth being paged about.
 *
 * Sentry is imported lazily here (only when a DSN exists) so the static import does not
 * pull @sentry/nextjs into the dev instrumentation compile. Errors are rare, so the
 * dynamic import on the error path costs nothing in the common case.
 */
export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  if (!SENTRY_ENABLED) return;
  const Sentry = await import("@sentry/nextjs");
  return Sentry.captureRequestError(...args);
}
