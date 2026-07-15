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
  user:            { findUnique: vi.fn() },
  enrollment:      { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  enrollmentPeriod:{ updateMany: vi.fn(), create: vi.fn() },
  payment:         { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  paymentReceipt:  { upsert: vi.fn() },
  parentStudent:   { findUnique: vi.fn() },
  discountCode:    { findUnique: vi.fn() },
  fellowApplication:{ findUnique: vi.fn() },
  program:         { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma",           () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth",             () => ({ getServerAuthSession: vi.fn() }));
vi.mock("@/lib/analytics",        () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/sentry",           () => ({ captureError: vi.fn() }));
vi.mock("@/lib/payments/provider",() => ({ getPaymentGateway: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({
  paymentInitLimiter:   null,
  paymentVerifyLimiter: null,
  rateLimitResponse:    vi.fn(),
  getClientIp:          vi.fn(() => "127.0.0.1"),
}));

import { getServerAuthSession } from "@/lib/auth";
import { POST as initializePayment } from "@/app/api/payments/initialize/route";
import { POST as verifyPayment }     from "@/app/api/payments/verify/route";

// ── fixtures ──────────────────────────────────────────────────────────────────

const PROG_ID   = "clfkj9nz40000jtqwqhxy4y7g";
const USER_ID   = "clfkj9nz40001jtqwqhxy4y7g";
const ENRL_ID   = "clfkj9nz40002jtqwqhxy4y7g";
const ORG_ID    = "clfkj9nz40003jtqwqhxy4y7g";
const PAY_ID    = "clfkj9nz40004jtqwqhxy4y7g";
const PAY_REF   = "KAT-LJ3TKS-ABCD12";

const studentSession = {
  user: { id: USER_ID, email: "student@test.com", role: "STUDENT", organizationId: ORG_ID, firstName: "Test", lastName: "Student" },
};

const mockUser = { id: USER_ID, email: "student@test.com", organizationId: ORG_ID, role: "STUDENT" };

const pendingPayment = {
  id: PAY_ID,
  reference: PAY_REF,
  status: "PENDING",
  amount: 5000,
  currency: "NGN",
  userId: USER_ID,
  enrollmentId: ENRL_ID,
  metadata: {},
  enrollment: { currentPeriodEnd: null },
  user: { id: USER_ID, organizationId: ORG_ID },
};

function initReq(body: unknown) {
  return new Request("http://localhost/api/payments/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function verifyReq(body: unknown) {
  return new Request("http://localhost/api/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── initialize ────────────────────────────────────────────────────────────────

describe("POST /api/payments/initialize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(null);
    const res = await initializePayment(initReq({}));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields (no programId or fellowApplicationId)", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    const res = await initializePayment(initReq({ amount: 5000, currency: "NGN" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when billingMonth is missing for enrollment payment", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
    // No billingMonth provided → route returns 400
    const res = await initializePayment(initReq({
      programId: PROG_ID,
      amount: 5000,
      currency: "NGN",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 201 with mock authorizationUrl when PAYSTACK_SECRET_KEY is absent", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
    mockPrisma.program.findUnique.mockResolvedValueOnce({ id: PROG_ID, organizationId: ORG_ID });
    // enrollmentId provided → route validates it: needs userId + programId
    mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ userId: USER_ID, programId: PROG_ID });
    mockPrisma.payment.findFirst.mockResolvedValueOnce(null);
    mockPrisma.payment.create.mockResolvedValueOnce({
      id: PAY_ID, reference: PAY_REF, status: "PENDING", amount: 5000, currency: "NGN", provider: "PAYSTACK",
    });

    const res = await initializePayment(initReq({
      programId: PROG_ID,
      enrollmentId: ENRL_ID,
      amount: 5000,
      currency: "NGN",
      billingMonth: "2026-05-01T00:00:00.000Z",
    }));
    const data = await res.json() as { payment: { reference: string }; authorizationUrl: string };

    expect(res.status).toBe(201);
    expect(data.payment.reference).toBe(PAY_REF);
    expect(data.authorizationUrl).toContain("mock=true");
    expect(mockPrisma.payment.create).toHaveBeenCalledOnce();
  });

  it("returns 409 when a pending payment already exists for this billing month", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
    mockPrisma.program.findUnique.mockResolvedValueOnce({ id: PROG_ID, organizationId: ORG_ID });
    mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ userId: USER_ID, programId: PROG_ID });
    mockPrisma.payment.findFirst.mockResolvedValueOnce({ id: "pay-existing", status: "PENDING" });

    const res = await initializePayment(initReq({
      programId: PROG_ID,
      enrollmentId: ENRL_ID,
      amount: 5000,
      currency: "NGN",
      billingMonth: "2026-05-01T00:00:00.000Z",
    }));
    expect(res.status).toBe(409);
  });
});

// ── verify ────────────────────────────────────────────────────────────────────

describe("POST /api/payments/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(null);
    const res = await verifyPayment(verifyReq({}));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing reference", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    const res = await verifyPayment(verifyReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when payment reference does not exist", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    mockPrisma.payment.findUnique.mockResolvedValueOnce(null);

    const res = await verifyPayment(verifyReq({ reference: "KAT-NOTFOUND-000000" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller does not own the payment", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    const OTHER = "clfkj9nz49999jtqwqhxy4y7g";
    mockPrisma.payment.findUnique.mockResolvedValueOnce({
      ...pendingPayment,
      userId: OTHER,
      user: { id: OTHER, organizationId: ORG_ID },
      metadata: {},
    });

    const res = await verifyPayment(verifyReq({ reference: PAY_REF }));
    expect(res.status).toBe(403);
  });

  it("returns 200 with alreadyVerified when payment is already SUCCESS", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    mockPrisma.payment.findUnique.mockResolvedValueOnce({
      ...pendingPayment,
      status: "SUCCESS",
    });

    const res = await verifyPayment(verifyReq({ reference: PAY_REF }));
    const data = await res.json() as { verification: { alreadyVerified: boolean } };

    expect(res.status).toBe(200);
    expect(data.verification.alreadyVerified).toBe(true);
    expect(mockPrisma.payment.update).not.toHaveBeenCalled();
  });

  it("verifies PENDING payment, creates receipt, and advances enrollment period (mock gateway)", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValueOnce(studentSession as never);
    mockPrisma.payment.findUnique.mockResolvedValueOnce(pendingPayment);
    mockPrisma.payment.update.mockResolvedValueOnce({ ...pendingPayment, status: "SUCCESS" });
    mockPrisma.paymentReceipt.upsert.mockResolvedValueOnce({ id: "rcpt-1" });
    mockPrisma.enrollment.findUnique.mockResolvedValueOnce({ status: "ACTIVE" });
    mockPrisma.enrollment.update.mockResolvedValueOnce({});
    mockPrisma.enrollmentPeriod.updateMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.enrollmentPeriod.create.mockResolvedValueOnce({ id: "period-1" });

    const res = await verifyPayment(verifyReq({ reference: PAY_REF }));
    const data = await res.json() as { verification: { success: boolean } };

    expect(res.status).toBe(200);
    expect(data.verification.success).toBe(true);
    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS" }) }),
    );
    expect(mockPrisma.paymentReceipt.upsert).toHaveBeenCalledOnce();
    expect(mockPrisma.enrollmentPeriod.create).toHaveBeenCalledOnce();
  });
});
