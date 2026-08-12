-- Super-admin billing suspension for a school. NULL = active. When set, the billing route refuses new
-- invoices; existing paid, in-window licences are untouched so pupils are not cut off mid-term.
ALTER TABLE "School" ADD COLUMN "suspendedAt" TIMESTAMP(3);
