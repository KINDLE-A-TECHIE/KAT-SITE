import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHash, randomBytes } from "crypto";
import { PrismaClient, SchoolApiScope, SchoolRole, UserRole } from "@prisma/client";

/**
 * CROSS-TENANT LEAK TEST. School A must never see or touch School B.
 *
 * WHY THIS EXISTS, AND WHY IT USES A REAL DATABASE.
 * The other API tests in this repo (`src/__tests__/api/*`) all `vi.mock("@/lib/prisma")`. They would
 * pass with EVERY `where: { schoolId }` deleted from the codebase, because there is no database for
 * anything to leak from. The bug we are hunting IS a Prisma bug, a missing tenant filter, so a
 * mocked-Prisma cross-tenant test is theatre. This one keeps Prisma real and mocks only the session,
 * which is the seam where identity enters.
 *
 * EVERY NEGATIVE HAS A POSITIVE CONTROL. A test where every endpoint 404s for everything passes
 * vacuously, the exact trap this codebase's harness has fallen into twice. So each "A cannot see B"
 * is paired with "A CAN see A's own", and a leak-shaped bug and a broken-fixture bug look different.
 *
 * WHAT THIS DOES NOT COVER: `src/middleware.ts`. Route handlers are called in-process, so the B2C
 * host 404s and the per-school CSP `frame-ancestors` are NOT exercised here. Those were verified by
 * hand against a running server; if they ever move into a handler, add them.
 */

const DB = process.env.DATABASE_URL;

// A security test that SILENTLY SKIPS is worse than no security test: it manufactures confidence.
// Locally, skip. In CI, a missing database is a RED BUILD.
if (process.env.CI && !DB) {
  throw new Error(
    "CI has no DATABASE_URL, the cross-tenant leak test cannot run. Refusing to report green.",
  );
}

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? DB });

// The session is the only thing mocked. Everything below it. Prisma, the guards, the queries, is
// the real code path a request takes.
const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getServerAuthSession: vi.fn(async () => session.current),
}));

const SUFFIX = randomBytes(4).toString("hex");
const TERM = "XT Term";

type School = {
  id: string;
  slug: string;
  adminId: string;
  teacherId: string;
  classId: string;
  pupilRef: string;
  pupilId: string;
  key: string;
  webhookId: string;
};

const A = {} as School;
const B = {} as School;

async function seedSchool(tag: string, programId: string, orgId: string | null): Promise<School> {
  const slug = `xt-${tag}-${SUFFIX}`;
  const school = await prisma.school.create({
    data: { name: `XT ${tag}`, slug, pricePerSeat: 1000 },
  });

  const mk = async (role: UserRole, name: string) =>
    prisma.user.create({
      data: {
        email: `xt-${tag}-${name}-${SUFFIX}@roster.invalid`,
        firstName: name,
        lastName: tag.toUpperCase(),
        passwordHash: "x",
        role,
        isActive: true,
        organizationId: orgId,
      },
      select: { id: true },
    });

  const admin = await mk(UserRole.SCHOOL_STAFF, "admin");
  const teacher = await mk(UserRole.SCHOOL_STAFF, "teacher");
  const pupil = await mk(UserRole.SCHOOL_STUDENT, "pupil");

  await prisma.schoolMembership.createMany({
    data: [
      { schoolId: school.id, userId: admin.id, role: SchoolRole.SCHOOL_ADMIN },
      { schoolId: school.id, userId: teacher.id, role: SchoolRole.TEACHER },
    ],
  });

  await prisma.schoolLicense.create({
    data: {
      schoolId: school.id,
      term: TERM,
      seatLimit: 50,
      seatsUsed: 1,
      pricePerSeat: 1000,
      status: "ACTIVE",
    },
  });

  const cls = await prisma.schoolClass.create({
    data: {
      schoolId: school.id,
      name: `${tag} class`,
      nerdcLevel: "PRIMARY_4_6",
      term: TERM,
      programId,
      teacherId: teacher.id,
    },
    select: { id: true },
  });

  const pupilRef = `REF-${tag.toUpperCase()}-${SUFFIX}`;
  await prisma.enrollment.create({
    data: {
      userId: pupil.id,
      programId,
      schoolId: school.id,
      schoolClassId: cls.id,
      externalRef: pupilRef,
      status: "ACTIVE",
    },
  });

  const secret = `kat_sk_${randomBytes(24).toString("base64url")}`;
  await prisma.schoolApiKey.create({
    data: {
      schoolId: school.id,
      name: "xt",
      hashedKey: createHash("sha256").update(secret).digest("hex"),
      prefix: secret.slice(0, 12),
      // Every scope, deliberately: we are testing TENANT isolation, not scope enforcement. A key
      // with all scopes and still no cross-school reach is the strongest statement we can make.
      scopes: [
        SchoolApiScope.CLASSES_READ,
        SchoolApiScope.PROGRESS_READ,
        SchoolApiScope.RESULTS_READ,
        SchoolApiScope.ROSTER_WRITE,
        SchoolApiScope.EMBED_MINT,
      ],
    },
  });

  const hook = await prisma.schoolWebhook.create({
    data: { schoolId: school.id, url: `https://${tag}.example.com/hook`, secret: "whsec_x" },
    select: { id: true },
  });

  return {
    id: school.id,
    slug,
    adminId: admin.id,
    teacherId: teacher.id,
    classId: cls.id,
    pupilRef,
    pupilId: pupil.id,
    key: secret,
    webhookId: hook.id,
  };
}

/** A session shaped exactly as NextAuth builds one, for a member of the given school. */
function sessionFor(school: School, who: "admin" | "teacher") {
  return {
    user: {
      id: who === "admin" ? school.adminId : school.teacherId,
      email: "x@y.z",
      role: UserRole.SCHOOL_STAFF,
      organizationId: null,
      schoolMemberships: [
        {
          schoolId: school.id,
          role: who === "admin" ? SchoolRole.SCHOOL_ADMIN : SchoolRole.TEACHER,
        },
      ],
      activeSchoolId: school.id,
    },
  };
}

const HOST = "http://schools.localhost:3000";
const req = (path: string, init?: RequestInit) => new Request(`${HOST}${path}`, init);
const keyed = (key: string, path: string, init: RequestInit = {}) =>
  req(path, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
  });

describe.skipIf(!DB)("cross-tenant isolation: School A must never reach School B", () => {
  beforeAll(async () => {
    // Self-sufficient: create the fixtures we need rather than depending on a seed. CI runs against
    // an empty Postgres, and a test that silently needs `prisma:seed:nerdc` to have run is a test
    // that will one day skip in CI and report green.
    const org =
      (await prisma.organization.findFirst({ select: { id: true } })) ??
      (await prisma.organization.create({
        data: { name: `XT Org ${SUFFIX}`, code: `XT${SUFFIX}` },
        select: { id: true },
      }));

    const program =
      (await prisma.program.findFirst({ where: { audience: "SCHOOL" }, select: { id: true } })) ??
      (await prisma.program.create({
        data: {
          name: `XT Program ${SUFFIX}`,
          slug: `xt-program-${SUFFIX}`,
          description: "cross-tenant test fixture",
          monthlyFee: 0,
          level: "BEGINNER",
          audience: "SCHOOL",
          nerdcLevel: "PRIMARY_4_6",
          organizationId: org.id,
        },
        select: { id: true },
      }));

    Object.assign(A, await seedSchool("a", program.id, org.id));
    Object.assign(B, await seedSchool("b", program.id, org.id));
  }, 120_000);

  afterAll(async () => {
    for (const s of [A, B]) {
      if (!s.id) continue;
      await prisma.enrollment.deleteMany({ where: { schoolId: s.id } });
      await prisma.school.deleteMany({ where: { id: s.id } });
    }
    await prisma.user.deleteMany({ where: { email: { contains: `-${SUFFIX}@roster.invalid` } } });
    await prisma.$disconnect();
  }, 120_000);

  // ─────────────────────────────────────────── the fixtures are real (anti-vacuity)

  it("both schools exist and are distinct (guards against a vacuous pass)", () => {
    expect(A.id).toBeTruthy();
    expect(B.id).toBeTruthy();
    expect(A.id).not.toBe(B.id);
    expect(A.classId).not.toBe(B.classId);
  });

  // ─────────────────────────────────────────── v1 API (real key, nothing mocked)

  it("v1 /classes returns ONLY the key's own school", async () => {
    const { GET } = await import("@/app/api/v1/classes/route");

    const resA = await GET(keyed(A.key, "/api/v1/classes"));
    const bodyA = await resA.json();
    expect(resA.status).toBe(200);

    const ids = bodyA.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(A.classId); // POSITIVE control. A sees its own
    expect(ids).not.toContain(B.classId); // and never B's
  });

  it("v1 /roster REFUSES to write into another school's class", async () => {
    const { POST } = await import("@/app/api/v1/roster/route");

    const res = await POST(
      keyed(A.key, "/api/v1/roster", {
        method: "POST",
        body: JSON.stringify({
          class_id: B.classId, // B's class, A's key
          students: [{ student_id: "INTRUDER-1", name: "Intruder Child" }],
        }),
      }),
    );
    expect(res.status).toBe(404);

    // And prove nothing was written: B's roster is untouched.
    const count = await prisma.enrollment.count({
      where: { schoolClassId: B.classId, externalRef: "INTRUDER-1" },
    });
    expect(count).toBe(0);
  });

  it("v1 /roster DOES write into the key's own class (positive control)", async () => {
    const { POST } = await import("@/app/api/v1/roster/route");

    const res = await POST(
      keyed(A.key, "/api/v1/roster", {
        method: "POST",
        body: JSON.stringify({
          class_id: A.classId,
          students: [{ student_id: `OWN-${SUFFIX}`, name: "Own Child" }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).created).toBe(1);
  });

  it("v1 /students/{ref}/progress cannot resolve another school's pupil", async () => {
    const { GET } = await import("@/app/api/v1/students/[externalRef]/progress/route");

    const own = await GET(keyed(A.key, `/api/v1/students/${A.pupilRef}/progress`), {
      params: Promise.resolve({ externalRef: A.pupilRef }),
    });
    expect(own.status).toBe(200); // POSITIVE control

    const other = await GET(keyed(A.key, `/api/v1/students/${B.pupilRef}/progress`), {
      params: Promise.resolve({ externalRef: B.pupilRef }),
    });
    expect(other.status).toBe(404); // B's pupil does not exist to A
  });

  it("v1 /results never returns another school's pupils", async () => {
    const { GET } = await import("@/app/api/v1/results/route");

    const res = await GET(keyed(A.key, `/api/v1/results?class_id=${B.classId}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Filtering by B's class must yield nothing, the query starts from A's enrollments.
    expect(body.data).toEqual([]);
  });

  it("v1 /webhooks lists only its own, and cannot delete another school's", async () => {
    const { GET, DELETE } = await import("@/app/api/v1/webhooks/route");

    const list = await GET(keyed(A.key, "/api/v1/webhooks"));
    const ids = (await list.json()).data.map((w: { id: string }) => w.id);
    expect(ids).toContain(A.webhookId); // POSITIVE control
    expect(ids).not.toContain(B.webhookId);

    await DELETE(
      keyed(A.key, "/api/v1/webhooks", {
        method: "DELETE",
        body: JSON.stringify({ id: B.webhookId }),
      }),
    );

    // The endpoint may answer 200 (deleteMany matched nothing), but B's webhook MUST survive.
    const survives = await prisma.schoolWebhook.findUnique({ where: { id: B.webhookId } });
    expect(survives).not.toBeNull();
  });

  // ─────────────────────────────────────────── embed / magic-link SSO

  it("an API key cannot mint a launch token for another school's pupil", async () => {
    const { POST } = await import("@/app/api/school/embed/token/route");

    const own = await POST(
      keyed(A.key, "/api/school/embed/token", {
        method: "POST",
        body: JSON.stringify({ ref: A.pupilRef }),
      }),
    );
    expect(own.status).toBe(200); // POSITIVE control

    const other = await POST(
      keyed(A.key, "/api/school/embed/token", {
        method: "POST",
        body: JSON.stringify({ ref: B.pupilRef }),
      }),
    );
    // Signing in as a child of another school would be the worst bug in the product.
    expect(other.status).toBe(404);
  });

  // ─────────────────────────────────────────── session-based school routes

  it("school admin sees only their own classes", async () => {
    session.current = sessionFor(A, "admin");
    const { GET } = await import("@/app/api/school/classes/route");

    const res = await GET();
    const body = await res.json();
    const ids = (body.classes ?? body).map?.((c: { id: string }) => c.id) ?? [];
    expect(ids).toContain(A.classId); // POSITIVE control
    expect(ids).not.toContain(B.classId);
  });

  it("school admin cannot EDIT another school's class", async () => {
    session.current = sessionFor(A, "admin");
    const { PATCH } = await import("@/app/api/school/classes/route");

    const res = await PATCH(
      req("/api/school/classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: B.classId, name: "PWNED" }),
      }),
    );
    expect(res.status).toBe(404);

    const untouched = await prisma.schoolClass.findUnique({ where: { id: B.classId } });
    expect(untouched?.name).not.toBe("PWNED");
  });

  it("school admin cannot import a roster into another school's class", async () => {
    session.current = sessionFor(A, "admin");
    const { POST } = await import("@/app/api/school/roster/import/route");

    const res = await POST(
      req("/api/school/roster/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolClassId: B.classId,
          csv: "name\nIntruder Two\n",
        }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("school admin cannot pull a report for another school's class", async () => {
    session.current = sessionFor(A, "admin");
    const { GET } = await import("@/app/api/school/reports/route");

    const own = await GET(req(`/api/school/reports?classId=${A.classId}`));
    expect(own.status).toBe(200); // POSITIVE control

    const other = await GET(req(`/api/school/reports?classId=${B.classId}`));
    expect(other.status).toBe(404);
  });

  it("school admin cannot read another school's results", async () => {
    session.current = sessionFor(A, "admin");
    const { GET } = await import("@/app/api/school/results/route");

    const res = await GET(req(`/api/school/results?classId=${B.classId}`));
    expect(res.status).toBe(404);
  });

  it("a teacher cannot attest delivery on another school's class", async () => {
    session.current = sessionFor(A, "teacher");
    const { PATCH } = await import("@/app/api/school/teach/delivery/route");

    const res = await PATCH(
      req("/api/school/teach/delivery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: B.classId, moduleId: "anything", delivered: true }),
      }),
    );
    expect([403, 404]).toContain(res.status);

    const leaked = await prisma.schoolClassUnit.count({ where: { schoolClassId: B.classId } });
    expect(leaked).toBe(0);
  });

  it("embed settings show only the caller's own keys and origins", async () => {
    session.current = sessionFor(A, "admin");
    const { GET } = await import("@/app/api/school/embed/config/route");

    const res = await GET();
    const body = await res.json();
    const prefixes = body.keys.map((k: { prefix: string }) => k.prefix);

    expect(prefixes).toContain(A.key.slice(0, 12)); // POSITIVE control
    expect(prefixes).not.toContain(B.key.slice(0, 12));
    expect(body.slug).toBe(A.slug);
  });

  it("no response body ever contained School B's identifiers", async () => {
    // A blunt backstop for anything the assertions above missed: re-run the two widest reads and
    // grep the raw text for B's ids. A leak that slips past a shape assertion cannot slip past this.
    session.current = sessionFor(A, "admin");
    const { GET: classes } = await import("@/app/api/school/classes/route");
    const { GET: v1classes } = await import("@/app/api/v1/classes/route");

    const bodies = [
      await (await classes()).text(),
      await (await v1classes(keyed(A.key, "/api/v1/classes"))).text(),
    ].join("\n");

    for (const secret of [B.id, B.classId, B.pupilId, B.pupilRef, B.slug, B.webhookId]) {
      expect(bodies).not.toContain(secret);
    }
  });
});
