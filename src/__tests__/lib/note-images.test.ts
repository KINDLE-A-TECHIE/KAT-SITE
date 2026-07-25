import { describe, it, expect, vi, beforeEach } from "vitest";

// Control key derivation and capture deletes without touching real R2. vi.hoisted keeps the mock fn
// available to the hoisted vi.mock factory.
const { deleteR2Object } = vi.hoisted(() => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/r2", () => ({
  r2KeyFromUrl: (url: string) =>
    url.startsWith("https://cdn.example/") ? url.slice("https://cdn.example/".length) : null,
  deleteR2Object,
}));

import { extractNoteImageKeys, deleteRemovedNoteImages } from "@/lib/note-images";

const noteImg = (id: string) => `https://cdn.example/lessons/L1/note-images/${id}.webp`;

beforeEach(() => {
  deleteR2Object.mockReset();
  deleteR2Object.mockResolvedValue(undefined); // it returns a promise the caller .catch()es
});

describe("extractNoteImageKeys", () => {
  it("returns keys for our note images only", () => {
    const html =
      `<p><img src="${noteImg("a")}" alt=""></p>` +
      `<img src='${noteImg("b")}'>`;
    expect(extractNoteImageKeys(html).sort()).toEqual([
      "lessons/L1/note-images/a.webp",
      "lessons/L1/note-images/b.webp",
    ]);
  });

  it("ignores external images and other R2 objects (logos, project assets)", () => {
    const html =
      `<img src="https://other.com/x.png">` +
      `<img src="https://cdn.example/school-logos/s1/y.webp">` +
      `<img src="https://cdn.example/projects/p1/assets/z.png">`;
    expect(extractNoteImageKeys(html)).toEqual([]);
  });

  it("dedupes a repeated image and handles empty/null", () => {
    expect(extractNoteImageKeys(`<img src="${noteImg("a")}"><img src="${noteImg("a")}">`)).toEqual([
      "lessons/L1/note-images/a.webp",
    ]);
    expect(extractNoteImageKeys(null)).toEqual([]);
    expect(extractNoteImageKeys("")).toEqual([]);
  });
});

describe("deleteRemovedNoteImages", () => {
  it("deletes images dropped from the body, keeps the ones still present", async () => {
    const before = `<img src="${noteImg("a")}"><img src="${noteImg("b")}">`;
    const after = `<img src="${noteImg("b")}">`; // a removed, b kept
    await deleteRemovedNoteImages(before, after);
    expect(deleteR2Object).toHaveBeenCalledTimes(1);
    expect(deleteR2Object).toHaveBeenCalledWith("lessons/L1/note-images/a.webp");
  });

  it("deletes all images when the note is deleted (after = null)", async () => {
    const before = `<img src="${noteImg("a")}"><img src="${noteImg("b")}">`;
    await deleteRemovedNoteImages(before, null);
    expect(deleteR2Object).toHaveBeenCalledTimes(2);
  });

  it("deletes nothing when the body is unchanged", async () => {
    const html = `<img src="${noteImg("a")}">`;
    await deleteRemovedNoteImages(html, html);
    expect(deleteR2Object).not.toHaveBeenCalled();
  });

  it("never throws when a delete fails", async () => {
    deleteR2Object.mockRejectedValueOnce(new Error("R2 down"));
    await expect(deleteRemovedNoteImages(`<img src="${noteImg("a")}">`, null)).resolves.toBeUndefined();
  });
});
