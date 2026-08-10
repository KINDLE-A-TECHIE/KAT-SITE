import { describe, expect, it } from "vitest";
import { monacoLangFromFilename, detectEntryFile, uint8ToBase64 } from "@/lib/playground-files";

describe("monacoLangFromFilename", () => {
  it("maps known extensions to their Monaco language", () => {
    expect(monacoLangFromFilename("solution.py")).toBe("python");
    expect(monacoLangFromFilename("Main.java")).toBe("java");
    expect(monacoLangFromFilename("app.tsx")).toBe("typescript");
    expect(monacoLangFromFilename("styles.css")).toBe("css");
  });

  it("is case-insensitive on the extension", () => {
    expect(monacoLangFromFilename("SCRIPT.PY")).toBe("python");
    expect(monacoLangFromFilename("Notes.MD")).toBe("markdown");
  });

  it("uses the LAST dotted segment for multi-dot names", () => {
    expect(monacoLangFromFilename("archive.tar.py")).toBe("python");
  });

  it("falls back to plaintext for unknown or extension-less names", () => {
    expect(monacoLangFromFilename("data.xyz")).toBe("plaintext");
    expect(monacoLangFromFilename("Makefile")).toBe("plaintext");
    expect(monacoLangFromFilename("")).toBe("plaintext");
  });
});

describe("detectEntryFile", () => {
  it("returns the first present candidate in priority order", () => {
    expect(detectEntryFile({ "app.py": "", "main.py": "" }, "python")).toBe("main.py");
    expect(detectEntryFile({ "app.py": "" }, "python")).toBe("app.py");
  });

  it("returns null when no candidate is present", () => {
    expect(detectEntryFile({ "helper.py": "" }, "python")).toBeNull();
  });

  it("returns null for an unknown language", () => {
    expect(detectEntryFile({ "main.py": "" }, "brainfuck")).toBeNull();
  });

  it("treats an empty-string file as present (undefined check, not truthiness)", () => {
    expect(detectEntryFile({ "main.py": "" }, "python")).toBe("main.py");
  });
});

describe("uint8ToBase64", () => {
  it("round-trips through atob back to the original bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 65, 66, 67]);
    const b64 = uint8ToBase64(bytes);
    const back = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });

  it("encodes an empty array to an empty string", () => {
    expect(uint8ToBase64(new Uint8Array([]))).toBe("");
  });

  it("handles a payload larger than the 8192-byte chunk without overflowing", () => {
    const big = new Uint8Array(20000).map((_, i) => i % 256);
    const back = Uint8Array.from(atob(uint8ToBase64(big)), (c) => c.charCodeAt(0));
    expect(back.length).toBe(20000);
    expect(back[19999]).toBe(19999 % 256);
  });
});
