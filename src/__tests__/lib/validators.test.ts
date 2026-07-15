import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  messageSchema,
  messageEditSchema,
  messageDeleteSchema,
  createAssessmentSchema,
  submitAssessmentSchema,
  manualGradeSchema,
  initializePaymentSchema,
  verifyPaymentSchema,
  createDiscountCodeSchema,
  validateDiscountCodeSchema,
  createMeetingSchema,
  profileSchema,
  adminInviteCreateSchema,
} from "@/lib/validators";

function cuid() {
  // Minimal valid cuid for schema testing
  return "cjld2cjxh0000qzrmn831i7rn";
}

// ── loginSchema ────────────────────────────────────────────────────────────────

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "user@kat.io", password: "Password1" }).success).toBe(true);
  });

  it("lowercases the email", () => {
    const result = loginSchema.safeParse({ email: "USER@KAT.IO", password: "Password1" });
    expect(result.success && result.data.email).toBe("user@kat.io");
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "Password1" }).success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "short" }).success).toBe(false);
  });
});

// ── registerSchema ─────────────────────────────────────────────────────────────

describe("registerSchema", () => {
  const valid = {
    firstName: "Amaka",
    lastName: "Okafor",
    email: "amaka@kat.io",
    password: "Secure1pass",
    role: "STUDENT",
  };

  it("accepts a valid payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a password without an uppercase letter", () => {
    expect(registerSchema.safeParse({ ...valid, password: "nocap1here" }).success).toBe(false);
  });

  it("rejects a password without a lowercase letter", () => {
    expect(registerSchema.safeParse({ ...valid, password: "NOLOWER1" }).success).toBe(false);
  });

  it("rejects a password without a digit", () => {
    expect(registerSchema.safeParse({ ...valid, password: "NoDigitHere" }).success).toBe(false);
  });

  it("rejects a firstName shorter than 2 characters", () => {
    expect(registerSchema.safeParse({ ...valid, firstName: "A" }).success).toBe(false);
  });

  it("rejects a completely unknown role string", () => {
    expect(registerSchema.safeParse({ ...valid, role: "MANAGER" }).success).toBe(false);
  });

  it("accepts all USER_ROLES values at schema level (API route blocks privileged ones)", () => {
    for (const role of ["STUDENT", "PARENT", "FELLOW", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN"]) {
      expect(registerSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
  });
});

// ── messageSchema ──────────────────────────────────────────────────────────────

describe("messageSchema", () => {
  const body = "Hello!";

  it("accepts a message with only threadId", () => {
    expect(messageSchema.safeParse({ threadId: cuid(), body }).success).toBe(true);
  });

  it("accepts a message with only recipientId", () => {
    expect(messageSchema.safeParse({ recipientId: cuid(), body }).success).toBe(true);
  });

  it("accepts a message with only recipientIds (group)", () => {
    expect(messageSchema.safeParse({ recipientIds: [cuid()], body }).success).toBe(true);
  });

  it("rejects when neither threadId nor any recipientId is provided", () => {
    expect(messageSchema.safeParse({ body }).success).toBe(false);
  });

  it("rejects when both recipientId and recipientIds are provided", () => {
    expect(
      messageSchema.safeParse({ recipientId: cuid(), recipientIds: [cuid()], body }).success,
    ).toBe(false);
  });

  it("rejects a body that exceeds 4000 characters", () => {
    expect(
      messageSchema.safeParse({ threadId: cuid(), body: "x".repeat(4001) }).success,
    ).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(messageSchema.safeParse({ threadId: cuid(), body: "" }).success).toBe(false);
  });
});

// ── messageEditSchema / messageDeleteSchema ────────────────────────────────────

describe("messageEditSchema", () => {
  it("accepts valid messageId and body", () => {
    expect(messageEditSchema.safeParse({ messageId: cuid(), body: "Updated text" }).success).toBe(true);
  });

  it("rejects a missing messageId", () => {
    expect(messageEditSchema.safeParse({ body: "Updated text" }).success).toBe(false);
  });
});

describe("messageDeleteSchema", () => {
  it("accepts a valid cuid", () => {
    expect(messageDeleteSchema.safeParse({ messageId: cuid() }).success).toBe(true);
  });

  it("rejects a non-cuid string", () => {
    expect(messageDeleteSchema.safeParse({ messageId: "not-a-cuid" }).success).toBe(false);
  });
});

// ── createAssessmentSchema ─────────────────────────────────────────────────────

describe("createAssessmentSchema", () => {
  const question = {
    prompt: "What is 2+2?",
    type: "MULTIPLE_CHOICE",
    points: 10,
    options: [{ label: "4", value: "4", isCorrect: true }],
  };

  const valid = {
    programId: cuid(),
    title: "Module 1 Quiz",
    type: "QUIZ",
    passScore: 70,
    questions: [question],
  };

  it("accepts a valid assessment", () => {
    expect(createAssessmentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects when questions array is empty", () => {
    expect(createAssessmentSchema.safeParse({ ...valid, questions: [] }).success).toBe(false);
  });

  it("rejects an invalid assessment type", () => {
    expect(createAssessmentSchema.safeParse({ ...valid, type: "UNKNOWN" }).success).toBe(false);
  });

  it("rejects a title shorter than 4 characters", () => {
    expect(createAssessmentSchema.safeParse({ ...valid, title: "Hi" }).success).toBe(false);
  });

  it("rejects a negative passScore", () => {
    expect(createAssessmentSchema.safeParse({ ...valid, passScore: -1 }).success).toBe(false);
  });

  it("accepts all assessment types", () => {
    for (const type of ["QUIZ", "EXAM", "ASSIGNMENT", "PROJECT", "CHALLENGE"]) {
      expect(createAssessmentSchema.safeParse({ ...valid, type }).success).toBe(true);
    }
  });
});

// ── submitAssessmentSchema ─────────────────────────────────────────────────────

describe("submitAssessmentSchema", () => {
  it("accepts a valid submission", () => {
    expect(
      submitAssessmentSchema.safeParse({
        assessmentId: cuid(),
        answers: [{ questionId: cuid(), selectedOptionId: cuid() }],
      }).success,
    ).toBe(true);
  });

  it("accepts an empty answers array", () => {
    expect(
      submitAssessmentSchema.safeParse({ assessmentId: cuid(), answers: [] }).success,
    ).toBe(true);
  });

  it("rejects a missing assessmentId", () => {
    expect(submitAssessmentSchema.safeParse({ answers: [] }).success).toBe(false);
  });
});

// ── manualGradeSchema ──────────────────────────────────────────────────────────

describe("manualGradeSchema", () => {
  it("accepts a valid grading payload", () => {
    expect(
      manualGradeSchema.safeParse({
        submissionId: cuid(),
        grades: [{ answerId: cuid(), score: 80 }],
      }).success,
    ).toBe(true);
  });

  it("rejects a score above 100", () => {
    expect(
      manualGradeSchema.safeParse({
        submissionId: cuid(),
        grades: [{ answerId: cuid(), score: 101 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a negative score", () => {
    expect(
      manualGradeSchema.safeParse({
        submissionId: cuid(),
        grades: [{ answerId: cuid(), score: -1 }],
      }).success,
    ).toBe(false);
  });
});

// ── initializePaymentSchema ────────────────────────────────────────────────────

describe("initializePaymentSchema", () => {
  const base = { amount: 5000, currency: "NGN", provider: "PAYSTACK" };

  it("accepts a payload with programId", () => {
    expect(initializePaymentSchema.safeParse({ ...base, programId: cuid() }).success).toBe(true);
  });

  it("accepts a payload with fellowApplicationId", () => {
    expect(
      initializePaymentSchema.safeParse({ ...base, fellowApplicationId: cuid() }).success,
    ).toBe(true);
  });

  it("rejects when neither programId nor fellowApplicationId is provided", () => {
    expect(initializePaymentSchema.safeParse(base).success).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    expect(
      initializePaymentSchema.safeParse({ ...base, programId: cuid(), amount: 0 }).success,
    ).toBe(false);
  });

  it("rejects a currency code that is not exactly 3 characters", () => {
    expect(
      initializePaymentSchema.safeParse({ ...base, programId: cuid(), currency: "NAIRA" }).success,
    ).toBe(false);
  });

  it("defaults provider to PAYSTACK", () => {
    const result = initializePaymentSchema.safeParse({ amount: 1000, programId: cuid() });
    expect(result.success && result.data.provider).toBe("PAYSTACK");
  });
});

// ── verifyPaymentSchema ────────────────────────────────────────────────────────

describe("verifyPaymentSchema", () => {
  it("accepts a valid reference", () => {
    expect(verifyPaymentSchema.safeParse({ reference: "PAY_abc123456" }).success).toBe(true);
  });

  it("rejects a reference shorter than 6 characters", () => {
    expect(verifyPaymentSchema.safeParse({ reference: "abc" }).success).toBe(false);
  });
});

// ── createDiscountCodeSchema ───────────────────────────────────────────────────

describe("createDiscountCodeSchema", () => {
  const valid = { code: "SAVE20", discountPercent: 20 };

  it("accepts a valid discount code", () => {
    expect(createDiscountCodeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects discountPercent of 0", () => {
    expect(createDiscountCodeSchema.safeParse({ ...valid, discountPercent: 0 }).success).toBe(false);
  });

  it("rejects discountPercent above 100", () => {
    expect(createDiscountCodeSchema.safeParse({ ...valid, discountPercent: 101 }).success).toBe(false);
  });

  it("rejects a code shorter than 3 characters", () => {
    expect(createDiscountCodeSchema.safeParse({ ...valid, code: "AB" }).success).toBe(false);
  });

  it("uppercases the code", () => {
    const result = createDiscountCodeSchema.safeParse({ ...valid, code: "save20" });
    expect(result.success && result.data.code).toBe("SAVE20");
  });
});

// ── validateDiscountCodeSchema ─────────────────────────────────────────────────

describe("validateDiscountCodeSchema", () => {
  it("accepts a valid code and programId", () => {
    expect(
      validateDiscountCodeSchema.safeParse({ code: "SUMMER10", programId: cuid() }).success,
    ).toBe(true);
  });

  it("rejects a missing programId", () => {
    expect(validateDiscountCodeSchema.safeParse({ code: "SUMMER10" }).success).toBe(false);
  });
});

// ── profileSchema ──────────────────────────────────────────────────────────────

describe("profileSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(profileSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid avatar URL", () => {
    expect(
      profileSchema.safeParse({ avatarUrl: "https://example.com/avatar.png" }).success,
    ).toBe(true);
  });

  it("rejects an avatar URL without https/http protocol", () => {
    expect(profileSchema.safeParse({ avatarUrl: "ftp://example.com/avatar.png" }).success).toBe(
      false,
    );
  });

  it("accepts null avatarUrl (to clear the avatar)", () => {
    expect(profileSchema.safeParse({ avatarUrl: null }).success).toBe(true);
  });

  it("rejects a bio longer than 1500 characters", () => {
    expect(profileSchema.safeParse({ bio: "x".repeat(1501) }).success).toBe(false);
  });

  it("accepts a valid skills array", () => {
    expect(
      profileSchema.safeParse({
        skills: [{ name: "TypeScript", level: "Advanced", yearsOfExperience: 3 }],
      }).success,
    ).toBe(true);
  });

  it("rejects a skill with no name", () => {
    expect(profileSchema.safeParse({ skills: [{ name: "" }] }).success).toBe(false);
  });

  it("rejects an invalid visibility value", () => {
    expect(
      profileSchema.safeParse({ visibility: { summary: "EVERYONE" } }).success,
    ).toBe(false);
  });

  it("accepts all valid visibility values", () => {
    for (const v of ["PRIVATE", "ORG", "PUBLIC"]) {
      expect(profileSchema.safeParse({ visibility: { summary: v } }).success).toBe(true);
    }
  });
});

// ── adminInviteCreateSchema ────────────────────────────────────────────────────

describe("adminInviteCreateSchema", () => {
  it("accepts a valid ADMIN invite", () => {
    expect(adminInviteCreateSchema.safeParse({ email: "new@kat.io", role: "ADMIN" }).success).toBe(true);
  });

  it("accepts an INSTRUCTOR invite", () => {
    expect(
      adminInviteCreateSchema.safeParse({ email: "i@kat.io", role: "INSTRUCTOR" }).success,
    ).toBe(true);
  });

  it("rejects a STUDENT role (not invitable)", () => {
    expect(
      adminInviteCreateSchema.safeParse({ email: "s@kat.io", role: "STUDENT" }).success,
    ).toBe(false);
  });

  it("defaults expiresInHours to 24", () => {
    const result = adminInviteCreateSchema.safeParse({ email: "a@kat.io" });
    expect(result.success && result.data.expiresInHours).toBe(24);
  });

  it("rejects expiresInHours above 168", () => {
    expect(
      adminInviteCreateSchema.safeParse({ email: "a@kat.io", expiresInHours: 200 }).success,
    ).toBe(false);
  });
});

// ── createMeetingSchema ────────────────────────────────────────────────────────

describe("createMeetingSchema", () => {
  const valid = {
    title: "Weekly Sync",
    startTime: new Date(Date.now() + 3600_000).toISOString(),
    endTime: new Date(Date.now() + 7200_000).toISOString(),
    participantIds: [cuid()],
  };

  it("accepts a valid meeting", () => {
    expect(createMeetingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty participantIds array", () => {
    expect(createMeetingSchema.safeParse({ ...valid, participantIds: [] }).success).toBe(false);
  });

  it("rejects a title shorter than 3 characters", () => {
    expect(createMeetingSchema.safeParse({ ...valid, title: "AB" }).success).toBe(false);
  });

  it("rejects a non-ISO datetime for startTime", () => {
    expect(
      createMeetingSchema.safeParse({ ...valid, startTime: "not-a-date" }).success,
    ).toBe(false);
  });
});
