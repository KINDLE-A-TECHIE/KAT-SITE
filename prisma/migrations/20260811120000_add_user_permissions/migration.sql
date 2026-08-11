-- Per-account capability areas for ADMIN/INSTRUCTOR staff ("need to know"). See src/lib/capabilities.ts.
ALTER TABLE "User" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Full-then-restrict: existing admins and instructors keep ALL areas so nothing breaks; a super-admin
-- restricts from there. Keys MUST match CAPABILITY_KEYS in src/lib/capabilities.ts.
UPDATE "User"
SET "permissions" = ARRAY[
  'curriculum','assessments','challenges','projects','sessions','payments','analytics','fellowship',
  'testimonials','partner_inquiries','schools','messaging'
]::TEXT[]
WHERE "role" IN ('ADMIN','INSTRUCTOR');
