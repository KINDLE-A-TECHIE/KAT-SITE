import { NextResponse } from "next/server";
import { captureError } from "./sentry";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

/**
 * The one way to answer a request that failed because WE broke, not the caller.
 *
 * Does both things a 500 must always do, so no catch block has to remember them:
 *   1. Reports the real error (with stack) to Sentry via captureError. A caught error never reaches
 *      instrumentation.ts `onRequestError`, so if the catch does not report it, it is invisible.
 *   2. Returns a generic 500 with NO `details`. The raw error must never reach the client (it leaks
 *      internals); the reference for debugging lives in Sentry, not the response body.
 *
 * Use this in every `catch` that turns a server fault into a 500. For expected, caller-caused
 * failures (bad JSON, validation), keep using `fail(...)` with a 4xx, those are not Sentry-worthy.
 */
export function serverError(
  error: unknown,
  message = "An unexpected error occurred",
  context?: Record<string, unknown>,
) {
  captureError(error, context);
  return fail(message, 500);
}
