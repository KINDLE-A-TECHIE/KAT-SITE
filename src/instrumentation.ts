import * as Sentry from "@sentry/nextjs";

/**
 * MUST live in src/. Next.js looks for instrumentation.ts INSIDE the src directory
 * when the project has one. At the repo root it is silently ignored: register()
 * never runs, so validateRequiredEnv() never fires and the Sentry server/edge
 * configs are never imported. Do not move it back to the root.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    const { validateRequiredEnv } = await import("./lib/env");
    validateRequiredEnv();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Next.js calls this for UNCAUGHT server-side errors, including ones thrown inside
 * nested React Server Components. Route handlers report their own failures via
 * captureError() in their catch blocks; this covers everything that never reaches a
 * catch block, exactly the class of error worth being paged about.
 *
 * Without this export, those errors are silently dropped and never reach Sentry.
 */
export const onRequestError = Sentry.captureRequestError;
