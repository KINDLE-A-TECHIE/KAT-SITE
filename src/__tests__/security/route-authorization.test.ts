import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Machine guarantee against privilege escalation (AUDIT §3 / §6.8).
 *
 * `src/middleware.ts` only enforces *authentication* (logged-in vs not).
 * *Authorization* for privileged routes is a per-handler responsibility, one
 * forgotten guard is a privilege-escalation hole. This test converts that human
 * guarantee into a machine one: every exported HTTP handler in a route under a
 * privileged path segment (`admin` / `super-admin` / `instructor`) must contain
 * a recognized authorization guard, unless the route is explicitly allowlisted
 * as authorized by another mechanism (and proven to be so).
 *
 * NOTE ON VOCABULARY: the audit worded this as "must call `ensureRole`", but the
 * codebase authorizes super-admin routes with a local `ensureSuperAdmin()` helper
 * and inline `role !== UserRole.SUPER_ADMIN` checks. The recognized-guard set
 * below reflects the *actual* vocabulary. Any new guard helper must be added here
 * that requirement is itself a useful forcing function. Consolidating on a
 * single `ensureRole` remains a recommended cleanup.
 */

const API_ROOT = path.join(process.cwd(), "src", "app", "api");
// "v1" is the PUBLIC school API. It is privileged (it reads and writes children's records) and it
// is school-scoped, so it must satisfy BOTH rules below, a guard and a schoolId filter.
const PRIVILEGED_SEGMENTS = ["admin", "super-admin", "instructor", "school", "v1"];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/** Segments whose routes are school-scoped and must therefore also prove tenant scoping. */
const SCHOOL_SEGMENT = "school";
const V1_SEGMENT = "v1";

/** Tokens that count as an authorization guard inside a handler body. */
const GUARD_PATTERN = new RegExp(
  [
    "\\bensureRole\\s*\\(",
    "\\bensureSuperAdmin\\s*\\(",
    "\\bensureAdmin\\s*\\(",
    "\\brequireRole\\s*\\(",
    "\\brequireAdmin\\s*\\(",
    "\\bhasAnyRole\\s*\\(",
    "\\bADMIN_ROLES\\.includes\\s*\\(",
    "[!=]==\\s*UserRole\\.(SUPER_ADMIN|ADMIN|INSTRUCTOR)",
    // School (B2B) guards, school-scoped roles live on SchoolMembership, not User.role.
    "\\brequireActiveSchool\\s*\\(",
    "\\bensureSchoolMembership\\s*\\(",
    "\\bensureSchoolStudent\\s*\\(",
    "\\bassertResourceInSchool\\s*\\(",
    // Embed guards. The embed cannot authenticate with a NextAuth session, it renders inside a
    // school's own page, where a SameSite=Lax cookie is never sent. It proves identity two other
    // ways, and both are real guards, not exemptions:
    //   schoolIdForApiKey, the SCHOOL proves itself with a hashed, server-side-only API key
    //   readEmbedSession, the PUPIL proves themselves with a signed, short-lived embed cookie
    //   redeemLaunchToken, spends a single-use signed launch token, re-checking every claim
    "\\bschoolIdForApiKey\\s*\\(",
    "\\breadEmbedSession\\s*\\(",
    "\\bredeemLaunchToken\\s*\\(",
    // The public v1 API. authorizeV1 authenticates a hashed school API key AND checks the required
    // scope AND rate-limits, in one chokepoint, four separate route files each remembering four
    // steps is four chances to forget one, and the thing forgotten guards children's records.
    "\\bauthorizeV1\\s*\\(",
  ].join("|"),
);

/**
 * Deliberately PUBLIC routes, no authentication at all.
 *
 * Kept SEPARATE from the token-authorized allowlist below, because calling a public route
 * "token-authorized" would be a lie told to the one test that exists to catch lies. Each entry is
 * verified to genuinely be safe to expose: it must fail closed and must not read anything a caller
 * could not already see.
 */
const PUBLIC_ALLOWLIST: Record<string, string> = {
  "school/embed/frame-ancestors/route.ts":
    "Public by necessity: middleware runs on the edge and cannot reach Prisma, so it fetches a " +
    "school's CSP frame-ancestors from here. It discloses nothing, the value is emitted as a " +
    "response header on that school's own embed page, so anyone able to load the page can already " +
    "read it. Fails closed to 'none'.",
};

/**
 * Handlers whose tenant scoping is delegated to a library rather than written inline.
 *
 * The school-scope rule below looks for `schoolId` in the handler body. The embed routes scope just
 * as strictly, but inside school-embed.ts (a launch token's schoolId is checked against the slug,
 * and every claim re-read from the DB). Rather than weaken the rule, we name the delegates, and a
 * test below asserts those libraries really do the scoping, so this cannot become a loophole.
 */
const SCHOOL_SCOPE_DELEGATES = ["redeemLaunchToken", "readEmbedSession", "schoolIdForApiKey"];

/**
 * Routes that legitimately authorize WITHOUT a role gate. Each entry is verified
 * below to actually be token-authorized (references `tokenHash`), so this list
 * can't be abused to silently skip a real role check.
 */
const TOKEN_AUTHORIZED_ALLOWLIST: Record<string, string> = {
  "super-admin/admin-invites/accept/route.ts":
    "Invite-acceptance flow: a non-admin redeems a hashed invite token to be granted the role.",
  "super-admin/invites/accept/route.ts":
    "Invite-acceptance flow: redeems a hashed super-admin invite token; no pre-existing role required.",
};

function walkRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkRouteFiles(full));
    else if (entry.name === "route.ts" || entry.name === "route.tsx") out.push(full);
  }
  return out;
}

/** Repo-relative-to-api path with forward slashes, e.g. "super-admin/invites/route.ts". */
function apiRelative(file: string): string {
  return path.relative(API_ROOT, file).split(path.sep).join("/");
}

function isPrivileged(rel: string): boolean {
  return rel.split("/").some((seg) => PRIVILEGED_SEGMENTS.includes(seg));
}

function isSchoolRoute(rel: string): boolean {
  const segs = rel.split("/");
  return segs.includes(SCHOOL_SEGMENT) || segs.includes(V1_SEGMENT);
}

function isV1Route(rel: string): boolean {
  return rel.split("/").includes(V1_SEGMENT);
}

/**
 * A school route must not only authorize, it must SCOPE. Every school-scoped
 * Prisma query has to be filtered by schoolId, derived from the session and never
 * from the request. A handler that touches the DB without a schoolId filter is a
 * cross-tenant (child-data) leak, so we require the token to appear in its body.
 */
const SCHOOL_SCOPE_PATTERN = /\bschoolId\b/;

type Handler = { method: string; body: string };

/** Split a route file into its exported HTTP handler bodies. */
function extractHandlers(source: string): Handler[] {
  const starts: Array<{ method: string; index: number }> = [];
  const patterns = [
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*[:=]/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) starts.push({ method: m[1], index: m.index });
  }
  starts.sort((a, b) => a.index - b.index);
  return starts.map((s, i) => ({
    method: s.method,
    body: source.slice(s.index, i + 1 < starts.length ? starts[i + 1].index : source.length),
  }));
}

const privilegedFiles = walkRouteFiles(API_ROOT).filter((f) => isPrivileged(apiRelative(f)));

describe("privileged API routes enforce authorization", () => {
  it("discovers privileged route files (guards against a broken glob passing vacuously)", () => {
    expect(privilegedFiles.length).toBeGreaterThan(0);
  });

  it("every allowlist entry exists and is genuinely token-authorized (not a role-gate bypass)", () => {
    const relSet = new Set(privilegedFiles.map(apiRelative));
    for (const rel of Object.keys(TOKEN_AUTHORIZED_ALLOWLIST)) {
      expect(relSet.has(rel), `Stale allowlist entry: ${rel} is not a privileged route`).toBe(true);
      const src = readFileSync(path.join(API_ROOT, rel), "utf8");
      expect(
        /tokenHash|hash\w*Token/.test(src),
        `Allowlisted ${rel} does not reference a hashed token, it must not skip role checks`,
      ).toBe(true);
    }
  });

  it.each(privilegedFiles.map((f) => [apiRelative(f), f] as const))(
    "%s guards every exported HTTP handler",
    (rel, file) => {
      if (rel in TOKEN_AUTHORIZED_ALLOWLIST) return; // authorized by token (verified above)
      if (rel in PUBLIC_ALLOWLIST) return; // deliberately public (verified below)

      const source = readFileSync(file, "utf8");
      const handlers = extractHandlers(source);

      // A privileged route.ts with no detectable handlers is itself suspicious.
      expect(handlers.length, `No exported HTTP handler found in ${rel}`).toBeGreaterThan(0);

      const unguarded = handlers
        .filter((h) => HTTP_METHODS.includes(h.method) && !GUARD_PATTERN.test(h.body))
        .map((h) => h.method);

      expect(
        unguarded,
        `${rel}: handler(s) ${unguarded.join(", ")} have no authorization guard. ` +
          "Add ensureRole/ensureSuperAdmin (or a role check), or allowlist with justification.",
      ).toEqual([]);
    },
  );
});

// ── School (B2B) tenant scoping ────────────────────────────────────────────────

const schoolFiles = privilegedFiles.filter((f) => isSchoolRoute(apiRelative(f)));

describe("school API routes are tenant-scoped", () => {
  it("recognizes the school segment as privileged (guards against a silent gap)", () => {
    expect(PRIVILEGED_SEGMENTS).toContain(SCHOOL_SEGMENT);
  });

  it.each(schoolFiles.map((f) => [apiRelative(f), f] as const))(
    "%s scopes every handler by schoolId",
    (rel, file) => {
      if (rel in PUBLIC_ALLOWLIST) return; // public: no tenant data to scope (verified below)

      const source = readFileSync(file, "utf8");
      const handlers = extractHandlers(source);

      expect(handlers.length, `No exported HTTP handler found in ${rel}`).toBeGreaterThan(0);

      const scoped = (body: string) =>
        SCHOOL_SCOPE_PATTERN.test(body) ||
        // Built from a plain string, NOT a template literal: inside a template literal `\b` is a
        // BACKSPACE character, not a word boundary, so the first version of this line silently
        // matched nothing and the rule passed vacuously.
        SCHOOL_SCOPE_DELEGATES.some((d) => new RegExp("\\b" + d + "\\s*\\(").test(body));

      const unscoped = handlers
        .filter((h) => HTTP_METHODS.includes(h.method) && !scoped(h.body))
        .map((h) => h.method);

      expect(
        unscoped,
        `${rel}: handler(s) ${unscoped.join(", ")} never reference schoolId. ` +
          "Every school-scoped query must filter by a session-derived schoolId. " +
          "a missing filter is a cross-tenant data leak.",
      ).toEqual([]);
    },
  );

  it("no school route accepts schoolId from the request body/query", () => {
    for (const file of schoolFiles) {
      const source = readFileSync(file, "utf8");
      const rel = apiRelative(file);
      // schoolId must be derived from the session, never read off the request.
      expect(
        /searchParams\.get\(\s*["'`]schoolId["'`]\s*\)/.test(source),
        `${rel} reads schoolId from the query string, derive it from the session instead.`,
      ).toBe(false);
      expect(
        /\bbody\.schoolId\b|\bparsed\.data\.schoolId\b/.test(source),
        `${rel} reads schoolId from the request body, derive it from the session instead.`,
      ).toBe(false);
    }
  });
});

/*
 * THE B2C MIRROR.
 *
 * The school side has had scope discipline from the start (above). The B2C side had none: it relied
 * on an IMPLICIT tenant. "everything that isn't a school", that no query actually filtered on.
 * That is how a school admin came to hold INSTRUCTOR and could message any child in the
 * organization, and how a KAT instructor could read a school's pupils' submissions.
 *
 * These are source-level rules on purpose. A runtime test only covers the routes someone remembered
 * to write a test for; these fail the build for a route nobody thought about.
 */
const ALL_ROUTE_FILES = walkRouteFiles(API_ROOT);

/** Source with comments removed, so a rule can never match its own explanation of itself. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("school accounts hold no B2C capability", () => {
  const provisioningFiles = ALL_ROUTE_FILES.filter((f) => {
    const rel = apiRelative(f);
    return (
      rel.includes("schools/provision") ||
      rel.includes("school/roster/import") ||
      // The teacher-invite endpoint also creates a school account (SCHOOL_STAFF + TEACHER
      // membership); it must never grant a B2C role either.
      rel.includes("school/teachers")
    );
  });

  it("finds the account-provisioning routes (guards against a vacuous pass)", () => {
    expect(provisioningFiles.length).toBeGreaterThanOrEqual(3);
  });

  it.each(provisioningFiles.map((f) => [apiRelative(f), f] as const))(
    "%s never grants a B2C role to a school account",
    (rel, file) => {
      // Comments stripped: these routes explain in prose WHY they no longer grant INSTRUCTOR, and a
      // rule must never trip over its own explanation.
      const source = stripComments(readFileSync(file, "utf8"));

      const granted = [...source.matchAll(/\brole:\s*UserRole\.([A-Z_]+)/g)].map((m) => m[1]);
      const forbidden = granted.filter((r) =>
        ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR", "FELLOW", "STUDENT"].includes(r),
      );

      expect(
        forbidden,
        `${rel} grants the B2C role(s) ${forbidden.join(", ")} to a school account. ` +
          "School authority comes from SchoolMembership; the global role must grant nothing " +
          "(SCHOOL_STAFF) or only enrollment-gated learning (SCHOOL_STUDENT). INSTRUCTOR, for " +
          "instance, can message any student in the organization and read their submissions.",
      ).toEqual([]);
    },
  );
});

describe("B2C queries are tenant-scoped", () => {
  it("no route uses the fail-open `organizationId: x ?? undefined` idiom", () => {
    /*
     * A FLAT BAN, not "ban it only inside a where clause".
     *
     * My first attempt tried to tell a WHERE apart from CREATE data by looking backwards for the
     * nearest keyword. It produced two false positives immediately, including one on its own
     * explanatory comment. A rule that needs to guess intent is a rule that will guess wrong at
     * 2am, and the failure mode here is a silent cross-tenant read.
     *
     * Every organizationId column involved is nullable, so `create` sites can simply pass the
     * value through. That leaves the idiom with no legitimate use, and the rule with nothing to
     * infer.
     */
    const offenders = ALL_ROUTE_FILES.filter((file) =>
      /organizationId:[^,\n]*\?\?\s*undefined/.test(stripComments(readFileSync(file, "utf8"))),
    ).map(apiRelative);

    expect(
      offenders,
      "`organizationId: x ?? undefined` FAILS OPEN in a where clause. Prisma treats `undefined` " +
        "as 'no condition', so a caller with no organization matches every row in every " +
        "organization. Use orgScope() from src/lib/tenant.ts (fails closed); in create data, pass " +
        "the nullable value directly.",
    ).toEqual([]);
  });

  it("the B2C people-directory excludes school accounts", () => {
    for (const rel of ["messages/contacts/route.ts", "users/route.ts"]) {
      const source = stripComments(readFileSync(path.join(API_ROOT, rel), "utf8"));
      // Must match the SPREAD (`...b2cUserScope`) inside the query, not the bare identifier, the
      // import line alone contains the name, and an earlier version of this rule passed happily
      // against a route that imported the scope and then never applied it.
      expect(
        /\.\.\.b2cUserScope|notIn:\s*SCHOOL_ROLES/.test(source),
        `${rel} enumerates users without excluding school accounts, a school's children would ` +
          "appear in a KAT instructor's contact picker.",
      ).toBe(true);
    }
  });

  it("B2C assessment reads are scoped to B2C-audience programs", () => {
    for (const rel of ["assessments/route.ts", "assessments/submissions/route.ts"]) {
      const source = readFileSync(path.join(API_ROOT, rel), "utf8");
      expect(
        /audience:\s*CourseAudience\.B2C/.test(source),
        `${rel} reads assessments without scoping to audience B2C, a KAT instructor would see a ` +
          "school's pupils' work. School submissions are served by /api/school/results, scoped by schoolId.",
      ).toBe(true);
    }
  });

  /*
   * The rule above was written for the assessments routes, and the very next bug was one file to
   * the left: challenges attached a B2C feature to any programme, then notified every ACTIVE
   * enrollment on it, school children included, with a link to /dashboard/challenges, a surface
   * they cannot open. Fixing the instance and leaving the class is how it comes back.
   */
  it("B2C challenge writes refuse SCHOOL-audience programs", () => {
    for (const rel of ["challenges/route.ts", "challenges/[challengeId]/route.ts"]) {
      const source = stripComments(readFileSync(path.join(API_ROOT, rel), "utf8"));
      expect(
        /checkChallengeProgram\s*\(/.test(source),
        `${rel} attaches or publishes a challenge without checking the programme's audience. ` +
          "a challenge on a SCHOOL programme notifies that school's children about a B2C surface " +
          "they cannot reach.",
      ).toBe(true);
    }
  });

  /*
   * The embed is the least-trusted surface we have: it runs inside someone else's page, entered by
   * a bearer token. These are the invariants that make that safe, expressed as build failures.
   */
  /*
   * The public v1 API is the highest-blast-radius surface in the product: a key that can create
   * child accounts, handed to a school's IT contractor, pasted into a repository. These rules are
   * the ones I most expect a future change to quietly break.
   */
  const v1Files = walkRouteFiles(API_ROOT).filter((f) => isV1Route(apiRelative(f)));

  it("finds the v1 routes (guards against a vacuous pass)", () => {
    expect(v1Files.length).toBeGreaterThanOrEqual(4);
  });

  it.each(v1Files.map((f) => [apiRelative(f), f] as const))(
    "%s derives schoolId from the KEY, never from the request",
    (rel, file) => {
      const source = stripComments(readFileSync(file, "utf8"));

      // Every handler must go through the one chokepoint.
      expect(/authorizeV1\s*\(/.test(source), `${rel} does not call authorizeV1`).toBe(true);

      // And it must name a scope, authorizeV1's second argument. A key that can read reports must
      // not also be able to create children.
      expect(
        /authorizeV1\([^)]*SchoolApiScope\.[A-Z_]+/.test(source),
        `${rel} calls authorizeV1 without naming a SchoolApiScope.`,
      ).toBe(true);

      // A schoolId taken from the request is a cross-school breach.
      expect(
        /searchParams\.get\(\s*["'`]school(Id|_id)["'`]\s*\)|parsed\.data\.schoolId|body\.schoolId/.test(
          source,
        ),
        `${rel} reads a schoolId from the request. It must come from the API key.`,
      ).toBe(false);
    },
  );

  it("no v1 route accepts a child's name or email in a query string", () => {
    for (const file of v1Files) {
      const source = stripComments(readFileSync(file, "utf8"));
      const rel = apiRelative(file);

      // Opaque refs in a path are fine (`/v1/customers/cus_123` is every REST API on earth). A NAME
      // or an EMAIL in a URL is not: it lands in access logs, browser history and referrers, and
      // it makes the endpoint an enumeration oracle for the school's roll.
      for (const bad of ["name", "email", "firstName", "lastName", "guardian_email"]) {
        expect(
          new RegExp(`searchParams\\.get\\(\\s*["'\`]${bad}["'\`]`, "i").test(source),
          `${rel} reads "${bad}" from the query string. Children's identifiers must travel in the ` +
            "body, or as the school's opaque student_id in the path.",
        ).toBe(false);
      }
    }
  });

  it("there is exactly ONE code path that creates a school's children", () => {
    // The CSV importer and the v1 roster endpoint must both go through roster-sync.ts. Two paths
    // that create child accounts would eventually disagree about seat limits or the SCHOOL_STUDENT
    // role, and the one that drifted would be the one nobody tested.
    const csv = stripComments(
      readFileSync(path.join(API_ROOT, "school/roster/import/route.ts"), "utf8"),
    );
    const v1 = stripComments(readFileSync(path.join(API_ROOT, "v1/roster/route.ts"), "utf8"));

    for (const [label, src] of [["CSV import", csv], ["v1 roster", v1]] as const) {
      expect(/\bsyncRoster\s*\(/.test(src), `${label} does not call syncRoster()`).toBe(true);
      expect(
        /user\.createMany|user\.create\s*\(/.test(src),
        `${label} creates user accounts directly instead of going through roster-sync.ts.`,
      ).toBe(false);
    }
  });

  it("the webhook URL is SSRF-filtered on the resolved IP, not the hostname string", () => {
    const lib = readFileSync(path.join(process.cwd(), "src", "lib", "school-webhook.ts"), "utf8");

    // A blocklist of hostnames is trivially defeated: evil.com with an A record pointing at
    // 169.254.169.254 looks public, and the packet goes to the cloud metadata service.
    expect(/lookup\(/.test(lib), "webhook URLs must be checked against the RESOLVED IP").toBe(true);
    expect(/169\s*&&|169\)|169/.test(lib)).toBe(true); // link-local / metadata range is handled
    expect(/redirect:\s*"manual"/.test(lib), "a redirect could bounce us to an internal URL").toBe(
      true,
    );
    expect(/protocol !== "https:"/.test(lib)).toBe(true);
  });

  it("every cron route is actually SCHEDULED in vercel.json", () => {
    /*
     * An unscheduled cron route is invisible: it compiles, it type-checks, it passes every other
     * test, and it never runs. /api/cron/webhook-drain shipped exactly like that, the outbox would
     * have filled up in production and no school would ever have received a webhook, with nothing
     * failing anywhere to say so.
     *
     * A route that exists but never fires is worse than one that does not exist, because you
     * believe you have the feature.
     */
    const cronDir = path.join(API_ROOT, "cron");
    const routes = readdirSync(cronDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `/api/cron/${e.name}`);

    const vercel = JSON.parse(
      readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
    ) as { crons?: Array<{ path: string; schedule: string }> };
    const scheduled = new Set((vercel.crons ?? []).map((c) => c.path));

    // db-ping is a manual health probe, not a scheduled job.
    const mustBeScheduled = routes.filter((r) => r !== "/api/cron/db-ping");
    const unscheduled = mustBeScheduled.filter((r) => !scheduled.has(r));

    expect(
      unscheduled,
      `Cron route(s) ${unscheduled.join(", ")} exist in code but are not scheduled in vercel.json. ` +
        "They will never run in production.",
    ).toEqual([]);
  });

  it("the webhook drain never reads the response body, the SSRF stays BLIND", () => {
    const lib = readFileSync(path.join(process.cwd(), "src", "lib", "school-webhook.ts"), "utf8");

    /*
     * This is what keeps a residual SSRF from becoming a data breach.
     *
     * We check the webhook URL against its RESOLVED IP, but a determined attacker can still rebind
     * DNS between the check and the fetch (Node's fetch will not let us pin the resolved address
     * into the connection). What saves us is that we never READ what the far end returns: we record
     * `HTTP <status>` and nothing else. So the worst case is a BLIND, POST-only, status-code oracle
     * not an exfiltration channel for cloud credentials.
     *
     * The day someone adds `await res.text()` "to improve the error message", blind becomes full.
     */
    const drain = lib.slice(lib.indexOf("export async function drainWebhooks"));
    expect(
      /res\.(text|json|arrayBuffer|blob|body)\s*\(/.test(drain),
      "drainWebhooks() reads the webhook response body. It must record the STATUS only, reading " +
        "the body turns a blind SSRF into an exfiltration channel for whatever the far end returns.",
    ).toBe(false);
  });

  it("the v1 API fails CLOSED when no rate limiter is configured in production", () => {
    const lib = readFileSync(path.join(process.cwd(), "src", "lib", "api-v1.ts"), "utf8");
    // makeLimiter() returns null when UPSTASH_* is unset, and every other route then silently skips
    // rate limiting. On a public API whose ROSTER_WRITE scope creates child accounts, a missing env
    // var must not quietly remove the only brake.
    expect(
      /!apiV1Limiter\s*&&[\s\S]{0,80}production/.test(lib),
      "api-v1.ts must refuse to serve in production when apiV1Limiter is null.",
    ).toBe(true);
  });

  it("the scope delegates really do scope, and the public route really is safe", () => {
    // An exemption is only honest if the thing it points at does the work. Verify, don't assume.
    const embedLib = readFileSync(path.join(process.cwd(), "src", "lib", "school-embed.ts"), "utf8");

    // redeemLaunchToken must bind the token's school to the slug in the URL..
    expect(
      /school\.id\s*!==\s*claims\.schoolId/.test(embedLib),
      "redeemLaunchToken must reject a token whose schoolId does not match the slug it was " +
        "redeemed at, or a token for school A could be replayed inside school B's page.",
    ).toBe(true);

    // ...and it must re-read the pupil's enrollment rather than trust the token's claims.
    expect(/enrollment\.findFirst/.test(embedLib)).toBe(true);

    const keyLib = readFileSync(path.join(process.cwd(), "src", "lib", "school-api-key.ts"), "utf8");
    expect(/hashedKey/.test(keyLib) && /timingSafeEqual/.test(keyLib)).toBe(true);

    // The public route must fail CLOSED. A framing allow-list whose failure mode is "allow" is
    // worse than no allow-list at all.
    const publicRoute = readFileSync(
      path.join(API_ROOT, "school/embed/frame-ancestors/route.ts"),
      "utf8",
    );
    expect(publicRoute.includes(`"'none'"`)).toBe(true);
    expect(Object.keys(PUBLIC_ALLOWLIST)).toContain("school/embed/frame-ancestors/route.ts");
  });

  it("the embed mint endpoint takes an opaque ref, never a name or an email", () => {
    const source = stripComments(
      readFileSync(path.join(API_ROOT, "school/embed/token/route.ts"), "utf8"),
    );
    // A mint endpoint that accepts an email is an enumeration oracle: feed it guesses, learn which
    // children attend the school. The handle must be the school's own opaque externalRef.
    expect(/externalRef/.test(source)).toBe(true);
    expect(
      /email|firstName|lastName|\bname\b/i.test(source),
      "The embed mint endpoint references a name or email. It must address a pupil ONLY by the " +
        "school's opaque externalRef, or it becomes an enumeration oracle for the school's roll.",
    ).toBe(false);
  });

  it("the embed mint endpoint derives schoolId from the API key, not the request", () => {
    const source = stripComments(
      readFileSync(path.join(API_ROOT, "school/embed/token/route.ts"), "utf8"),
    );
    expect(/schoolIdForApiKey/.test(source)).toBe(true);
    expect(
      /parsed\.data\.schoolId|body\.schoolId/.test(source),
      "The mint endpoint reads schoolId from the request. Any school with a valid key could then " +
        "mint a session for a child at another school.",
    ).toBe(false);
  });

  it("the embed session cookie is None+Secure+Partitioned and is not the NextAuth cookie", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "lib", "school-embed.ts"),
      "utf8",
    );
    for (const attr of ["SameSite=None", "Secure", "Partitioned", "HttpOnly"]) {
      expect(source.includes(attr), `embed cookie is missing ${attr}`).toBe(true);
    }
  });

  it("X-Frame-Options is not applied to /embed (it cannot express an allow-list)", () => {
    const config = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(
      /X-Frame-Options/.test(config) && /\(\?!embed/.test(config),
      "X-Frame-Options must be excluded for /embed. XFO takes no origin list (ALLOW-FROM is dead), " +
        "so a per-school allow-list is impossible with it. CSP frame-ancestors does the job instead.",
    ).toBe(true);
  });

  it("learner-notification fan-out excludes school enrollments", () => {
    const source = stripComments(readFileSync(path.join(process.cwd(), "src", "lib", "challenges.ts"), "utf8"));
    const enrollmentQueries = source.match(/enrollment[s]?:?\s*\{[^}]*status:\s*"ACTIVE"[^}]*\}/gi) ?? [];

    expect(enrollmentQueries.length, "expected the recipient queries to be found").toBeGreaterThan(0);
    for (const q of enrollmentQueries) {
      expect(
        /schoolId:\s*null/.test(q),
        "A challenge-notification recipient query selects ACTIVE enrollments without `schoolId: null`. " +
          "Enrollment.schoolId is how a school child is enrolled, so an unscoped fan-out writes a " +
          "notification to every pupil of every school on that programme.",
      ).toBe(true);
    }
  });
});
