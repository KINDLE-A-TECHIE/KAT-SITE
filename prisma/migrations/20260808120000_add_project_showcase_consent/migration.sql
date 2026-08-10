-- Consent to feature a build publicly (name + photo) on the landing. Defaults to false so no
-- existing project starts opted-in; the builder's photo only shows when this is explicitly true.
ALTER TABLE "Project" ADD COLUMN "showcaseConsent" BOOLEAN NOT NULL DEFAULT false;
