import { describe, it, expect } from "vitest";
import { assertSafeWebhookUrl, signWebhook, verifyWebhook } from "@/lib/school-webhook";

/**
 * The SSRF filter is the most dangerous code in the product: a school hands us a URL and our own
 * server POSTs children's data to it. Every case below is a real, published SSRF technique.
 */
describe("assertSafeWebhookUrl", () => {
  it("accepts an ordinary public https endpoint", async () => {
    expect(await assertSafeWebhookUrl("https://example.com/hooks/kat")).toBeNull();
  });

  it("rejects http, pupils' progress must not travel in clear text", async () => {
    expect(await assertSafeWebhookUrl("http://example.com/hook")).toMatch(/https/);
  });

  it("rejects the cloud metadata service", async () => {
    // http://169.254.169.254/latest/meta-data/ is how an SSRF becomes stolen cloud credentials.
    expect(await assertSafeWebhookUrl("https://169.254.169.254/latest/meta-data/")).toMatch(
      /private or internal/,
    );
  });

  it("rejects loopback and private ranges", async () => {
    for (const url of [
      "https://127.0.0.1/hook",
      "https://localhost/hook",
      "https://10.0.0.5/hook",
      "https://192.168.1.10/hook",
      "https://172.16.0.9/hook",
      "https://100.64.0.1/hook", // CGNAT
      "https://0.0.0.0/hook",
    ]) {
      expect(await assertSafeWebhookUrl(url), url).toMatch(/private or internal|does not resolve/);
    }
  });

  it("rejects IPv6 loopback, unique-local and link-local", async () => {
    for (const url of ["https://[::1]/hook", "https://[fd00::1]/hook", "https://[fe80::1]/hook"]) {
      expect(await assertSafeWebhookUrl(url), url).toMatch(/private or internal/);
    }
  });

  /**
   * Every spelling of the cloud metadata service, in one table.
   *
   * This exists because a filter that matched only the DOTTED IPv4-mapped form
   * (`::ffff:169.254.169.254`) let the HEX form (`::ffff:a9fe:a9fe`) straight through, and Node's
   * URL parser hands you the hex one. The bug was invisible on Windows (whose resolver quietly
   * fixed it up) and only surfaced in Linux CI.
   */
  it.each([
    ["plain IPv4", "https://169.254.169.254/latest/meta-data/"],
    ["IPv4-mapped, dotted", "https://[::ffff:169.254.169.254]/"],
    ["IPv4-mapped, hex (what Node actually gives you)", "https://[::ffff:a9fe:a9fe]/"],
    ["IPv4-compatible", "https://[::a9fe:a9fe]/"],
    ["NAT64 prefix", "https://64:ff9b::a9fe:a9fe/"],
  ])("blocks the metadata service via %s", async (_label, url) => {
    expect(await assertSafeWebhookUrl(url), url).not.toBeNull();
  });

  it("rejects an IPv4-mapped IPv6 address pointing at the metadata service", async () => {
    // ::ffff:169.254.169.254 is the classic way past a naive IPv4-only filter.
    expect(await assertSafeWebhookUrl("https://[::ffff:169.254.169.254]/")).toMatch(
      /private or internal/,
    );
  });

  it("rejects junk", async () => {
    expect(await assertSafeWebhookUrl("not a url")).toMatch(/not a valid URL/);
    expect(await assertSafeWebhookUrl("ftp://example.com")).toMatch(/https/);
  });
});

describe("webhook signing (Standard Webhooks)", () => {
  const id = "msg_123";
  const ts = 1_700_000_000;
  const body = JSON.stringify({ type: "lesson.completed" });
  const secret = "whsec_abcdef";

  it("verifies its own signature", () => {
    const sig = signWebhook(id, ts, body, secret);
    expect(verifyWebhook(id, ts, body, secret, sig)).toBe(true);
  });

  it("rejects a tampered body, the whole point", () => {
    const sig = signWebhook(id, ts, body, secret);
    expect(verifyWebhook(id, ts, `${body} `, secret, sig)).toBe(false);
  });

  it("rejects a replayed signature at a different timestamp", () => {
    const sig = signWebhook(id, ts, body, secret);
    expect(verifyWebhook(id, ts + 1, body, secret, sig)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const sig = signWebhook(id, ts, body, secret);
    expect(verifyWebhook(id, ts, body, "whsec_other", sig)).toBe(false);
  });

  it("binds the message id, so one event's signature cannot be reused for another", () => {
    const sig = signWebhook(id, ts, body, secret);
    expect(verifyWebhook("msg_456", ts, body, secret, sig)).toBe(false);
  });
});
