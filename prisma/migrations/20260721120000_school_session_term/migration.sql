-- A2: replace the free-text `term` on SchoolClass / SchoolLicense / SchoolInvoice with a structured
-- session + term model. Single guarded migration (data is tiny; take a Neon snapshot first).
--
-- Shape: add nullable columns -> backfill by parsing the old string -> AUDIT (RAISE on any
-- unparseable row or unique collision, which rolls the whole migration back) -> enforce NOT NULL ->
-- swap the unique -> drop the old columns. termNumber is the 1..3 after "term"/"t" (default 1);
-- sessionLabel is what remains once that marker is removed (this mirrors parseTerm in school-term.ts).

-- 1. Add new columns (nullable for the backfill).
ALTER TABLE "SchoolClass"   ADD COLUMN "sessionLabel" TEXT;
ALTER TABLE "SchoolLicense"  ADD COLUMN "sessionLabel" TEXT,
                             ADD COLUMN "termNumber"   INTEGER,
                             ADD COLUMN "startsAt"     TIMESTAMP(3);
ALTER TABLE "SchoolInvoice"  ADD COLUMN "sessionLabel" TEXT,
                             ADD COLUMN "termNumber"   INTEGER,
                             ADD COLUMN "startsAt"     TIMESTAMP(3);

-- 2. Backfill. termNumber = digit after term/t (default 1); sessionLabel = remainder, collapsed.
UPDATE "SchoolLicense"
   SET "termNumber"   = COALESCE((regexp_match("term", '\y(?:term|t)\s*([1-3])\y', 'i'))[1]::int, 1),
       "sessionLabel" = NULLIF(btrim(regexp_replace(regexp_replace("term", '\y(?:term|t)\s*[1-3]\y', '', 'gi'), '\s+', ' ', 'g')), '');
UPDATE "SchoolLicense" SET "sessionLabel" = btrim(regexp_replace("term", '\s+', ' ', 'g')) WHERE "sessionLabel" IS NULL;

UPDATE "SchoolInvoice"
   SET "termNumber"   = COALESCE((regexp_match("term", '\y(?:term|t)\s*([1-3])\y', 'i'))[1]::int, 1),
       "sessionLabel" = NULLIF(btrim(regexp_replace(regexp_replace("term", '\y(?:term|t)\s*[1-3]\y', '', 'gi'), '\s+', ' ', 'g')), '');
UPDATE "SchoolInvoice" SET "sessionLabel" = btrim(regexp_replace("term", '\s+', ' ', 'g')) WHERE "sessionLabel" IS NULL;

UPDATE "SchoolClass"
   SET "sessionLabel" = NULLIF(btrim(regexp_replace(regexp_replace("term", '\y(?:term|t)\s*[1-3]\y', '', 'gi'), '\s+', ' ', 'g')), '');
UPDATE "SchoolClass" SET "sessionLabel" = btrim(regexp_replace("term", '\s+', ' ', 'g')) WHERE "sessionLabel" IS NULL;

-- 3. Audit. Any unparseable row or post-backfill collision aborts the whole migration (it runs in a
-- transaction), so a surprise row stops the migration instead of corrupting data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "SchoolClass"   WHERE "sessionLabel" IS NULL OR "sessionLabel" = '') THEN
    RAISE EXCEPTION 'A2 migration: SchoolClass has an unparseable term';
  END IF;
  IF EXISTS (SELECT 1 FROM "SchoolLicense"  WHERE "sessionLabel" IS NULL OR "sessionLabel" = '' OR "termNumber" IS NULL) THEN
    RAISE EXCEPTION 'A2 migration: SchoolLicense has an unparseable term';
  END IF;
  IF EXISTS (SELECT 1 FROM "SchoolInvoice"  WHERE "sessionLabel" IS NULL OR "sessionLabel" = '' OR "termNumber" IS NULL) THEN
    RAISE EXCEPTION 'A2 migration: SchoolInvoice has an unparseable term';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "SchoolLicense"
     GROUP BY "schoolId", "sessionLabel", "termNumber"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'A2 migration: SchoolLicense (schoolId, sessionLabel, termNumber) collision after backfill';
  END IF;
END $$;

-- 4. Enforce NOT NULL now the backfill is verified.
ALTER TABLE "SchoolClass"   ALTER COLUMN "sessionLabel" SET NOT NULL;
ALTER TABLE "SchoolLicense"  ALTER COLUMN "sessionLabel" SET NOT NULL,
                             ALTER COLUMN "termNumber"   SET NOT NULL;
ALTER TABLE "SchoolInvoice"  ALTER COLUMN "sessionLabel" SET NOT NULL,
                             ALTER COLUMN "termNumber"   SET NOT NULL;

-- 5. Swap the unique (one licence per school-term).
DROP INDEX IF EXISTS "SchoolLicense_schoolId_term_key";
CREATE UNIQUE INDEX "SchoolLicense_schoolId_sessionLabel_termNumber_key"
    ON "SchoolLicense"("schoolId", "sessionLabel", "termNumber");

-- 6. Drop the old free-text columns.
ALTER TABLE "SchoolClass"   DROP COLUMN "term";
ALTER TABLE "SchoolLicense"  DROP COLUMN "term";
ALTER TABLE "SchoolInvoice"  DROP COLUMN "term";
