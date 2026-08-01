import { describe, it, expect } from "vitest";
import { allLevels, getLevelById, LEVELS } from "@/lib/network-lab/levels";

/**
 * levels.json is the shipped, converted CS4G Netsim data. If it stops parsing, or a level loses its
 * win condition, the whole lab breaks silently: a level with no trigger can never be won. This pins
 * both, so a bad edit fails the build rather than shipping an unwinnable level.
 */
describe("network-lab levels.json", () => {
  it("parses to a non-empty record of levels", () => {
    const levels = allLevels();
    expect(levels.length).toBeGreaterThan(0);
    expect(Object.keys(LEVELS).length).toBe(levels.length);
  });

  it("gives every level the required shape", () => {
    for (const [key, level] of Object.entries(LEVELS)) {
      expect(typeof level.id, `${key}.id`).toBe("number");
      expect(typeof level.unit, `${key}.unit`).toBe("string");
      expect(Array.isArray(level.devices), `${key}.devices`).toBe(true);
      expect(Array.isArray(level.links), `${key}.links`).toBe(true);
      expect(Array.isArray(level.triggers), `${key}.triggers`).toBe(true);
    }
  });

  it("gives every level at least one trigger (or it could never be won)", () => {
    for (const [key, level] of Object.entries(LEVELS)) {
      expect(level.triggers.length, `${key} has no trigger`).toBeGreaterThan(0);
    }
  });

  it("has unique numeric ids and can look a level up by id", () => {
    const ids = allLevels().map((l) => l.id);
    expect(new Set(ids).size, "duplicate level id").toBe(ids.length);
    expect(getLevelById(1)?.id).toBe(1);
  });
});
