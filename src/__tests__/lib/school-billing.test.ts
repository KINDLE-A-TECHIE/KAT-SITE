import { describe, it, expect, vi, beforeEach } from "vitest";
import { SchoolInvoiceStatus, SchoolLicenseStatus } from "@prisma/client";

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

import { markInvoicePaidAndActivate } from "@/lib/school-billing";

const invoice = (status: SchoolInvoiceStatus) => ({
  id: "inv_1",
  schoolId: "sch_1",
  term: "2025/2026 Term 1",
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
});
