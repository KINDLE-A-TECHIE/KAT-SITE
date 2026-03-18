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

export const adminAccountUpdateSchema = z.object({
  adminId: z.string().cuid(),
  action: z.enum(["hold", "activate", "enable-retakes", "disable-retakes"]),
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
    .max(1_500_000, "Avatar image is too large.")
    .refine(
      (value) => {
        if (value.startsWith("data:image/")) {
          return true;
        }
        try {
          const url = new URL(value);
          return url.protocol === "https:" || url.protocol === "http:";
        } catch {
          return false;
        }
      },
      {
        message: "Avatar must be an image data URL or a valid http(s) URL.",
      },
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
  points: z.number().int().min(1).max(100),
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
});

export const createAssessmentSchema = z.object({
  programId: z.string().cuid(),
  moduleId: z.string().cuid().optional(),
  title: z.string().trim().min(4).max(200),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(ASSESSMENT_TYPES),
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
