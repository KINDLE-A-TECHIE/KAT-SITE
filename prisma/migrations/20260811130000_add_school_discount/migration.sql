-- Super-admin negotiated concession on a school, applied to every invoice it raises and
-- snapshotted onto the invoice. 100 = a sponsored/free term (nets zero, skips Paystack).
ALTER TABLE "School" ADD COLUMN "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "School" ADD COLUMN "discountReason" TEXT;

ALTER TABLE "SchoolInvoice" ADD COLUMN "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "SchoolInvoice" ADD COLUMN "discountReason" TEXT;
