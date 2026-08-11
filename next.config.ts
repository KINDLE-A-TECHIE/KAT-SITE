import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,

  /*
   * Keep server-only, dynamically-required native/instrumentation packages OUT of the
   * bundler graph. They are `require()`d at runtime from node_modules instead of being
   * compiled. This is the documented fix for the OpenTelemetry "Critical dependency: the
   * request of a dependency is an expression" warning (require-in-the-middle uses a dynamic
   * require the bundler cannot statically analyse), and it cuts a large chunk off dev
   * compile time because the whole OTel/Prisma-instrumentation tree no longer compiles.
   */
  serverExternalPackages: [
    "@sentry/nextjs",
    "@sentry/node",
    "@fastify/otel",
    "require-in-the-middle",
    "@opentelemetry/instrumentation",
    "@prisma/instrumentation",
  ],

  // NOTE: experimental.optimizePackageImports (lucide-react, framer-motion) was removed. Its
  // barrel-to-deep-import rewrite is a known cause of "Cannot read properties of undefined
  // (reading 'call')" (a rewritten module resolving to undefined), which broke /login (it imports
  // `motion` from framer-motion) and made the build worker retry. Correctness over the compile-speed
  // win. If reintroduced, keep framer-motion OUT of the list and test /login + a full build first.

  async headers() {
    return [
      {
        /*
         * X-Frame-Options: SAMEORIGIN everywhere EXCEPT /embed.
         *
         * XFO cannot express an allow-list (ALLOW-FROM is dead), so a per-school origin list is
         * impossible with it. The school embed opts out here and is protected instead by
         * Content-Security-Policy: frame-ancestors, set per-school in middleware.ts from
         * SchoolAllowedOrigin (and 'none' when a school has configured no origins, so it fails
         * closed). Every other header below still applies to /embed.
         */
        source: "/((?!embed/).*)",
        headers: [
          { key: "X-Frame-Options",           value: "SAMEORIGIN" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options",     value: "nosniff" },
          { key: "X-XSS-Protection",           value: "1; mode=block" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",         value: "geolocation=(), microphone=(), camera=()" },
          { key: "Strict-Transport-Security",  value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Google OAuth profile pictures
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // User-provided avatar URLs (arbitrary HTTPS). Narrow this once a
      // dedicated CDN or object-store bucket is in use for avatar uploads.
      { protocol: "https", hostname: "**" },
    ],
  },
};

/*
 * Wrap in withSentryConfig ONLY when Sentry is enabled (a DSN is set, and we are not in plain local
 * dev), mirroring src/instrumentation.ts. This is what makes captured errors USEFUL: the Sentry
 * build plugin uploads source maps (given SENTRY_ORG/PROJECT/AUTH_TOKEN in CI), so production stack
 * traces are de-minified. Without it, errors still reach Sentry but point at unreadable bundled code.
 * Gating on enablement keeps the plugin (and the OTel/source-map work it does) out of the dev build,
 * preserving the fast dev start the serverExternalPackages note above is protecting.
 */
const sentryEnabled =
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) &&
  (process.env.NODE_ENV !== "development" || process.env.SENTRY_DEV === "true");

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Quiet during normal builds; the plugin logs upload details only in CI.
      silent: !process.env.CI,
      // Upload a wider set of client bundles so client stack traces resolve too.
      widenClientFileUpload: true,
      // No usage telemetry to Sentry about the build itself.
      telemetry: false,
    })
  : nextConfig;
