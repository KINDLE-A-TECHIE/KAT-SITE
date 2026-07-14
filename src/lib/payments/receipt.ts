import { randomUUID } from "node:crypto";

/**
 * Crypto-seeded, collision-resistant identifiers for the payment domain.
 *
 * Every identifier here backs a column with a UNIQUE constraint and is written by an
 * `upsert`/`create` with no retry loop, so a collision does not merely repeat a
 * number, it THROWS and fails a payment side effect. `Math.random()` is not
 * acceptable here: it is not collision-resistant and, in a serverless runtime where
 * many instances start at the same instant, its seeding is weakest exactly when
 * concurrency is highest. All suffixes therefore come from `crypto.randomUUID()`.
 */

/** 8 uppercase hex chars from a cryptographically-strong UUID → 16^8 (~4.3B) per day. */
function cryptoSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function utcDateStamp(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/** Receipt number. `KAT-RCP-YYYYMMDD-XXXXXXXX`. Backs `PaymentReceipt.receiptNumber` (unique). */
export function generateReceiptNumber(): string {
  return `KAT-RCP-${utcDateStamp()}-${cryptoSuffix()}`;
}

/** B2C payment reference. `KAT-PAY-YYYYMMDD-XXXXXXXX`. Backs `Payment.reference` (unique). */
export function generatePaymentReference(): string {
  return `KAT-PAY-${utcDateStamp()}-${cryptoSuffix()}`;
}

/** Batch payment reference. `KAT-BATCH-YYYYMMDD-XXXXXXXX`. */
export function generateBatchReference(): string {
  return `KAT-BATCH-${utcDateStamp()}-${cryptoSuffix()}`;
}

/**
 * School invoice reference. `KAT-SCH-YYYYMMDD-XXXXXXXX`. Backs
 * `SchoolInvoice.paystackRef` (unique).
 *
 * The distinct `SCH` prefix is deliberate: the Paystack webhook receives B2C and
 * school events on the same URL and tells them apart by looking the reference up, so
 * a human reading a Paystack dashboard or a log can tell which pipeline a payment
 * belongs to at a glance.
 */
export function generateInvoiceReference(): string {
  return `KAT-SCH-${utcDateStamp()}-${cryptoSuffix()}`;
}
