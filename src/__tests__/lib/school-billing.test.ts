import { describe, it, expect, vi, beforeEach } from "vitest";
import { SchoolInvoicePaymentMethod, SchoolInvoiceStatus, SchoolLicenseStatus } from "@prisma/client";

/**
 * markInvoicePaidAndActivate must be IDEMPOTENT. Paystack retries its webhook, and the
 * verify-on-return endpoint can fire for the same reference the webhook already handled. Running
 * twice must not double-activate a licence, double-count seats, or revive a voided invoice. These
 * are the branches where "runs twice" would go wrong, so they are the branches worth pinning.
 */

// Hoisted so the vi.mock factory (itself hoisted to the top of the file) can reference it.
const mockPrisma = vi.hoisted(() => ({
  schoolInvoice: { findUnique: vi.fn(), update: vi.fn() },
  schoolLicense: { upsert: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { computeInvoiceAmount, markInvoicePaidAndActivate } from "@/lib/school-billing";

const invoice = (status: SchoolInvoiceStatus) => ({
  id: "inv_1",
  schoolId: "sch_1",
  sessionLabel: "2025/2026",
  termNumber: 1,
  startsAt: null,
  seatCount: 40,
  status,
  school: { pricePerSeat: 2500 },
});

beforeEach(() => {
  vi.clearAllMocks();
  // A working transaction: run the callback with a tx that records the writes.
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      schoolInvoice: { update: vi.fn() },
      schoolLicense: { upsert: vi.fn() },
    }),
  );
});

describe("computeInvoiceAmount", () => {
  it("charges list price with no concession", () => {
    expect(computeInvoiceAmount(40, 2500, 0)).toEqual({ list: 100000, discountPercent: 0, amount: 100000 });
  });

  it("applies a partial concession to the net amount", () => {
    expect(computeInvoiceAmount(10, 2500, 20)).toEqual({ list: 25000, discountPercent: 20, amount: 20000 });
  });

  it("nets zero for a 100% (sponsored) concession", () => {
    expect(computeInvoiceAmount(40, 2500, 100).amount).toBe(0);
  });

  it("a fully-sponsored school with no list price still nets zero", () => {
    expect(computeInvoiceAmount(30, 0, 100).amount).toBe(0);
  });

  it("clamps an out-of-range discount to 0..100", () => {
    expect(computeInvoiceAmount(10, 2500, 150).amount).toBe(0); // clamped to 100
    expect(computeInvoiceAmount(10, 2500, -10).amount).toBe(25000); // clamped to 0
  });

  it("rounds to two decimals (kobo)", () => {
    // 3 seats x 999.99 = 2999.97; 33% off -> 2009.9799 -> 2009.98
    expect(computeInvoiceAmount(3, 999.99, 33).amount).toBe(2009.98);
  });
});

describe("markInvoicePaidAndActivate", () => {
  it("returns false and writes nothing when the reference is not a school invoice", async () => {
    mockPrisma.schoolInvoice.findUnique.mockResolvedValue(null);

    expect(await markInvoicePaidAndActivate("KAT-SCH-nope")).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("is a no-op on an already-PAID invoice (webhook re-delivery)", async () => {
    mockPrisma.schoolInvoice.findUnique.mockResolvedValue(invoice(SchoolInvoiceStatus.PAID));

    expect(await markInvoicePaidAndActivate("KAT-SCH-1")).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to revive a VOID invoice", async () => {
    mockPrisma.schoolInvoice.findUnique.mockResolvedValue(invoice(SchoolInvoiceStatus.VOID));

    expect(await markInvoicePaidAndActivate("KAT-SCH-1")).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("activates the term's licence exactly once for a PENDING invoice", async () => {
    let upsertArgs: unknown;
    mockPrisma.schoolInvoice.findUnique.mockResolvedValue(invoice(SchoolInvoiceStatus.PENDING));
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        schoolInvoice: { update: vi.fn() },
        schoolLicense: { upsert: vi.fn((args: unknown) => (upsertArgs = args)) },
      }),
    );

    expect(await markInvoicePaidAndActivate("KAT-SCH-1")).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // The licence is set ACTIVE, and a renewal must NOT reset seatsUsed (only present on create).
    const args = upsertArgs as {
      update: { status: SchoolLicenseStatus; seatsUsed?: number };
      create: { status: SchoolLicenseStatus; seatsUsed: number };
    };
    expect(args.update.status).toBe(SchoolLicenseStatus.ACTIVE);
    expect(args.update.seatsUsed).toBeUndefined();
    expect(args.create.seatsUsed).toBe(0);
  });

  it("defaults the payment method to PAYSTACK (webhook/verify path)", async () => {
    let updateArgs: unknown;
    mockPrisma.schoolInvoice.findUnique.mockResolvedValue(invoice(SchoolInvoiceStatus.PENDING));
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        schoolInvoice: { update: vi.fn((a: unknown) => (updateArgs = a)) },
        schoolLicense: { upsert: vi.fn() },
      }),
    );

    await markInvoicePaidAndActivate("KAT-SCH-1");
    const data = (updateArgs as { data: { paymentMethod: string; paymentNote?: string } }).data;
    expect(data.paymentMethod).toBe(SchoolInvoicePaymentMethod.PAYSTACK);
    expect(data.paymentNote).toBeUndefined();
  });

  it("records a manual BANK_TRANSFER payment with its note", async () => {
    let updateArgs: unknown;
    mockPrisma.schoolInvoice.findUnique.mockResolvedValue(invoice(SchoolInvoiceStatus.PENDING));
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        schoolInvoice: { update: vi.fn((a: unknown) => (updateArgs = a)) },
        schoolLicense: { upsert: vi.fn() },
      }),
    );

    await markInvoicePaidAndActivate("KAT-SCH-1", {
      method: SchoolInvoicePaymentMethod.BANK_TRANSFER,
      note: "GTB transfer ref 12345",
    });
    const data = (updateArgs as { data: { paymentMethod: string; paymentNote?: string } }).data;
    expect(data.paymentMethod).toBe(SchoolInvoicePaymentMethod.BANK_TRANSFER);
    expect(data.paymentNote).toBe("GTB transfer ref 12345");
  });
});
