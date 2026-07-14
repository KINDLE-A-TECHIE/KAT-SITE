import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEACTIVATION_THRESHOLD } from "@/lib/roster-sync";

/**
 * The public developer docs must not LIE.
 *
 * `/schools/developers` is the canonical spec a school's IT contractor builds against. It is prose
 * in a .tsx file, so nothing in the type system stops it drifting away from the code the day someone
 * changes a rate limit or renames a scope, and the failure is silent, remote, and lands on somebody
 * else's integration.
 *
 * These assertions pin the claims that an integrator would actually code against. If you change one
 * of these constants, this test fails and reminds you to change the sentence too.
 */

const DOCS = readFileSync(
  path.join(process.cwd(), "src", "components", "marketing", "schools", "developer-docs.tsx"),
  "utf8",
);

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("developer docs match the code", () => {
  it("advertises exactly the scopes that exist", () => {
    const schema = read("prisma/schema.prisma");
    const enumBlock = schema.slice(
      schema.indexOf("enum SchoolApiScope {"),
      schema.indexOf("}", schema.indexOf("enum SchoolApiScope {")),
    );
    const scopes = [...enumBlock.matchAll(/^\s{2}([A-Z_]+)$/gm)].map((m) => m[1]);
    expect(scopes.length).toBeGreaterThanOrEqual(5);

    for (const scope of scopes) {
      expect(DOCS.includes(scope), `docs never mention the ${scope} scope`).toBe(true);
    }
    // And the reverse: the docs must not promise a scope we do not have.
    for (const claimed of [...DOCS.matchAll(/\b([A-Z]+_[A-Z]+)\b/g)].map((m) => m[1])) {
      if (claimed.endsWith("_READ") || claimed.endsWith("_WRITE") || claimed.endsWith("_MINT")) {
        expect(scopes, `docs promise a scope "${claimed}" that does not exist`).toContain(claimed);
      }
    }
  });

  it("quotes the real rate limit", () => {
    const limit = /apiV1Limiter = makeLimiter\((\d+),\s*"1 m"/.exec(read("src/lib/ratelimit.ts"))?.[1];
    expect(limit).toBeTruthy();
    expect(
      DOCS.includes(`${limit} requests per minute`),
      `docs must state the real limit (${limit}/min)`,
    ).toBe(true);
  });

  it("quotes the real launch-token lifetime", () => {
    const ttl = /LAUNCH_TTL_SECONDS = (\d+)/.exec(read("src/lib/school-embed.ts"))?.[1];
    expect(ttl).toBe("60");
    expect(DOCS.includes(`Lives ${ttl} seconds`)).toBe(true);
  });

  it("quotes the real deactivation threshold", () => {
    expect(DEACTIVATION_THRESHOLD).toBe(0.2);
    expect(
      DOCS.includes("20% of a class"),
      "docs must state the real safety-valve threshold",
    ).toBe(true);
  });

  it("quotes the real pagination limits", () => {
    const api = read("src/lib/api-v1.ts");
    const def = /PAGE_DEFAULT = (\d+)/.exec(api)?.[1];
    const max = /PAGE_MAX = (\d+)/.exec(api)?.[1];
    expect(DOCS.includes(`default ${def}, max ${max}`)).toBe(true);
  });

  it("names the webhook headers the receiver must actually read", () => {
    const lib = read("src/lib/school-webhook.ts");
    for (const header of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
      expect(lib.includes(`"${header}"`), `${header} is not sent`).toBe(true);
      expect(DOCS.includes(header), `docs do not tell the integrator about ${header}`).toBe(true);
    }
  });

  it("tells integrators to put the launch token in the FRAGMENT, not a query string", () => {
    // The single most consequential instruction on the page: a token in a query string leaks into
    // access logs, browser history and Referer headers. If this sentence goes, the guidance is gone.
    expect(/after the <Code>#<\/Code>|#t=/.test(DOCS)).toBe(true);
    expect(DOCS.includes("never sent to a server")).toBe(true);
  });

  it("still warns about the things that get people breached", () => {
    for (const warning of [
      "belongs on your server", // key in a web page
      "unverified endpoint",     // unsigned webhooks
      "wildcards",               // framing allow-list
      "raw",                     // raw body for HMAC
    ]) {
      expect(
        DOCS.toLowerCase().includes(warning.toLowerCase()),
        `the docs no longer warn about: ${warning}`,
      ).toBe(true);
    }
  });
});
