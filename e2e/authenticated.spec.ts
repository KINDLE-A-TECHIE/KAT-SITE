import { test, expect } from "@playwright/test";
import { existsSync } from "fs";

/**
 * Authenticated flows, uses Playwright's storageState to inject a valid
 * NextAuth session cookie so tests don't have to go through the login UI.
 *
 * How to generate the auth fixture:
 *   1. Run:  npx playwright codegen http://localhost:3000/login
 *   2. Log in with a seeded account (e.g. student@example.com / Passw0rd!)
 *   3. Save storage state: page.context().storageState({ path: "e2e/fixtures/student.json" })
 *   4. Commit e2e/fixtures/student.json (it contains only session cookies, no passwords)
 *
 * Until the fixture file exists these tests are skipped automatically.
 */

const FIXTURE_PATH = "e2e/fixtures/student.json";

function fixtureExists() {
  return existsSync(FIXTURE_PATH);
}

test.describe("Student dashboard (authenticated)", () => {
  test.skip(!fixtureExists(), "Run setup to generate e2e/fixtures/student.json first");

  test.use({ storageState: FIXTURE_PATH });

  test("renders the student dashboard without redirecting to login", async ({ page }) => {
    await page.goto("/dashboard/student");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/dashboard/);
  });

  test("enrollment list API returns 200", async ({ request }) => {
    const res = await request.get("/api/enrollments");
    expect(res.status()).toBe(200);
    const body = await res.json() as { enrollments: unknown[] };
    expect(Array.isArray(body.enrollments)).toBe(true);
  });
});

/**
 * Session revocation, verifies that revoking a session via the Security tab
 * immediately blocks further requests (requires a running server + DB).
 *
 * This is a manual test guide rather than an automated test because it
 * requires UI interaction across two browser contexts.
 *
 * Steps:
 *   1. Log in as student in browser A
 *   2. In the Security tab, revoke all sessions
 *   3. In browser A, navigate to /dashboard/student
 *   4. Expect redirect to /login
 */
