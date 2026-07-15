import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 100% of traces in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
