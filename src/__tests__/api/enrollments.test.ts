import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  enrollment: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  enrollmentPeriod: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  parentStudent: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getServerAuthSession: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/sentry", () => ({ captureError: vi.fn() }));

import { getServerAuthSession } from "@/lib/auth";
import { POST, GET, PATCH } from "@/app/api/enrollments/route";

// ── fixtures ──────────────────────────────────────────────────────────────────

const PROG_ID = "clfkj9nz40000jtqwqhxy4y7g";
const USER_ID = "clfkj9nz40001jtqwqhxy4y7g";
const ENRL_ID = "clfkj9nz40002jtqwqhxy4y7g";
const ORG_ID  = "clfkj9nz40003jtqwqhxy4y7g";

const studentSession = {
  user: { id: USER_ID, email: "student@test.com", role: "STUDENT", organizationId: ORG_ID, firstName: "Test", lastName: "Student" },
};

const mockEnrollment = {
  id: ENRL_ID,
  userId: USER_ID,
  programId: PROG_ID,
  user:    { id: USER_ID, firstName: "Test", lastName: "Student" },
  program: { id: PROG_ID, name: "Test Program" },
};

function makeRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/api/enrollments", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: $transaction calls the callback with the mock prisma (interactive TX API).
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ programId: PROG_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payload (missing programId)", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    const res = await POST(makeRequest({ billingType: "WAIVED" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when a STUDENT tries to enroll another user they do not own", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    mockPrisma.parentStudent.findUnique.mockResolvedValueOnce(null);

    const OTHER_USER = "clfkj9nz49999jtqwqhxy4y7g";
    const res = await POST(makeRequest({ programId: PROG_ID, userId: OTHER_USER }));
    expect(res.status).toBe(403);
  });

  it("creates enrollment + period in a single transaction and returns 201", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);

    // Pre-transaction: check for existing enrollment (none)
    mockPrisma.enrollment.findUnique.mockResolvedValueOnce(null);
    // Inside transaction: upsert, close old period, open new period
    mockPrisma.enrollment.upsert.mockResolvedValueOnce(mockEnrollment);
    mockPrisma.enrollmentPeriod.updateMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.enrollmentPeriod.create.mockResolvedValueOnce({ id: "period-1" });

    const res = await POST(makeRequest({ programId: PROG_ID }));
    const data = await res.json() as { enrollment: typeof mockEnrollment };

    expect(res.status).toBe(201);
    expect(data.enrollment.id).toBe(ENRL_ID);
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.enrollmentPeriod.create).toHaveBeenCalledOnce();
  });

  it("reactivates an existing suspended enrollment", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);

    // Existing SUSPENDED enrollment
    mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ id: ENRL_ID, status: "SUSPENDED" });
    mockPrisma.enrollment.upsert.mockResolvedValueOnce({ ...mockEnrollment, status: "ACTIVE" });
    mockPrisma.enrollmentPeriod.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.enrollmentPeriod.create.mockResolvedValueOnce({ id: "period-2" });

    const res = await POST(makeRequest({ programId: PROG_ID }));
    expect(res.status).toBe(201);
    // Reactivation uses REACTIVATION reason, period is still created
    expect(mockPrisma.enrollmentPeriod.create).toHaveBeenCalledOnce();
  });
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/enrollments");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns own enrollments for a STUDENT", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    (mockPrisma.enrollment as unknown as { findMany: ReturnType<typeof vi.fn> }).findMany =
      vi.fn().mockResolvedValueOnce([mockEnrollment]);

    const req = new Request("http://localhost/api/enrollments");
    const res = await GET(req);
    const data = await res.json() as { enrollments: unknown[] };

    expect(res.status).toBe(200);
    expect(data.enrollments).toHaveLength(1);
  });
});

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/enrollments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(null);
    const res = await PATCH(makeRequest({ enrollmentId: ENRL_ID, status: "SUSPENDED" }, "PATCH"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    const res = await PATCH(makeRequest({ enrollmentId: ENRL_ID, status: "SUSPENDED" }, "PATCH"));
    expect(res.status).toBe(403);
  });
});
