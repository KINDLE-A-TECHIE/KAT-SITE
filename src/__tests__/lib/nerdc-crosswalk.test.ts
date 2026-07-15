import { describe, it, expect } from "vitest";
import {
  NERDC_COURSES,
  NERDC_LEVEL_INFO,
  codingSpine,
  coursesForLevel,
  strandsForLevel,
} from "@/lib/nerdc-crosswalk";

describe("NERDC crosswalk data", () => {
  it("has a unique slug per course", () => {
    const slugs = NERDC_COURSES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers every NERDC level", () => {
    for (const info of NERDC_LEVEL_INFO) {
      expect(coursesForLevel(info.level).length).toBeGreaterThan(0);
    }
  });

  it("numbers units contiguously from 1 within each course", () => {
    for (const course of NERDC_COURSES) {
      const orders = course.units.map((u) => u.order);
      expect(orders, `${course.slug}`).toEqual(orders.map((_, i) => i + 1));
    }
  });

  it("gives every unit at least one topic", () => {
    for (const course of NERDC_COURSES) {
      for (const unit of course.units) {
        expect(unit.topics.length, `${course.slug} ${unit.label}`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * The coding spine is the product's whole differentiator (crosswalk §7). If an
   * edit ever drops one of these from CODING, this test fails loudly rather than
   * silently downgrading a unit to slides.
   */
  it("keeps the coding spine intact", () => {
    expect(codingSpine()).toEqual([
      { course: "Primary 5", unit: "Term 3" },
      { course: "Primary 6", unit: "Term 2" },
      { course: "JSS 3", unit: "Term 2" },
      { course: "SS 1", unit: "Term 2" }, // Python
      { course: "SS 1", unit: "Term 3" }, // Python logic
      { course: "SS 2", unit: "Term 2" }, // Web
      { course: "SS 2", unit: "Term 3" }, // SQL
      { course: "SS 3", unit: "Term 2" }, // AI / robotics logic
    ]);
  });

  it("gives every CODING unit a playground language, and no DIGLIT unit one", () => {
    for (const course of NERDC_COURSES) {
      for (const unit of course.units) {
        if (unit.strand === "CODING") {
          expect(unit.playgroundLanguage, `${course.slug} ${unit.label}`).toBeTruthy();
        } else {
          expect(unit.playgroundLanguage, `${course.slug} ${unit.label}`).toBeUndefined();
        }
      }
    }
  });

  it("has no coding before Primary 5 (coding enters at P5-T3)", () => {
    const early = NERDC_COURSES.filter((c) =>
      ["nerdc-primary-1-3-ict", "nerdc-primary-4"].includes(c.slug),
    );
    for (const course of early) {
      for (const unit of course.units) {
        expect(unit.strand, `${course.slug} ${unit.label}`).toBe("DIGLIT");
      }
    }
  });

  it("derives strands per level for the /schools table", () => {
    expect(strandsForLevel("PRIMARY_1_3")).toEqual(["DIGLIT"]);
    expect(strandsForLevel("PRIMARY_4_6")).toEqual(["CODING", "DIGLIT"]);
    expect(strandsForLevel("JSS")).toEqual(["CODING", "DIGLIT"]);
    expect(strandsForLevel("SSS")).toEqual(["CODING", "DIGLIT"]);
  });

  it("marks SSS as the compulsory core subject", () => {
    const sss = NERDC_LEVEL_INFO.find((l) => l.level === "SSS");
    expect(sss?.badge).toBe("Compulsory core");
  });
});
