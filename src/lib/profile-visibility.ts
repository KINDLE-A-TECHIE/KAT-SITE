import type { ProfileVisibility } from "@prisma/client";
import type { ProfileVisibilityValue } from "./enums";

export type ProfileVisibilitySettings = {
  summary: ProfileVisibilityValue;
  links: ProfileVisibilityValue;
  skills: ProfileVisibilityValue;
  education: ProfileVisibilityValue;
  experience: ProfileVisibilityValue;
};

export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibilitySettings = {
  summary: "ORG",
  links: "PRIVATE",
  skills: "ORG",
  education: "ORG",
  experience: "ORG",
};

type VisibilitySource = {
  summaryVisibility?: ProfileVisibility | null;
  linksVisibility?: ProfileVisibility | null;
  skillsVisibility?: ProfileVisibility | null;
  educationVisibility?: ProfileVisibility | null;
  experienceVisibility?: ProfileVisibility | null;
} | null | undefined;

type ViewerContext = {
  viewerId: string;
  viewerOrganizationId?: string | null;
  targetUserId: string;
  targetOrganizationId?: string | null;
};

type RawProfilePreview = {
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  websiteUrl?: string | null;
  skills?: { name: string }[];
  education?: {
    school: string;
    degree: string;
    fieldOfStudy?: string | null;
    isCurrent: boolean;
  }[];
  experience?: {
    company: string;
    title: string;
    isCurrent: boolean;
  }[];
} | null | undefined;

export type VisibleProfilePreview = {
  headline: string | null;
  bio: string | null;
  location: string | null;
  links: {
    githubUrl: string | null;
    linkedinUrl: string | null;
    twitterUrl: string | null;
    websiteUrl: string | null;
  } | null;
  skills: string[];
  education: {
    school: string;
    degree: string;
    fieldOfStudy: string | null;
    isCurrent: boolean;
  }[];
  experience: {
    company: string;
    title: string;
    isCurrent: boolean;
  }[];
  visibility: ProfileVisibilitySettings;
};

export function normalizeProfileVisibility(source: VisibilitySource): ProfileVisibilitySettings {
  return {
    summary: source?.summaryVisibility ?? DEFAULT_PROFILE_VISIBILITY.summary,
    links: source?.linksVisibility ?? DEFAULT_PROFILE_VISIBILITY.links,
    skills: source?.skillsVisibility ?? DEFAULT_PROFILE_VISIBILITY.skills,
    education: source?.educationVisibility ?? DEFAULT_PROFILE_VISIBILITY.education,
    experience: source?.experienceVisibility ?? DEFAULT_PROFILE_VISIBILITY.experience,
  };
}

export function canViewProfileSection(visibility: ProfileVisibilityValue, context: ViewerContext) {
  if (context.viewerId === context.targetUserId) {
    return true;
  }
  if (visibility === "PUBLIC") {
    return true;
  }
  if (visibility === "ORG") {
    if (!context.viewerOrganizationId || !context.targetOrganizationId) {
      return true;
    }
    return context.viewerOrganizationId === context.targetOrganizationId;
  }
  return false;
}

export function buildVisibleProfilePreview(input: {
  context: ViewerContext;
  visibilitySource: VisibilitySource;
  profile: RawProfilePreview;
}): VisibleProfilePreview {
  const visibility = normalizeProfileVisibility(input.visibilitySource);

  const canViewSummary = canViewProfileSection(visibility.summary, input.context);
  const canViewLinks = canViewProfileSection(visibility.links, input.context);
  const canViewSkills = canViewProfileSection(visibility.skills, input.context);
  const canViewEducation = canViewProfileSection(visibility.education, input.context);
  const canViewExperience = canViewProfileSection(visibility.experience, input.context);

  return {
    headline: canViewSummary ? input.profile?.headline ?? null : null,
    bio: canViewSummary ? input.profile?.bio ?? null : null,
    location: canViewSummary ? input.profile?.location ?? null : null,
    links: canViewLinks
      ? {
          githubUrl: input.profile?.githubUrl ?? null,
          linkedinUrl: input.profile?.linkedinUrl ?? null,
          twitterUrl: input.profile?.twitterUrl ?? null,
          websiteUrl: input.profile?.websiteUrl ?? null,
        }
      : null,
    skills: canViewSkills ? (input.profile?.skills ?? []).map((skill) => skill.name) : [],
    education: canViewEducation
      ? (input.profile?.education ?? []).map((item) => ({
          school: item.school,
          degree: item.degree,
          fieldOfStudy: item.fieldOfStudy ?? null,
          isCurrent: item.isCurrent,
        }))
      : [],
    experience: canViewExperience
      ? (input.profile?.experience ?? []).map((item) => ({
          company: item.company,
          title: item.title,
          isCurrent: item.isCurrent,
        }))
      : [],
    visibility,
  };
}
