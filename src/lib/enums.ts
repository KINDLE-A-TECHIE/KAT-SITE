export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "INSTRUCTOR",
  "FELLOW",
  "STUDENT",
  "PARENT",
  "SCHOOL_STAFF",
  "SCHOOL_STUDENT",
] as const;

export type UserRoleValue = (typeof USER_ROLES)[number];

export const ASSESSMENT_TYPES = ["QUIZ", "EXAM", "ASSIGNMENT", "PROJECT", "CHALLENGE"] as const;
export type AssessmentTypeValue = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_VERIFICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type AssessmentVerificationStatusValue = (typeof ASSESSMENT_VERIFICATION_STATUSES)[number];

export const QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "OPEN_ENDED", "CODE", "RUBRIC"] as const;
export type QuestionTypeValue = (typeof QUESTION_TYPES)[number];

export const PAYMENT_PROVIDERS = ["PAYSTACK", "STRIPE"] as const;
export type PaymentProviderValue = (typeof PAYMENT_PROVIDERS)[number];

export const MEETING_STATUSES = ["UPCOMING", "LIVE", "ENDED", "CANCELLED"] as const;
export type MeetingStatusValue = (typeof MEETING_STATUSES)[number];

export const MEETING_RECORDING_MODES = ["NONE", "MANUAL", "AUTO_REQUIRED"] as const;
export type MeetingRecordingModeValue = (typeof MEETING_RECORDING_MODES)[number];

export const MEETING_RECORDING_STATUSES = ["NOT_REQUESTED", "PENDING", "AVAILABLE", "FAILED"] as const;
export type MeetingRecordingStatusValue = (typeof MEETING_RECORDING_STATUSES)[number];

export const PROGRAM_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "FELLOWSHIP"] as const;
export type ProgramLevelValue = (typeof PROGRAM_LEVELS)[number];

export const PROFILE_VISIBILITIES = ["PRIVATE", "ORG", "PUBLIC"] as const;
export type ProfileVisibilityValue = (typeof PROFILE_VISIBILITIES)[number];

export const LESSON_CONTENT_TYPES = [
  "RICH_TEXT",
  "YOUTUBE_EMBED",
  "EXTERNAL_VIDEO",
  "DOCUMENT_LINK",
  "CODE_PLAYGROUND",
  "NETWORK_LAB",
] as const;
export type LessonContentTypeValue = (typeof LESSON_CONTENT_TYPES)[number];

export const CONTENT_REVIEW_STATUSES = ["PENDING_REVIEW", "PUBLISHED", "REJECTED"] as const;
export type ContentReviewStatusValue = (typeof CONTENT_REVIEW_STATUSES)[number];

// Certificate / program level display helpers, shared across dashboard and public pages
export const PROGRAM_LEVEL_LABEL: Record<string, string> = {
  BEGINNER:     "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED:     "Advanced",
  FELLOWSHIP:   "Fellowship",
};

export const PROGRAM_LEVEL_COLOR: Record<string, string> = {
  BEGINNER:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  INTERMEDIATE: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  ADVANCED:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  FELLOWSHIP:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};
