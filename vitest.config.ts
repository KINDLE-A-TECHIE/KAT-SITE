import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // tsconfig sets jsx:"preserve" (Next.js compiles it). This Vite uses OXC, which would otherwise
  // honour that and leave JSX untransformed, so any .tsx a test imports (e.g. the @react-pdf report
  // renderer) fails vite's import-analysis. Force the automatic JSX runtime for the test transform.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    // E2E files are run by Playwright, not Vitest.
    exclude: ["**/node_modules/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/prisma.ts",
        "src/lib/analytics.ts",
        "src/lib/email.ts",
        "src/lib/payments/**",
        "src/lib/messages-realtime.ts",
        "src/lib/ratelimit.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Prevent "server-only" from throwing outside Next.js
      "server-only": path.resolve(__dirname, "./src/__tests__/__mocks__/server-only.ts"),
    },
  },
});
