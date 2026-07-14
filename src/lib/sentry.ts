import * as Sentry from "@sentry/nextjs";

export { Sentry };

/**
 * Captures an exception and adds structured context.
 * Safe to call from any catch block, never throws.
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}
