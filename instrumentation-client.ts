/**
 * Client-side Sentry init.
 *
 * Formerly sentry.client.config.ts, renamed because that filename is deprecated
 * and stops being picked up under Turbopack.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 10% of sessions as replays in production; 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],

  // Reduce noise: don't send events for network errors the user caused
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Network request failed",
    /^AbortError/,
  ],
});

/**
 * Instruments App Router client-side navigations, so a route transition that fails
 * is attributed to the route it was navigating to rather than being lost.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
