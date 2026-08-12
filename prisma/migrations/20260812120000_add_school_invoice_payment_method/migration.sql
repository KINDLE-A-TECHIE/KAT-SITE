-- How a PAID school invoice was settled: online (PAYSTACK), manual bank transfer confirmed by a
-- super-admin (BANK_TRANSFER), or a 100% concession that activated free (SPONSORED).
CREATE TYPE "SchoolInvoicePaymentMethod" AS ENUM ('PAYSTACK', 'BANK_TRANSFER', 'SPONSORED');

ALTER TABLE "SchoolInvoice"
  ADD COLUMN "paymentMethod" "SchoolInvoicePaymentMethod" NOT NULL DEFAULT 'PAYSTACK';
ALTER TABLE "SchoolInvoice" ADD COLUMN "paymentNote" TEXT;
