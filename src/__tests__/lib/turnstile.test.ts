import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyTurnstile } from "@/lib/turnstile";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

describe("verifyTurnstile", () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalSecret === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = originalSecret;
    }
  });

  it("returns true without a network call when TURNSTILE_SECRET_KEY is not set (dev bypass)", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await verifyTurnstile("any-token");
    expect(result).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns false immediately when token is null", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await verifyTurnstile(null);
    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns false immediately when token is undefined", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const result = await verifyTurnstile(undefined);
    expect(result).toBe(false);
  });

  it("returns true when Cloudflare responds with success: true", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await verifyTurnstile("valid-token");
    expect(result).toBe(true);
  });

  it("returns false when Cloudflare responds with success: false", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    } as Response);

    const result = await verifyTurnstile("invalid-token");
    expect(result).toBe(false);
  });

  it("returns false when the HTTP response is not ok", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ success: true }),
    } as Response);

    const result = await verifyTurnstile("token");
    expect(result).toBe(false);
  });

  it("returns false when fetch throws a network error", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network failure"));

    const result = await verifyTurnstile("token");
    expect(result).toBe(false);
  });

  it("POSTs to the correct Cloudflare URL", async () => {
    process.env.TURNSTILE_SECRET_KEY = "my-secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await verifyTurnstile("my-token");
    expect(fetchSpy).toHaveBeenCalledWith(
      VERIFY_URL,
      expect.objectContaining({ method: "POST" }),
    );
  });
});
