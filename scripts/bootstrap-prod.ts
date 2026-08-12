/**
 * Production bootstrap. Safe to run against a fresh (or existing) production database.
 *
 * Unlike the dev seed (`prisma/seed.ts`), this creates NO demo accounts and NO fake data. It does the
 * three things a real deployment actually needs, all idempotent (safe to re-run):
 *
 *   1. Upserts the default Organisation, from DEFAULT_ORGANIZATION_* (the same record the app
 *      auto-creates at runtime via ensureDefaultOrganization). Harmless if it already exists.
 *   2. Creates (or promotes) ONE super-admin from SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD. This breaks
 *      the chicken-and-egg: public signup only makes parents/students, and invites/promote both need an
 *      existing super-admin. The password is set only when the account is CREATED; on an existing
 *      account it promotes the role and leaves the password alone unless you pass --reset-password.
 *   3. With --nerdc, seeds the NERDC school curriculum (real KAT-authored courses/terms/lessons, no
 *      demo schools or pupils). Skip it if you are not running the B2B school product.
 *
 * Run it AFTER `prisma migrate deploy`, with the same DATABASE_URL / DIRECT_URL the app uses:
 *
 *   SUPERADMIN_EMAIL=you@kindleatechie.com SUPERADMIN_PASSWORD='a-long-strong-secret' \
 *     npx tsx scripts/bootstrap-prod.ts --nerdc
 *
 * Locally you can load an env file instead of prefixing: `npx tsx --env-file=.env.local scripts/bootstrap-prod.ts`.
 */
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { seedNerdcCourses } from "../prisma/seed-nerdc";

const prisma = new PrismaClient();
const flags = new Set(process.argv.slice(2));

function fail(message: string): never {
  console.error(`\nBOOTSTRAP FAILED: ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  const firstName = process.env.SUPERADMIN_FIRST_NAME?.trim() || "Platform";
  const lastName = process.env.SUPERADMIN_LAST_NAME?.trim() || "Owner";

  if (!email) fail("Set SUPERADMIN_EMAIL.");
  if (!password) fail("Set SUPERADMIN_PASSWORD.");
  if (password.length < 12) fail("SUPERADMIN_PASSWORD must be at least 12 characters. Use a strong secret.");
  if (password === "Passw0rd!") fail("That is the dev seed password. Refusing to use it in production.");

  // 1. Organisation, identical to what the app upserts at runtime.
  const code = process.env.DEFAULT_ORGANIZATION_CODE?.trim() || "KAT-ORG";
  const name = process.env.DEFAULT_ORGANIZATION_NAME?.trim() || "KAT Learning";
  const domain = process.env.DEFAULT_ORGANIZATION_DOMAIN?.trim();
  const org = await prisma.organization.upsert({
    where: { code },
    update: { name, ...(domain ? { domain } : {}) },
    create: { code, name, domain: domain || undefined },
    select: { id: true, code: true },
  });
  console.log(`Organisation ready: ${org.code}`);

  // 2. Super-admin. Create-with-password, or promote-only for an existing account.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  let superAdminId: string;
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role: UserRole.SUPER_ADMIN,
        organizationId: org.id,
        passwordHash,
        isActive: true,
        profile: { create: { headline: "Platform owner", bio: "KAT platform administrator." } },
      },
      select: { id: true },
    });
    superAdminId = created.id;
    console.log(`Super-admin created: ${email}`);
  } else {
    const resetPassword = flags.has("--reset-password");
    const data: { role: UserRole; organizationId: string; isActive: true; passwordHash?: string } = {
      role: UserRole.SUPER_ADMIN,
      organizationId: org.id,
      isActive: true,
    };
    if (resetPassword) data.passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { email }, data });
    superAdminId = existing.id;
    console.log(
      `Existing account promoted to super-admin: ${email} ` +
        (resetPassword ? "(password reset)" : "(password left unchanged; pass --reset-password to change it)"),
    );
  }

  // 3. Optional NERDC school curriculum (real content; nothing school- or pupil-specific).
  if (flags.has("--nerdc")) {
    console.log("Seeding the NERDC school curriculum (this can take a minute)...");
    await seedNerdcCourses(prisma, { organizationId: org.id, createdById: superAdminId });
    console.log("NERDC curriculum seeded.");
  } else {
    console.log("Skipped the NERDC curriculum. Pass --nerdc to seed the school product's courses.");
  }

  console.log("\nBootstrap complete. No demo accounts or fake data were created.");
  console.log(`Sign in as ${email}, then invite admins and author real content from the dashboard.\n`);
}

main()
  .catch((error) => {
    console.error("BOOTSTRAP FAILED:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
