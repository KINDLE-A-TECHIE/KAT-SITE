// Load .env.local so DB-backed integration tests can reach a real database. dotenv does NOT
// override variables already present, so CI's own DATABASE_URL always wins.
//
// Without this the cross-tenant leak test finds no DATABASE_URL and SILENTLY SKIPS, reporting green
// while testing nothing. A skipped security test manufactures confidence.
import { config } from "dotenv";
config({ path: ".env.local" });

// Load .env.local so DB-backed integration tests can reach a real database. dotenv does NOT
// override variables already present, so CI's own DATABASE_URL always wins.
//
// This matters more than it looks: without it, the cross-tenant leak test finds no DATABASE_URL and
// SILENTLY SKIPS, reporting green while testing nothing. A skipped security test manufactures
// confidence, which is worse than having none.
config({ path: ".env.local" });

// Baseline env vars used by multiple lib modules. Individual test files may
// override these with vi.stubEnv / process.env assignment before importing.
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.R2_PUBLIC_URL = "https://cdn.example.com";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
