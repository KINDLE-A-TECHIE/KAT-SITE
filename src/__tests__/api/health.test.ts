import { describe, it, expect, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 with status ok and an ISO timestamp", async () => {
    const res = await GET();
    const data = await res.json() as { status: string; timestamp: string };

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(Date.parse(data.timestamp)).not.toBeNaN();
  });

  it("returns a fresh timestamp on each call", async () => {
    const a = await (await GET()).json() as { timestamp: string };
    const b = await (await GET()).json() as { timestamp: string };

    expect(new Date(b.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(a.timestamp).getTime());
  });
});
