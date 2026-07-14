import { describe, it, expect, beforeAll } from "vitest";
import {
  isValidOrigin,
  buildEmbedCookie,
  mintLaunchToken,
  readEmbedSession,
  EMBED_COOKIE,
} from "@/lib/school-embed";

beforeAll(() => {
  process.env.EMBED_TOKEN_SECRET = "x".repeat(48);
});

describe("launch tokens are not session tokens", () => {
  const claims = { schoolId: "school_1", userId: "user_1", purpose: "learn" as const };

  it("a LAUNCH token is rejected as an embed SESSION", async () => {
    // THE core separation. A launch token travels in a URL fragment and is meant to be spent once,
    // in 60 seconds. If it could also be presented as a session cookie, then anyone who captured a
    // launch link would hold a live session, and the single-use guard would protect nothing.
    // The audience claim is what makes these two different credentials.
    const { token } = await mintLaunchToken(claims);
    expect(await readEmbedSession(token)).toBeNull();
  });

  it("a tampered token is rejected", async () => {
    const { token } = await mintLaunchToken(claims);
    const [h, p, s] = token.split(".");
    // Re-sign nothing; just corrupt the signature.
    expect(await readEmbedSession(`${h}.${p}.${s.slice(0, -2)}xy`)).toBeNull();
  });

  it("garbage is rejected without throwing", async () => {
    expect(await readEmbedSession("not-a-jwt")).toBeNull();
    expect(await readEmbedSession(undefined)).toBeNull();
  });
});

describe("isValidOrigin", () => {
  it("accepts an exact https origin", () => {
    expect(isValidOrigin("https://portal.stmarys.edu.ng")).toBe(true);
    expect(isValidOrigin("https://portal.stmarys.edu.ng:8443")).toBe(true);
  });

  it("rejects wildcards", () => {
    // The whole point: a wildcard means any forgotten subdomain, an old WordPress, a student club
    // page, can frame a live, authenticated child session. The OAuth 2.0 Security BCP bans
    // wildcard redirect URIs for exactly this reason.
    expect(isValidOrigin("https://*.stmarys.edu.ng")).toBe(false);
  });

  it("rejects http, a framed session must not travel in clear text", () => {
    expect(isValidOrigin("http://portal.stmarys.edu.ng")).toBe(false);
  });

  it("rejects anything carrying a path, query or fragment", () => {
    expect(isValidOrigin("https://portal.stmarys.edu.ng/lessons")).toBe(false);
    expect(isValidOrigin("https://portal.stmarys.edu.ng?x=1")).toBe(false);
    expect(isValidOrigin("https://portal.stmarys.edu.ng#a")).toBe(false);
  });

  it("rejects junk", () => {
    expect(isValidOrigin("")).toBe(false);
    expect(isValidOrigin("portal.stmarys.edu.ng")).toBe(false);
    expect(isValidOrigin("javascript:alert(1)")).toBe(false);
  });
});

describe("embed cookie", () => {
  const cookie = buildEmbedCookie("token-value", 1800);

  it("carries the attributes a third-party iframe requires", () => {
    // SameSite=None or the browser will not send it in a cross-site frame at all;
    // Secure is mandatory alongside it; Partitioned (CHIPS) survives third-party cookie blocking.
    expect(cookie).toContain("SameSite=None");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Partitioned");
    expect(cookie).toContain("HttpOnly");
  });

  it("is Path=/ so the embed's own API calls actually receive it", () => {
    // Path=/embed would NOT be sent to /api/school/embed/*, so the cookie probe would always fail
    // and every browser would take the Safari fallback.
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Path=/embed");
  });

  it("is a separate cookie from the NextAuth session", () => {
    // The B2C session stays SameSite=Lax. Embedding must not weaken CSRF protection for the
    // consumer product.
    expect(EMBED_COOKIE).toBe("kat_embed_session");
    expect(EMBED_COOKIE).not.toContain("next-auth");
  });
});
