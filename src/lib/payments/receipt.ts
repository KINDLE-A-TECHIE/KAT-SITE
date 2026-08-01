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

/**
 * 16 uppercase hex chars (64 bits) from a cryptographically-strong UUID.
 *
 * Width matters here. These suffixes back UNIQUE columns written without a retry loop, so a
 * collision does not repeat a number, it throws and fails a payment. 8 hex (32 bits) is not enough:
 * by the birthday bound, 20000 values in a 2^32 space collide with ~5% probability, which made the
 * uniqueness test genuinely flaky. 64 bits pushes that below ~1e-11 even at 20000/day, and stays
 * safe at far higher volumes (the date prefix already resets the space daily).
 */
function cryptoSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
}

function utcDateStamp(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/** Receipt number. `KAT-RCP-YYYYMMDD-<16 hex>`. Backs `PaymentReceipt.receiptNumber` (unique). */
export function generateReceiptNumber(): string {
  return `KAT-RCP-${utcDateStamp()}-${cryptoSuffix()}`;
}

/** B2C payment reference. `KAT-PAY-YYYYMMDD-<16 hex>`. Backs `Payment.reference` (unique). */
export function generatePaymentReference(): string {
  return `KAT-PAY-${utcDateStamp()}-${cryptoSuffix()}`;
}

/** Batch payment reference. `KAT-BATCH-YYYYMMDD-<16 hex>`. */
export function generateBatchReference(): string {
  return `KAT-BATCH-${utcDateStamp()}-${cryptoSuffix()}`;
}

/**
 * School invoice reference. `KAT-SCH-YYYYMMDD-<16 hex>`. Backs
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
