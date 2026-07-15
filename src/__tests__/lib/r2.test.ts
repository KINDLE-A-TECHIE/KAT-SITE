import { describe, it, expect, vi } from "vitest";

// Mock the AWS SDK before the r2 module is imported so the S3Client
// constructor does not attempt a real network call.
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = vi.fn();
  },
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.url/key"),
}));

import { r2PublicUrl, r2KeyFromUrl, R2_PUBLIC_URL } from "@/lib/r2";

// The setup file sets R2_PUBLIC_URL = "https://cdn.example.com"

describe("r2PublicUrl", () => {
  it("prepends the public base URL to a key", () => {
    expect(r2PublicUrl("projects/abc/file.pdf")).toBe(
      "https://cdn.example.com/projects/abc/file.pdf",
    );
  });

  it("does not double-slash when key starts without a slash", () => {
    const url = r2PublicUrl("avatars/user.png");
    expect(url).not.toContain("//avatars");
  });
});

describe("r2KeyFromUrl", () => {
  it("extracts the key from a valid R2 public URL", () => {
    const key = r2KeyFromUrl("https://cdn.example.com/projects/abc/file.pdf");
    expect(key).toBe("projects/abc/file.pdf");
  });

  it("returns null for a URL on a different domain", () => {
    expect(r2KeyFromUrl("https://other.cdn.com/projects/abc/file.pdf")).toBeNull();
  });

  it("returns null for an arbitrary non-R2 URL", () => {
    expect(r2KeyFromUrl("https://example.com/some/path")).toBeNull();
  });

  it("handles deeply nested keys", () => {
    const key = r2KeyFromUrl("https://cdn.example.com/a/b/c/d/e.txt");
    expect(key).toBe("a/b/c/d/e.txt");
  });
});

describe("R2_PUBLIC_URL export", () => {
  it("equals the configured env var (trailing slash stripped)", () => {
    expect(R2_PUBLIC_URL).toBe("https://cdn.example.com");
  });
});
