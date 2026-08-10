/**
 * KAT for Schools, marketing content.
 *
 * The coverage table is DERIVED from src/lib/nerdc-crosswalk.ts, the same data
 * that seeds the actual SCHOOL courses. That is deliberate: the marketing claim and
 * the curriculum a school really receives cannot drift apart, because they are one
 * source. Editing a scheme there updates both.
 *
 * This is the PUBLIC, coverage-only view: it omits the internal build backlog
 * (have/adapt/build/curate), per the crosswalk doc. "the marketing table shows
 * 'covered' while the internal view shows the build backlog".
 *
 * POSITIONING: KAT is a teaching PLATFORM for the curriculum's coding and digital-literacy
 * topics, not an accreditation or an exam board. Copy here follows a published curriculum; it
 * never claims KAT makes a school "compliant" or is endorsed by any agency.
 */
import { NERDC_LEVEL_INFO, strandsForLevel } from "@/lib/nerdc-crosswalk";

export type Strand = "coding" | "diglit";

export type CrosswalkRow = {
  /** e.g. "Primary 1–3" */
  level: string;
  /** The curriculum's subject name at this level */
  subject: string;
  /** The subject's standing in the curriculum (a fact about the curriculum, not about KAT) */
  badge: "Embedded strand" | "Core subject" | "Compulsory core";
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

/** Short, checkable points under the hero. Platform + curriculum-coverage, never accreditation. */
export const CURRICULUM_POINTS: string[] = [
  "Covers the coding and digital-literacy topics in the national (NERDC) curriculum, Primary 1 to SS3.",
  "Runs on the everyday devices you already have, a low-cost laptop or a phone, on a basic connection.",
  "Your own teachers deliver it. No coding specialist to hire, no lab to build.",
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
      "Tell us your school, the levels you teach and how many students. We line your classes up with what each level should be learning and confirm a term to trial.",
  },
  {
    step: "02",
    title: "Onboard your teachers",
    description:
      "Your own teachers get the curriculum-in-a-box: lesson plans, slides and worksheets for the digital-literacy strand, and the live platform for the coding strand. No specialist to hire, and it runs on the computers you already have.",
  },
  {
    step: "03",
    title: "Run a term, see the evidence",
    description:
      "Students learn and build; you get progress tracking, auto-graded assessments and capstone project reviews in one place. Review the results, then license per seat, per term.",
  },
];
