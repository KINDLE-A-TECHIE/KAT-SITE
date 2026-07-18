import { test, expect } from "@playwright/test";

/**
 * Health endpoint, the one unauthenticated API endpoint.
 * Tests that the app is alive and returns the expected shape.
 * No database connection is exercised.
 */
test.describe("GET /api/health", () => {
  test("returns 200 with status ok and an ISO timestamp", async ({ request }) => {
    const res = await request.get("/api/health");

    expect(res.status()).toBe(200);

    const body = await res.json() as { status: string; timestamp: string };
    expect(body.status).toBe("ok");
    expect(Date.parse(body.timestamp)).not.toBeNaN();
  });

  test("responds in under 500 ms once warm", async ({ request }) => {
    // Warm the route first. In dev the first hit COMPILES the route on demand (seconds), which is a
    // property of the dev server, not of the endpoint. We are asserting served latency, so measure
    // the second request.
    await request.get("/api/health");

    const start = Date.now();
    await request.get("/api/health");
    expect(Date.now() - start).toBeLessThan(500);
  });
});
