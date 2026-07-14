import { defineConfig, devices } from "@playwright/test";

/**
 * Run the dev server before tests:
 *   npm run dev        (reused automatically in local dev)
 *   npm run test:e2e   (CI starts it automatically via webServer)
 *
 * Requires a real database, point DATABASE_URL at a seeded test DB or the
 * local dev DB. All other required env vars must be set (see .env.example).
 *
 * First-time setup: npx playwright install chromium
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // In local dev the server is already running; in CI always start fresh.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
