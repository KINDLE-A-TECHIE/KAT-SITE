import { z } from "zod";
import {
  ASSESSMENT_TYPES,
  LESSON_CONTENT_TYPES,
  PAYMENT_PROVIDERS,
  PROFILE_VISIBILITIES,
  QUESTION_TYPES,
  USER_ROLES,
} from "./enums";

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
});

/** School pupil sign-in by class code + PIN (Option B). pupilRef is the pupil's opaque enrollment id. */
export const studentPinLoginSchema = z.object({
  classCode: z.string().trim().min(4).max(16),
  pupilRef: z.string().trim().min(1).max(64),
  pin: z.string().regex(/^\d{4,8}$/),
});

/**
 * Public partner / school-pilot enquiry intake (POST /api/partners). A school pilot lead is a
 * PartnerInquiry with type = SCHOOL (see SCHOOL-BUILD-NOTES.md), not a separate model. `state`
 * and `estimatedStudents` are the pilot-specific fields; both optional (corporate/government
 * leads omit them). `programs` carries the NERDC levels the admin inbox expects.
 */
export const partnerInquiryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(160),
  type: z.enum(["SCHOOL", "CORPORATE", "GOVERNMENT", "OTHER"]),
  email: z.string().trim().email().toLowerCase().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  estimatedStudents: z.coerce.number().int().positive().max(1_000_000).optional(),
  message: z.string().trim().min(1).max(4000),
  programs: z.array(z.string().max(60)).max(20).optional(),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z
    .string()
    .min(8)
    .max(100)
    .regex(/[A-Z]/, "Password must include an uppercase character.")
    .regex(/[a-z]/, "Password must include a lowercase character.")
    .regex(/[0-9]/, "Password must include a number."),
  role: z.enum(USER_ROLES),
});

export const superAdminInviteCreateSchema = z.object({
  email: z.string().email().toLowerCase(),
  expiresInHours: z.number().int().min(1).max(168).default(24),
  note: z.string().trim().max(1000).optional(),
});

export const superAdminInviteAcceptSchema = z.object({
  token: z.string().trim().min(32).max(512),
  email: z.string().email().toLowerCase(),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  password: z
    .string()
    .min(8)
    .max(100)
    .regex(/[A-Z]/, "Password must include an uppercase character.")
    .regex(/[a-z]/, "Password must include a lowercase character.")
    .regex(/[0-9]/, "Password must include a number."),
});

export const superAdminInviteValidateSchema = z.object({
  token: z.string().trim().min(32).max(512),
});

export const adminInviteCreateSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(["ADMIN", "INSTRUCTOR"]).default("ADMIN"),
  expiresInHours: z.number().int().min(1).max(168).default(24),
});

export const adminInviteAcceptSchema = z.object({
  token: z.string().trim().min(32).max(512),
  email: z.string().email().toLowerCase(),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  password: z
    .string()
    .min(8)
    .max(100)
    .regex(/[A-Z]/, "Password must include an uppercase character.")
    .regex(/[a-z]/, "Password must include a lowercase character.")
    .regex(/[0-9]/, "Password must include a number."),
});

export const adminInviteValidateSchema = z.object({
  token: z.string().trim().min(32).max(512),
});

export const adminAccountUpdateSchema = z
  .object({
    adminId: z.string().cuid(),
    action: z.enum(["hold", "activate", "enable-retakes", "disable-retakes", "set-permissions"]),
    // For action "set-permissions": the exact capability-area keys to grant (see src/lib/capabilities.ts).
    // Unknown keys are dropped server-side; an empty array means "no areas".
    permissions: z.array(z.string().max(64)).max(50).optional(),
  })
  .refine((d) => d.action !== "set-permissions" || Array.isArray(d.permissions), {
    message: "permissions[] is required when action is set-permissions.",
  });

export const retakeGrantSchema = z.object({
  assessmentId: z.string().cuid(),
  studentId: z.string().cuid(),
});

export const adminAccountDeleteSchema = z.object({
  adminId: z.string().cuid(),
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z.string().trim().min(2).max(100).optional(),
  avatarUrl: z
    .string()
    .max(2048, "Avatar URL is too long.")
    .refine(
      (value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" || url.protocol === "http:";
        } catch {
          return false;
        }
      },
      { message: "Avatar must be a valid https URL." },
    )
    .optional()
    .nullable(),
  phone: z.string().trim().min(7).max(20).optional().nullable(),
  bio: z.string().max(1500).optional().nullable(),
  headline: z.string().max(200).optional().nullable(),
  githubUrl: z.string().url().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  twitterUrl: z.string().url().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  skills: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        level: z.string().trim().max(30).optional(),
        yearsOfExperience: z.number().int().min(0).max(50).optional(),
      }),
    )
    .optional(),
  education: z
    .array(
      z.object({
        school: z.string().trim().min(1).max(120),
        degree: z.string().trim().min(1).max(120),
        fieldOfStudy: z.string().trim().max(120).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        isCurrent: z.boolean().optional(),
        description: z.string().max(1000).optional(),
      }),
    )
    .optional(),
  experience: z
    .array(
      z.object({
        company: z.string().trim().min(1).max(120),
        title: z.string().trim().min(1).max(120),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        isCurrent: z.boolean().optional(),
        description: z.string().max(1000).optional(),
      }),
    )
    .optional(),
  visibility: z
    .object({
      summary: z.enum(PROFILE_VISIBILITIES).optional(),
      links: z.enum(PROFILE_VISIBILITIES).optional(),
      skills: z.enum(PROFILE_VISIBILITIES).optional(),
      education: z.enum(PROFILE_VISIBILITIES).optional(),
      experience: z.enum(PROFILE_VISIBILITIES).optional(),
    })
    .optional(),
});

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_GROUP_SIZE = 50;
export const MESSAGE_RATE_LIMIT_WINDOW_MS = 10_000;
export const MESSAGE_RATE_LIMIT_MAX = 10;
export const MESSAGE_EDIT_DELETE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const messageSchema = z
  .object({
    threadId: z.string().cuid().optional(),
    recipientId: z.string().cuid().optional(),
    recipientIds: z.array(z.string().cuid()).min(1).optional(),
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  })
  .superRefine((data, ctx) => {
    const hasThread = Boolean(data.threadId);
    const hasDirectRecipient = Boolean(data.recipientId);
    const hasGroupRecipients = Boolean(data.recipientIds && data.recipientIds.length > 0);

    if (!hasThread && !hasDirectRecipient && !hasGroupRecipients) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide threadId, recipientId, or recipientIds.",
        path: ["recipientId"],
      });
    }

    if (hasDirectRecipient && hasGroupRecipients) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use recipientId for direct messages or recipientIds for group messages, not both.",
        path: ["recipientIds"],
      });
    }
  });

export const messageEditSchema = z.object({
  messageId: z.string().cuid(),
  body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export const messageDeleteSchema = z.object({
  messageId: z.string().cuid(),
});

export const assessmentQuestionSchema = z.object({
  prompt: z.string().trim().min(5).max(4000),
  type: z.enum(QUESTION_TYPES),
  points: z.number().int().min(1).max(1000),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        value: z.string().trim().min(1).max(200),
        isCorrect: z.boolean().optional(),
      }),
    )
    .optional(),
  answerKey: z.string().trim().max(200).optional(),
  // CODE questions: the runtime + starter shown to the pupil, and hidden input/expected test cases.
  codeLanguage: z.string().trim().max(40).optional(),
  starterCode: z.string().max(20_000).optional(),
  // CODE questions answered with blocks: optional Blockly config JSON (toolbox/startBlocks/allowCode).
  blocklyConfig: z.string().max(40_000).optional(),
  // SCRATCH questions: the checklist JSON (array of ScratchCheck) the pupil's .sb3 is graded against.
  scratchChecks: z.string().max(40_000).optional(),
  testCases: z
    .array(
      z.object({
        name: z.string().trim().max(120).optional(),
        stdin: z.string().max(20_000).optional(),
        expectedStdout: z.string().max(20_000),
        points: z.number().int().min(1).max(100),
        hidden: z.boolean().optional(),
      }),
    )
    .max(50)
    .optional(),
  // RUBRIC questions: teacher-scored criteria.
  criteria: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        description: z.string().trim().max(500).optional(),
        maxPoints: z.number().int().min(1).max(100),
      }),
    )
    .max(30)
    .optional(),
});

export const createAssessmentSchema = z.object({
  programId: z.string().cuid(),
  moduleId: z.string().cuid().nullable().optional(),
  title: z.string().trim().min(4).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  type: z.enum(ASSESSMENT_TYPES),
  weekNumber: z.number().int().min(1).nullable().optional(),
  passScore: z.number().int().min(0),
  dueDate: z.string().datetime().optional(),
  published: z.boolean().optional(),
  questions: z.array(assessmentQuestionSchema).min(1),
});

export const submitAssessmentSchema = z.object({
  assessmentId: z.string().cuid(),
  answers: z.array(
    z.object({
      questionId: z.string().cuid(),
      selectedOptionId: z.string().cuid().optional(),
      responseText: z.string().max(5000).optional(),
    }),
  ),
});

export const manualGradeSchema = z.object({
  submissionId: z.string().cuid(),
  grades: z.array(
    z.object({
      answerId: z.string().cuid(),
      score: z.number().int().min(0).max(100),
      feedback: z.string().max(2000).optional(),
    }),
  ),
  feedback: z.string().max(2000).optional(),
});

export const initializePaymentSchema = z.object({
  programId:            z.string().cuid().optional(),
  fellowApplicationId:  z.string().cuid().optional(),
  enrollmentId:         z.string().cuid().optional(),
  wardId:               z.string().cuid().optional(),
  provider:             z.enum(PAYMENT_PROVIDERS).default("PAYSTACK"),
  amount:               z.number().positive(),
  currency:             z.string().length(3).default("NGN"),
  billingMonth:         z.string().datetime().optional(),
  discountCode:         z.string().trim().toUpperCase().optional(),
}).refine(
  (d) => d.programId || d.fellowApplicationId,
  { message: "Either programId or fellowApplicationId is required.", path: ["programId"] },
);

export const verifyPaymentSchema = z.object({
  reference: z.string().trim().min(6).max(120),
  provider: z.enum(PAYMENT_PROVIDERS).default("PAYSTACK"),
});

export const batchPaymentSchema = z.object({
  items: z
    .array(
      z.object({
        wardId:       z.string().cuid(),
        programId:    z.string().cuid(),
        amount:       z.number().positive(),
        currency:     z.string().length(3).default("NGN"),
        billingMonth: z.string().datetime(),
        discountCode: z.string().trim().toUpperCase().optional(),
      }),
    )
    .min(1)
    .max(20),
  provider: z.enum(PAYMENT_PROVIDERS).default("PAYSTACK"),
});

export const verifyBatchPaymentSchema = z.object({
  batchReference: z.string().trim().min(6).max(120),
  provider: z.enum(PAYMENT_PROVIDERS).default("PAYSTACK"),
});

export const createMeetingSchema = z.object({
  cohortId: z.string().cuid().optional(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  participantIds: z.array(z.string().cuid()).min(1),
});

// ── LMS / Curriculum validators ───────────────────────────────────────────────

export const createCurriculumVersionSchema = z.object({
  label: z.string().trim().min(1).max(100),
  changelog: z.string().trim().max(2000).optional(),
});

export const createModuleSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateModuleSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createLessonSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  /** Free taster: school staff may preview this lesson on an unlicensed term. */
  isSample: z.boolean().optional(),
  /** Author flag: feature this lesson's title on a school completion certificate. */
  certHighlight: z.boolean().optional(),
});

export const createLessonContentSchema = z.object({
  type: z.enum(LESSON_CONTENT_TYPES),
  title: z.string().trim().min(2).max(200),
  body: z.string().min(1).optional(),
  url: z.string().url().optional(),
  language: z.string().trim().min(1).max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateLessonContentSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  body: z.string().min(1).optional(),
  url: z.string().url().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const reviewLessonContentSchema = z.object({
  action: z.enum(["PUBLISH", "REJECT"]),
  note: z.string().trim().max(2000).optional(),
});

export const reorderItemsSchema = z.array(
  z.object({ id: z.string().cuid(), sortOrder: z.number().int().min(0) }),
);

// ── Discount codes ─────────────────────────────────────────────────────────────

export const createDiscountCodeSchema = z.object({
  code:            z.string().trim().min(3).max(32).toUpperCase(),
  description:     z.string().trim().max(500).optional(),
  discountPercent: z.number().min(1).max(100),
  programId:       z.string().cuid().optional(), // null = applies to all programs
  maxUses:         z.number().int().min(1).optional(), // null = unlimited
  expiresAt:       z.string().datetime().optional(),
});

export const updateDiscountCodeSchema = z.object({
  description:     z.string().trim().max(500).optional(),
  discountPercent: z.number().min(1).max(100).optional(),
  maxUses:         z.number().int().min(1).optional().nullable(),
  expiresAt:       z.string().datetime().optional().nullable(),
  isActive:        z.boolean().optional(),
});

export const validateDiscountCodeSchema = z.object({
  code:      z.string().trim().toUpperCase(),
  programId: z.string().cuid(),
});

// ─────────────────────────────────────────────────────────────── partners

export const partnerInquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(200),
  type: z.enum(["SCHOOL", "CORPORATE", "GOVERNMENT", "OTHER"]),
  email: z.string().trim().email().max(200).toLowerCase(),
  phone: z.string().trim().max(40).optional(),
  programs: z.array(z.string().trim().min(1).max(80)).max(20).optional().default([]),
  message: z.string().trim().min(1).max(5000),
});

export const partnerInquiryStatusUpdateSchema = z.object({
  id: z.string().trim().min(1).max(64),
  status: z.enum(["NEW", "CONTACTED", "APPROVED", "ARCHIVED"]),
});

// ─────────────────────────────────────────────────────────────── school

/**
 * NOTE the deliberate absence of `schoolId` in every schema below: the school is derived from the
 * caller's session (requireActiveSchool) or their API key, never accepted from the request.
 * Trusting a body-supplied schoolId would be a tenant-escalation hole.
 */
const NERDC_LEVELS = ["PRIMARY_1_3", "PRIMARY_4_6", "JSS", "SSS"] as const;

export const schoolClassCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nerdcLevel: z.enum(NERDC_LEVELS),
  // A class is a cohort for a SESSION (academic year), e.g. "2025/2026". Not a single term.
  sessionLabel: z.string().trim().min(1).max(40),
  teacherId: z.string().trim().min(1).max(64).nullable().optional(),
});

export const schoolClassUpdateSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120).optional(),
  nerdcLevel: z.enum(NERDC_LEVELS).optional(),
  sessionLabel: z.string().trim().min(1).max(40).optional(),
  teacherId: z.string().trim().min(1).max(64).nullable().optional(),
  /** null unassigns the course. Locked once students are enrolled. */
  programId: z.string().trim().min(1).max(64).nullable().optional(),
  /**
   * Acknowledges that the outgoing teacher has un-attested units and will lose access to the class,
   * and therefore any ability to attest the teaching she actually did, the moment the handover
   * completes. Without this, such a change is refused with 409 and the list.
   */
  confirmHandover: z.boolean().optional(),
});

/** A teacher assigning the SCHOOL course their own class delivers. */
export const schoolClassCourseSchema = z.object({
  id: z.string().trim().min(1).max(64),
  programId: z.string().trim().min(1).max(64).nullable(),
});

/**
 * Rolling a class's pupils into a NEW next-session class (promotion). The target course must be the
 * next year's programme, not the same one; the schoolId comes from the session, never the body.
 */
export const schoolRolloverSchema = z.object({
  sourceClassId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  sessionLabel: z.string().trim().min(1).max(40),
  programId: z.string().trim().min(1).max(64),
  nerdcLevel: z.enum(NERDC_LEVELS),
  teacherId: z.string().trim().min(1).max(64).nullable().optional(),
});

/**
 * A school admin confirming seats for a term.
 *
 * NOTE the deliberate absence of `amount` and `pricePerSeat`: the amount is computed server-side as
 * seatCount x School.pricePerSeat. Accepting a price from the request would let a school invoice
 * itself for a token amount and self-issue a licence.
 */
export const schoolInvoiceCreateSchema = z.object({
  term: z.string().trim().min(1).max(40),
  seatCount: z.coerce.number().int().min(1).max(100_000),
});

export const schoolInvoiceVerifySchema = z.object({
  reference: z.string().trim().min(1).max(120),
});

export const teacherInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

/**
 * A teacher attesting they delivered a scheme unit to their class.
 * No `markedById`: that is taken from the session, so an attestation is always attributed to the
 * person who actually made it.
 */
export const schoolUnitDeliverySchema = z.object({
  classId: z.string().trim().min(1).max(64),
  moduleId: z.string().trim().min(1).max(64),
  delivered: z.boolean(),
  /**
   * What the teacher is actually claiming. FIRST_HAND ("I taught this") is the default and the only
   * option on a class that has never changed hands. SUCCESSOR ("my predecessor taught this, and I am
   * recording it") is a deliberately weaker claim, signed under the successor's OWN name. The
   * predecessor being credited is derived from the class's teacher history, never sent here.
   */
  basis: z.enum(["FIRST_HAND", "SUCCESSOR"]).optional(),
});

/**
 * A teacher records that their class finished a DIGLIT (digital-literacy) lesson delivered from the
 * front of the room, so it counts as complete for the pupils even though they did not each click
 * through it on a device. Only classId + lessonId travel here; the pupils are the class's own roster,
 * resolved server-side, never named in the request.
 */
export const schoolLessonClassCompleteSchema = z.object({
  classId: z.string().trim().min(1).max(64),
  lessonId: z.string().trim().min(1).max(64),
});

/**
 * A teacher schedules a KAT-authored assessment (test/exam) to their class, optionally with an
 * open/close window. `scheduled: false` un-schedules it. KAT authors the assessment; the teacher only
 * chooses WHEN the class sits it, so nothing about the assessment's content travels here.
 */
export const schoolScheduleAssessmentSchema = z.object({
  classId: z.string().trim().min(1).max(64),
  assessmentId: z.string().trim().min(1).max(64),
  scheduled: z.boolean(),
  opensAt: z.string().datetime().nullish(),
  closesAt: z.string().datetime().nullish(),
});

/**
 * A teacher manages a module's project teams: forms teams, moves pupils in and out, and reviews the
 * team's build. On "review" with status APPROVED the module's project gate passes for every member.
 * A single action-tagged shape; the route enforces which fields each action needs.
 */
export const schoolProjectTeamSchema = z.object({
  action: z.enum(["create", "addMember", "removeMember", "review", "delete"]),
  classId: z.string().trim().max(64).optional(),
  moduleId: z.string().trim().max(64).optional(),
  teamId: z.string().trim().max(64).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  userId: z.string().trim().max(64).optional(),
  status: z.enum(["APPROVED", "NEEDS_WORK"]).optional(),
  reviewNote: z.string().trim().max(2000).nullish(),
  submissionNote: z.string().trim().max(2000).nullish(),
  submissionUrl: z.string().trim().max(500).nullish(),
});

/**
 * A teacher signs off (or retracts) the instructor gate for one pupil on one CODING module of
 * their class. The pupil is addressed by an opaque userId in the body, never in the URL.
 */
export const schoolModuleSignoffSchema = z.object({
  classId: z.string().trim().min(1).max(64),
  moduleId: z.string().trim().min(1).max(64),
  userId: z.string().trim().min(1).max(64),
  passed: z.boolean(),
});

/**
 * A teacher marks the human-graded answers of one school submission: OPEN_ENDED (theory text) and
 * RUBRIC (observed practical). Each grade is a score for one answer; the server clamps it to that
 * question's marks and finalizes the submission.
 */
export const schoolGradeSubmissionSchema = z.object({
  submissionId: z.string().trim().min(1).max(64),
  grades: z
    .array(
      z.object({
        answerId: z.string().trim().min(1).max(64),
        score: z.number().min(0).max(1000),
        feedback: z.string().max(5000).nullish(),
      }),
    )
    .max(200),
});

/**
 * A school pupil submits an assessment. For a CODE question the client sends the code it ran plus the
 * OUTPUT its run produced per test case (`codeRuns`); the server compares those to the hidden expected
 * outputs, so nothing secret is sent to the browser. Objective answers are the selected option id.
 */
export const schoolSubmitAssessmentSchema = z.object({
  assessmentId: z.string().trim().min(1).max(64),
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1).max(64),
        selectedOptionId: z.string().trim().max(64).nullish(),
        responseText: z.string().max(50_000).nullish(),
        codeRuns: z
          .array(
            z.object({
              testCaseId: z.string().trim().max(64),
              stdout: z.string().max(100_000),
              errored: z.boolean().optional(),
            }),
          )
          .max(50)
          .optional(),
      }),
    )
    .max(200),
});

/** Max roster rows per import: bounds the transaction and the request body. */
export const ROSTER_MAX_ROWS = 500;

/**
 * One roster row. Children may have no email of their own, so a row is just a name plus an optional
 * guardian address. The student's account email is synthesised server-side; the CSV never supplies it.
 */
export const rosterRowSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(120),
  /**
   * The school's OWN opaque id for the pupil (their register number). It is the handle a school uses
   * to name a child when minting an embed launch token, and the reason the mint endpoint never has
   * to accept a name or an email (which would make it an enumeration oracle).
   */
  externalRef: z
    .string()
    .trim()
    .max(128)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  guardianEmail: z
    .string()
    .trim()
    .email("Not a valid email address.")
    .max(200)
    .toLowerCase()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * Roster import payload. The CSV text is sent in the POST BODY, never a query string, so no child's
 * name ever appears in a URL, log line, or referrer.
 */
export const rosterImportSchema = z.object({
  schoolClassId: z.string().trim().min(1).max(64),
  csv: z.string().min(1).max(200_000),
});

/**
 * Provision a School (+ its first SCHOOL_ADMIN) from an approved SCHOOL inquiry.
 * `mode: "existing"` links an existing user by email; `mode: "create"` creates the account and
 * emails a setup link (first/last name required in that case).
 */
export const schoolProvisionSchema = z
  .object({
    inquiryId: z.string().trim().min(1).max(64),
    schoolName: z.string().trim().min(2).max(200),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only."),
    pricePerSeat: z.coerce.number().min(0).max(1_000_000).optional(),
    adminMode: z.enum(["existing", "create"]),
    adminEmail: z.string().trim().email().max(200).toLowerCase(),
    adminFirstName: z.string().trim().min(1).max(100).optional(),
    adminLastName: z.string().trim().min(1).max(100).optional(),
  })
  .refine(
    (d) => d.adminMode !== "create" || (d.adminFirstName && d.adminLastName),
    { message: "First and last name are required when creating the account." },
  );

/**
 * Super-admin updates a school after provisioning: its negotiated per-seat price and/or its billing
 * suspension. Both optional; at least one must be present. Price bounds match
 * `schoolProvisionSchema.pricePerSeat`. `suspended: true` pauses NEW invoicing (a commercial pause,
 * not a mid-term access cut); false resumes. Setting price to 0 also blocks invoicing until repriced.
 */
export const schoolAdminUpdateSchema = z
  .object({
    pricePerSeat: z.coerce.number().min(0).max(1_000_000).optional(),
    suspended: z.boolean().optional(),
  })
  .refine((d) => d.pricePerSeat !== undefined || d.suspended !== undefined, {
    message: "Provide a price and/or a suspension state to update.",
  });
