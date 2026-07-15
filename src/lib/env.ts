/**
 * Environment variables the app cannot function without in any deployment.
 * Validated eagerly at startup (see instrumentation) so misconfiguration fails
 * fast and loudly instead of surfacing as a runtime 500 on first use.
 */
const REQUIRED_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  // OAuth/callback base URL, wrong or missing value breaks sign-in redirects.
  "NEXTAUTH_URL",
  // Cloudflare R2 (file storage), presigned uploads/reads fail without these.
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  // Public base URL used to build object URLs at read time.
  "R2_PUBLIC_URL",
  // Paystack, payments/enrollment billing is core to the product.
  "PAYSTACK_SECRET_KEY",
] as const;

/**
 * Feature-gated vars: required only when the corresponding feature is enabled.
 * Not validated at startup, the owning module guards its own usage:
 *   - PAYSTACK_WEBHOOK_SECRET  → webhook falls back to PAYSTACK_SECRET_KEY
 *   - UPSTASH_REDIS_REST_URL/TOKEN → rate limiting no-ops if unset
 *   - REDIS_URL                → SSE delivered locally (single-instance) if unset
 *   - SMTP_*                   → email logs a warning and skips
 *   - JITSI / JIBRI / JUDGE0 vars → meetings/code-exec features
 *   - GOOGLE_CLIENT_ID/SECRET  → Google OAuth button
 *   - TURNSTILE_*              → bot protection on auth forms
 *   - GEMINI_API_KEY           → "Kemi" chatbot
 *   - CRON_SECRET              → cron endpoints (reject if unset)
 *   - EMBED_TOKEN_SECRET       → school iframe embed; school-embed.ts THROWS if absent or <32
 *                                chars, rather than sign a child's session with a weak key
 *   - SENTRY_*                 → error tracking / source maps
 */

export function validateRequiredEnv(): void {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Check your .env file against .env.example.",
    );
  }
}
