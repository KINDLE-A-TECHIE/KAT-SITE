import { describe, it, expect } from "vitest";
import { SchoolLicenseStatus } from "@prisma/client";
import { renderSchoolReportPdf } from "@/lib/school-report-pdf";
import type { SchoolReport } from "@/lib/school-report-data";

/**
 * The server-generated report PDF. @react-pdf/renderer is pure JS (no headless browser), so we can
 * render it in a unit test and assert we get a real PDF back. This guards the render path itself:
 * a bad style, a null field the layout does not tolerate, or a broken import would throw here rather
 * than in production when a school clicks "Download PDF".
 */

const populated: SchoolReport = {
  school: { name: "XT Academy" },
  term: "2025/2026 Term 1",
  scope: "class",
  licence: {
    term: "2025/2026 Term 1",
    status: SchoolLicenseStatus.ACTIVE,
    seatLimit: 50,
    seatsUsed: 12,
  },
  generatedAt: new Date().toISOString(),
  classes: [
    {
      summary: {
        class: { id: "c1", name: "JSS 1 Blue", term: "2025/2026 Term 1", nerdcLevel: "JSS" },
        course: { id: "p1", name: "Coding Basics" },
        studentCount: 2,
        totalLessons: 10,
        terms: [],
        students: [
          {
            userId: "u1",
            firstName: "Ada",
            lastName: "Okoro",
            lessonsCompleted: 5,
            gatesPassed: 1,
            assessmentsTaken: 2,
            avgScorePct: 72,
            lastScorePct: 80,
            modules: [],
          },
          {
            // A pupil who has never been graded: avgScorePct null must not break the layout.
            userId: "u2",
            firstName: "Ben",
            lastName: "Musa",
            lessonsCompleted: 0,
            gatesPassed: 0,
            assessmentsTaken: 0,
            avgScorePct: null,
            lastScorePct: null,
            modules: [],
          },
        ],
      },
      coverage: {
        classId: "c1",
        className: "JSS 1 Blue",
        term: "2025/2026 Term 1",
        course: { id: "p1", name: "Coding Basics", slug: "coding-basics" },
        matchedCrosswalk: true,
        studentCount: 2,
        teachers: [],
        units: [],
        totals: {
          unitsInScheme: 12,
          unitsOnPlatform: 8,
          schemeCoveragePct: 66,
          unitsDelivered: 5,
          unitsFirstHand: 4,
          unitsSuccessor: 1,
          deliveredPct: 62,
          engagementPct: 50,
        },
      },
    },
  ],
};

const isPdf = (buf: Buffer) => buf.length > 0 && buf.subarray(0, 5).toString("latin1") === "%PDF-";

describe("renderSchoolReportPdf", () => {
  it("renders a populated report to a real PDF buffer", async () => {
    const pdf = await renderSchoolReportPdf(populated);
    expect(isPdf(pdf)).toBe(true);
  });

  it("renders an empty report (no classes match the term) without throwing", async () => {
    const empty: SchoolReport = {
      ...populated,
      scope: "school",
      licence: null,
      classes: [],
    };
    const pdf = await renderSchoolReportPdf(empty);
    expect(isPdf(pdf)).toBe(true);
  });

  it("tolerates a class whose course is not a crosswalk match", async () => {
    const noCrosswalk: SchoolReport = {
      ...populated,
      classes: [
        {
          ...populated.classes[0],
          coverage: {
            ...populated.classes[0].coverage,
            matchedCrosswalk: false,
            course: null,
            totals: {
              ...populated.classes[0].coverage.totals,
              unitsInScheme: null,
              schemeCoveragePct: null,
            },
          },
        },
      ],
    };
    const pdf = await renderSchoolReportPdf(noCrosswalk);
    expect(isPdf(pdf)).toBe(true);
  });
});
