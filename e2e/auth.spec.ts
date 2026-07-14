import { test, expect } from "@playwright/test";

/**
 * Auth flows, page rendering and redirect behaviour.
 *
 * The "invalid credentials" test requires the dev server to be connected to a
 * database (the login route hits Prisma). All other tests only need the app to
 * be running and do not touch the DB.
 */

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders email and password fields with a submit button", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows an error when invalid credentials are submitted", async ({ page }) => {
    await page.locator('input[type="email"]').fill("nobody@example.com");
    await page.locator('input[type="password"]').fill("WrongPassword1!");
    await page.locator('button[type="submit"]').click();

    // Expect an error message to appear (not a successful redirect)
    await expect(page.locator('[role="alert"].text-destructive, [data-error]')).toBeVisible({
      timeout: 8_000,
    });
    await expect(page).not.toHaveURL(/dashboard/);
  });
});

test.describe("Register page", () => {
  test("renders the registration form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

test.describe("Protected route redirects (unauthenticated)", () => {
  const protectedRoutes = [
    "/dashboard",
    "/dashboard/student",
    "/dashboard/admin",
    "/dashboard/instructor",
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
    });
  }
});
