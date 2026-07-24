import { describe, it, expect, vi, beforeEach } from "vitest";

// fail()/ok() use NextResponse.json; mock it to a plain { status, json } like the other API tests.
vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  lessonContent: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getServerAuthSession: vi.fn() }));
vi.mock("@/lib/sentry", () => ({ captureError: vi.fn() }));
// Keep the rate limiter out of the picture (it no-ops without env, but mock to be safe).
vi.mock("@upstash/ratelimit", () => ({ Ratelimit: class { static slidingWindow() { return {}; } limit() { return { success: true }; } } }));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));

import { getServerAuthSession } from "@/lib/auth";
import { POST } from "@/app/api/curriculum/contents/[contentId]/run/route";

const studentSession = { user: { id: "u1", role: "STUDENT" } };

const publishedPython = { type: "CODE_PLAYGROUND", language: "python", reviewStatus: "PUBLISHED" };

function call(body: unknown, contentId = "c1") {
  const req = new Request(`http://localhost/api/curriculum/contents/${contentId}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ contentId }) });
}

describe("POST /api/curriculum/contents/[contentId]/run gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getServerAuthSession as ReturnType<typeof vi.fn>).mockResolvedValue(studentSession);
    mockPrisma.lessonContent.findUnique.mockResolvedValue(publishedPython);
  });

  it("401 when not signed in", async () => {
    (getServerAuthSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await call({ code: "print(1)" });
    expect(res.status).toBe(401);
  });

  it("404 when the content does not exist", async () => {
    mockPrisma.lessonContent.findUnique.mockResolvedValue(null);
    const res = await call({ code: "print(1)" });
    expect(res.status).toBe(404);
  });

  it("400 when the content is not a code playground", async () => {
    mockPrisma.lessonContent.findUnique.mockResolvedValue({ ...publishedPython, type: "RICH_TEXT" });
    const res = await call({ code: "print(1)" });
    expect(res.status).toBe(400);
  });

  it("400 when the playground has no language", async () => {
    mockPrisma.lessonContent.findUnique.mockResolvedValue({ ...publishedPython, language: null });
    const res = await call({ code: "print(1)" });
    expect(res.status).toBe(400);
  });

  it("403 when a student runs unpublished content", async () => {
    mockPrisma.lessonContent.findUnique.mockResolvedValue({ ...publishedPython, reviewStatus: "PENDING_REVIEW" });
    const res = await call({ code: "print(1)" });
    expect(res.status).toBe(403);
  });

  it("400 when code is missing", async () => {
    const res = await call({});
    expect(res.status).toBe(400);
  });

  it("400 when code exceeds the 50k cap", async () => {
    const res = await call({ code: "x".repeat(50_001) });
    expect(res.status).toBe(400);
  });

  it("400 for an unsupported language", async () => {
    mockPrisma.lessonContent.findUnique.mockResolvedValue({ ...publishedPython, language: "brainfuck" });
    const res = await call({ code: "+[----]" });
    expect(res.status).toBe(400);
  });

  it("does not leak the publish gate to a student (unpublished is 403, not run)", async () => {
    // Regression guard: a STUDENT must never reach execution on unpublished content.
    mockPrisma.lessonContent.findUnique.mockResolvedValue({ ...publishedPython, reviewStatus: "REJECTED" });
    const res = await call({ code: "print('hi')" });
    expect(res.status).toBe(403);
  });
});
