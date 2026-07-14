/**
 * KAT for Schools, marketing content.
 *
 * The compliance table is DERIVED from src/lib/nerdc-crosswalk.ts, the same data
 * that seeds the actual SCHOOL courses. That is deliberate: the marketing claim and
 * the curriculum a school really receives cannot drift apart, because they are one
 * source. Editing a scheme there updates both.
 *
 * This is the PUBLIC, coverage-only view: it omits the internal build backlog
 * (have/adapt/build/curate), per the crosswalk doc. "the marketing table shows
 * 'covered' while the internal view shows the build backlog".
 */
import { NERDC_LEVEL_INFO, strandsForLevel } from "@/lib/nerdc-crosswalk";

export type Strand = "coding" | "diglit";

export type CrosswalkRow = {
  /** e.g. "Primary 1–3" */
  level: string;
  /** NERDC subject name at this level */
  subject: string;
  /** How this level reads in the compliance table */
  badge: "Compliant" | "Compulsory core";
  /** Which strands this level touches (drives the legend dots) */
  strands: Strand[];
  /** Public, coverage-only description of what KAT delivers */
  covers: string;
  /** SSS is the headline row, compulsory core through senior secondary */
  emphasize?: boolean;
};

/**
 * P1–3 / P4–6 / JSS / SSS → what KAT covers.
 * Derived from the seeded curriculum, not restated alongside it.
 */
export const CROSSWALK: CrosswalkRow[] = NERDC_LEVEL_INFO.map((info) => ({
  level: info.label,
  subject: info.subject,
  badge: info.badge,
  // Strand dots come from the units that actually exist in the seeded courses,
  // so a level can never advertise a coding strand it does not teach.
  strands: strandsForLevel(info.level).map((s) => (s === "CODING" ? "coding" : "diglit") as Strand),
  covers: info.covers,
  emphasize: info.badge === "Compulsory core",
}));

export const STRAND_LABELS: Record<Strand, string> = {
  coding: "Coding spine",
  diglit: "Digital literacy",
};

/** Short, checkable claims under the hero, every one is grounded in the crosswalk. */
export const COMPLIANCE_POINTS: string[] = [
  "Digital Technologies is a compulsory core subject through SSS, not an elective.",
  "Compliant from Primary 1 to SS3, delivered by your own teachers.",
  "Project-based assessment maps onto the SBA capstones at P6, JSS3 (BECE) and SS3 (WASSCE/NECO).",
];

export type PilotStep = {
  step: string;
  title: string;
  description: string;
};

export const PILOT_STEPS: PilotStep[] = [
  {
    step: "01",
    title: "Request a pilot",
    description:
      "Tell us your school, the levels you teach and how many students. We map your classes onto the NERDC crosswalk and confirm a term to trial.",
  },
  {
    step: "02",
    title: "Onboard your teachers",
    description:
      "Your own teachers get the curriculum-in-a-box: lesson plans, slides and worksheets for the digital-literacy strand, and the live platform for the coding strand. No specialist hire, no lab to build.",
  },
  {
    step: "03",
    title: "Run a term, see the evidence",
    description:
      "Students learn and build; you get progress tracking, auto-graded assessments and capstone project reviews in one place. Review the results, then license per seat, per term.",
  },
];
