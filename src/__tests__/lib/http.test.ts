import { describe, it, expect, vi } from "vitest";

// Mock NextResponse before importing the module under test
vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      _data: data,
      status: init?.status ?? 200,
      async json() {
        return this._data;
      },
    }),
  },
}));

import { ok, fail } from "@/lib/http";

describe("ok", () => {
  it("defaults to HTTP 200", async () => {
    const res = ok({ id: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 1 });
  });

  it("accepts a custom status code", async () => {
    const res = ok({ created: true }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ created: true });
  });

  it("passes the data payload through unchanged", async () => {
    const payload = { a: 1, b: [2, 3], c: null };
    const res = ok(payload);
    expect(await res.json()).toEqual(payload);
  });
});

describe("fail", () => {
  it("defaults to HTTP 400", async () => {
    const res = fail("Bad input");
    expect(res.status).toBe(400);
  });

  it("wraps the message in an error field", async () => {
    const res = fail("Not found", 404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
    expect(res.status).toBe(404);
  });

  it("includes details when provided", async () => {
    const details = { field: "email", issue: "required" };
    const res = fail("Validation error", 422, details);
    const body = await res.json();
    expect(body.details).toEqual(details);
  });

  it("sets details to undefined when omitted", async () => {
    const res = fail("Oops");
    const body = await res.json();
    expect(body.details).toBeUndefined();
  });
});
