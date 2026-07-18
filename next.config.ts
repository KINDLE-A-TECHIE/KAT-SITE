import type { NextConfig } from "next";
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

  experimental: {
    // Rewrite barrel imports (import { X } from "lucide-react") to per-module imports so the
    // dev compiler only builds the icons actually used, not the entire 1k-icon barrel. Same
    // for framer-motion. Meaningfully faster cold compiles and HMR.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },

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

export default nextConfig;
