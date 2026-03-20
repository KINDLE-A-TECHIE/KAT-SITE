"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, GraduationCap, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileVisibilityValue } from "@/lib/enums";

type EducationFormItem = {
  id: string;
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
};

type ExperienceFormItem = {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
};

type ProfileState = {
  firstName: string;
  lastName: string;
  avatarUrl: string;
  phone: string;
  headline: string;
  bio: string;
  location: string;
  githubUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  skills: string[];
  education: EducationFormItem[];
  experience: ExperienceFormItem[];
  visibility: {
    summary: ProfileVisibilityValue;
    links: ProfileVisibilityValue;
    skills: ProfileVisibilityValue;
    education: ProfileVisibilityValue;
    experience: ProfileVisibilityValue;
  };
};

type ProfileApiUser = {
  firstName?: string;
  lastName?: string;
  profile?: {
    avatarUrl?: string | null;
    phone?: string | null;
    headline?: string | null;
    bio?: string | null;
    location?: string | null;
    githubUrl?: string | null;
    linkedinUrl?: string | null;
    twitterUrl?: string | null;
    websiteUrl?: string | null;
    summaryVisibility?: ProfileVisibilityValue | null;
    linksVisibility?: ProfileVisibilityValue | null;
    skillsVisibility?: ProfileVisibilityValue | null;
    educationVisibility?: ProfileVisibilityValue | null;
    experienceVisibility?: ProfileVisibilityValue | null;
    skills?: { name: string }[];
    education?: {
      school: string;
      degree: string;
      fieldOfStudy?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      isCurrent?: boolean;
      description?: string | null;
    }[];
    experience?: {
      company: string;
      title: string;
      startDate?: string | null;
      endDate?: string | null;
      isCurrent?: boolean;
      description?: string | null;
    }[];
  };
};

const MAX_AVATAR_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — server compresses to <5 MB
const VISIBILITY_OPTIONS: { label: string; value: ProfileVisibilityValue }[] = [
  { label: "Only me", value: "PRIVATE" },
  { label: "Institution members", value: "ORG" },
  { label: "Public", value: "PUBLIC" },
];
const LOCATION_OPTIONS = [
  "United Kingdom",
  "Nigeria",
  "United States",
  "Canada",
  "Ireland",
  "South Africa",
  "Kenya",
  "Ghana",
  "Rwanda",
  "Egypt",
  "Morocco",
  "Germany",
  "France",
  "Netherlands",
  "Spain",
  "Portugal",
  "Italy",
  "United Arab Emirates",
  "India",
  "Australia",
  "New Zealand",
  "Singapore",
] as const;
const PROFILE_CARD_CLASS = "border border-slate-200/90 dark:border-slate-700/90 bg-white/95 dark:bg-slate-900/90 shadow-[0_16px_38px_-28px_rgba(15,23,42,0.55)]";
const PROFILE_INPUT_CLASS =
  "h-10 rounded-xl border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800 px-3 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-0";
const PROFILE_SELECT_CLASS =
  "h-10 w-full max-w-full min-w-0 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800 px-3 text-sm text-slate-700 dark:text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-200";
const PROFILE_VISIBILITY_SELECT_CLASS =
  "h-10 w-full max-w-full min-w-0 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800 px-3 text-sm text-slate-700 dark:text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-200";
const PROFILE_PANEL_CLASS = "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.6)]";
const PROFILE_TEXTAREA_CLASS =
  "rounded-xl border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-0";
const PROFILE_SELECT_CONTENT_CLASS = "max-h-56 overflow-y-auto";

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyEducation(): EducationFormItem {
  return {
    id: createClientId(),
    school: "",
    degree: "",
    fieldOfStudy: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "",
  };
}

function emptyExperience(): ExperienceFormItem {
  return {
    id: createClientId(),
    company: "",
    title: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "",
  };
}

const defaultState: ProfileState = {
  firstName: "",
  lastName: "",
  avatarUrl: "",
  phone: "",
  headline: "",
  bio: "",
  location: "United Kingdom",
  githubUrl: "",
  linkedinUrl: "",
  twitterUrl: "",
  websiteUrl: "",
  skills: [],
  education: [],
  experience: [],
  visibility: {
    summary: "ORG",
    links: "PRIVATE",
    skills: "ORG",
    education: "ORG",
    experience: "ORG",
  },
};

function toDateInput(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function toIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function getInitials(firstName: string, lastName: string) {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();
  return `${first}${last}`.trim() || "KP";
}

function cleanOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}


export function ProfilePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");
  const [state, setState] = useState<ProfileState>(defaultState);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const displayName = useMemo(() => {
    const full = `${state.firstName} ${state.lastName}`.trim();
    return full || "Your profile";
  }, [state.firstName, state.lastName]);
  const normalizedLocation = useMemo(() => state.location.trim() || "United Kingdom", [state.location]);
  const locationOptions = useMemo(() => {
    if (LOCATION_OPTIONS.includes(normalizedLocation as (typeof LOCATION_OPTIONS)[number])) {
      return [...LOCATION_OPTIONS];
    }
    return [normalizedLocation, ...LOCATION_OPTIONS];
  }, [normalizedLocation]);
  const profileCompletion = useMemo(() => {
    const checks = [
      state.firstName.trim().length > 0,
      state.lastName.trim().length > 0,
      state.headline.trim().length > 0,
      state.bio.trim().length > 0,
      state.phone.trim().length > 0,
      normalizedLocation.trim().length > 0,
      state.skills.length > 0,
      state.education.length > 0,
      state.experience.length > 0,
      Boolean(state.avatarUrl),
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [state, normalizedLocation]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/profile", { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; user?: ProfileApiUser };

      if (!response.ok || !payload.user) {
        toast.error(payload.error ?? "Could not load profile.");
        return;
      }

      const profile = payload.user.profile;
      setState({
        firstName: payload.user.firstName ?? "",
        lastName: payload.user.lastName ?? "",
        avatarUrl: profile?.avatarUrl ?? "",
        phone: profile?.phone ?? "",
        headline: profile?.headline ?? "",
        bio: profile?.bio ?? "",
        location: profile?.location?.trim() || "United Kingdom",
        githubUrl: profile?.githubUrl ?? "",
        linkedinUrl: profile?.linkedinUrl ?? "",
        twitterUrl: profile?.twitterUrl ?? "",
        websiteUrl: profile?.websiteUrl ?? "",
        skills: (profile?.skills ?? []).map((item) => item.name).filter(Boolean),
        education: (profile?.education ?? []).map((item) => ({
          id: createClientId(),
          school: item.school ?? "",
          degree: item.degree ?? "",
          fieldOfStudy: item.fieldOfStudy ?? "",
          startDate: toDateInput(item.startDate),
          endDate: toDateInput(item.endDate),
          isCurrent: item.isCurrent ?? false,
          description: item.description ?? "",
        })),
        experience: (profile?.experience ?? []).map((item) => ({
          id: createClientId(),
          company: item.company ?? "",
          title: item.title ?? "",
          startDate: toDateInput(item.startDate),
          endDate: toDateInput(item.endDate),
          isCurrent: item.isCurrent ?? false,
          description: item.description ?? "",
        })),
        visibility: {
          summary: profile?.summaryVisibility ?? "ORG",
          links: profile?.linksVisibility ?? "PRIVATE",
          skills: profile?.skillsVisibility ?? "ORG",
          education: profile?.educationVisibility ?? "ORG",
          experience: profile?.experienceVisibility ?? "ORG",
        },
      });
    } catch {
      toast.error("Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      toast.error("Image must be smaller than 20 MB.");
      return;
    }

    setAvatarUploading(true);

    try {
      const res = await fetch("/api/users/avatar", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      let data: { error?: string; avatarUrl?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        // Server returned non-JSON (e.g. HTML error page)
        toast.error("Server error — check console for details.");
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? "Could not upload photo.");
        return;
      }

      const avatarUrl = data.avatarUrl ?? "";
      setState((prev) => ({ ...prev, avatarUrl }));
      toast.success("Profile photo updated!");
      window.dispatchEvent(
        new CustomEvent("kat-profile-updated", { detail: { avatarUrl } }),
      );
    } catch (err) {
      console.error("[avatar upload]", err);
      toast.error("Avatar upload failed.");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    const res = await fetch("/api/users/avatar", { method: "DELETE" });
    if (res.ok) {
      setState((prev) => ({ ...prev, avatarUrl: "" }));
      toast.success("Profile photo removed.");
      window.dispatchEvent(
        new CustomEvent("kat-profile-updated", { detail: { avatarUrl: null } }),
      );
    } else {
      toast.error("Could not remove photo.");
    }
  };

  const addSkill = (raw: string) => {
    const parsed = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parsed.length === 0) {
      return;
    }

    setState((prev) => {
      const existing = new Set(prev.skills.map((item) => item.toLowerCase()));
      const next = [...prev.skills];

      for (const skill of parsed) {
        const key = skill.toLowerCase();
        if (!existing.has(key)) {
          next.push(skill);
          existing.add(key);
        }
      }

      return { ...prev, skills: next };
    });

    setSkillDraft("");
  };

  const removeSkill = (skill: string) => {
    setState((prev) => ({
      ...prev,
      skills: prev.skills.filter((item) => item !== skill),
    }));
  };

  const updateEducation = (id: string, patch: Partial<EducationFormItem>) => {
    setState((prev) => ({
      ...prev,
      education: prev.education.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const updateExperience = (id: string, patch: Partial<ExperienceFormItem>) => {
    setState((prev) => ({
      ...prev,
      experience: prev.experience.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const save = async () => {
    const firstName = state.firstName.trim();
    const lastName = state.lastName.trim();

    if (firstName.length < 2 || lastName.length < 2) {
      toast.error("First and last name must be at least 2 characters.");
      return;
    }

    const education: {
      school: string;
      degree: string;
      fieldOfStudy?: string;
      startDate?: string;
      endDate?: string;
      isCurrent?: boolean;
      description?: string;
    }[] = [];

    for (let index = 0; index < state.education.length; index += 1) {
      const item = state.education[index];
      const school = item.school.trim();
      const degree = item.degree.trim();
      const fieldOfStudy = item.fieldOfStudy.trim();
      const description = item.description.trim();

      const hasAnyValue =
        school.length > 0 ||
        degree.length > 0 ||
        fieldOfStudy.length > 0 ||
        description.length > 0 ||
        item.startDate.length > 0 ||
        item.endDate.length > 0 ||
        item.isCurrent;

      if (!hasAnyValue) {
        continue;
      }

      if (!school || !degree) {
        toast.error(`Education entry ${index + 1} requires school and degree.`);
        return;
      }

      education.push({
        school,
        degree,
        fieldOfStudy: fieldOfStudy || undefined,
        description: description || undefined,
        startDate: item.startDate ? toIsoDate(item.startDate) : undefined,
        endDate: item.isCurrent ? undefined : item.endDate ? toIsoDate(item.endDate) : undefined,
        isCurrent: item.isCurrent,
      });
    }

    const experience: {
      company: string;
      title: string;
      startDate?: string;
      endDate?: string;
      isCurrent?: boolean;
      description?: string;
    }[] = [];

    for (let index = 0; index < state.experience.length; index += 1) {
      const item = state.experience[index];
      const company = item.company.trim();
      const title = item.title.trim();
      const description = item.description.trim();

      const hasAnyValue =
        company.length > 0 ||
        title.length > 0 ||
        description.length > 0 ||
        item.startDate.length > 0 ||
        item.endDate.length > 0 ||
        item.isCurrent;

      if (!hasAnyValue) {
        continue;
      }

      if (!company || !title) {
        toast.error(`Experience entry ${index + 1} requires company and title.`);
        return;
      }

      experience.push({
        company,
        title,
        description: description || undefined,
        startDate: item.startDate ? toIsoDate(item.startDate) : undefined,
        endDate: item.isCurrent ? undefined : item.endDate ? toIsoDate(item.endDate) : undefined,
        isCurrent: item.isCurrent,
      });
    }

    const skills = Array.from(new Set(state.skills.map((item) => item.trim()).filter(Boolean))).map((name) => ({
      name,
    }));

    setSaving(true);
    try {
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: cleanOptional(state.phone),
          headline: cleanOptional(state.headline),
          bio: cleanOptional(state.bio),
          location: cleanOptional(state.location) ?? "United Kingdom",
          githubUrl: cleanOptional(state.githubUrl),
          linkedinUrl: cleanOptional(state.linkedinUrl),
          twitterUrl: cleanOptional(state.twitterUrl),
          websiteUrl: cleanOptional(state.websiteUrl),
          skills,
          education,
          experience,
          visibility: {
            summary: state.visibility.summary,
            links: state.visibility.links,
            skills: state.visibility.skills,
            education: state.visibility.education,
            experience: state.visibility.experience,
          },
        }),
      });

      const payload = (await response.json()) as { error?: string; details?: unknown };

      if (!response.ok) {
        toast.error(payload.error ?? "Profile update failed.");
        return;
      }

      toast.success("Profile updated.");
      window.dispatchEvent(
        new CustomEvent("kat-profile-updated", {
          detail: { firstName, lastName },
        }),
      );
      await load();
    } catch {
      toast.error("Profile update failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className={PROFILE_CARD_CLASS}>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-24 rounded-full" />
            <div className="w-full space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[300px,minmax(0,1fr)]"
    >
      <Card className={`${PROFILE_CARD_CLASS} h-fit overflow-hidden lg:sticky lg:top-24`}>
        <CardContent className="space-y-6 pt-6">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-b from-slate-50 dark:from-slate-800/60 to-white dark:to-slate-900 p-4">
            <div className="flex flex-col items-center text-center">
              <Avatar className="size-28 border border-slate-200 dark:border-slate-700 shadow-sm">
                <AvatarImage src={state.avatarUrl || undefined} alt={`${displayName} profile picture`} />
                <AvatarFallback className="bg-slate-100 dark:bg-slate-700 text-xl font-semibold text-slate-700 dark:text-slate-300">
                  {getInitials(state.firstName, state.lastName)}
                </AvatarFallback>
              </Avatar>
              <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{state.headline || "Add a short professional headline."}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <input
              ref={avatarInputRef}
              id="profile-avatar-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadAvatar(file);
              }}
            />
            {avatarUploading ? (
              <div className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-600 dark:text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                Uploading…
              </div>
            ) : (
              <label
                htmlFor="profile-avatar-upload"
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-white dark:hover:bg-slate-700/50"
              >
                <Upload className="size-4" />
                Upload Photo
              </label>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl"
              disabled={!state.avatarUrl || avatarUploading}
              onClick={() => void removeAvatar()}
            >
              Remove Photo
            </Button>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium">Profile Completion</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{profileCompletion}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${profileCompletion}%` }} />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Summary Visibility</p>
            <Select
              value={state.visibility.summary}
              onValueChange={(value) =>
                setState((prev) => ({
                  ...prev,
                  visibility: { ...prev.visibility, summary: value as ProfileVisibilityValue },
                }))
              }
            >
              <SelectTrigger className={`${PROFILE_VISIBILITY_SELECT_CLASS} w-full`}>
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent
                className={PROFILE_SELECT_CONTENT_CLASS}
                position="popper"
                side="top"
                align="start"
                sideOffset={6}
                avoidCollisions={false}
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-5">
        <Card className={PROFILE_CARD_CLASS}>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <CardTitle className="[font-family:var(--font-space-grotesk)] text-xl tracking-tight text-slate-900 dark:text-slate-100">Profile Information</CardTitle>
            <CardDescription className="leading-relaxed text-slate-500 dark:text-slate-400">
              Update your identity, contact details, and bio shown across your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:[&>*]:min-w-0">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">First Name</p>
                <Input
                  className={PROFILE_INPUT_CLASS}
                  placeholder="First name"
                  value={state.firstName}
                  onChange={(event) => setState((prev) => ({ ...prev, firstName: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Last Name</p>
                <Input
                  className={PROFILE_INPUT_CLASS}
                  placeholder="Last name"
                  value={state.lastName}
                  onChange={(event) => setState((prev) => ({ ...prev, lastName: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Headline</p>
                <Input
                  className={PROFILE_INPUT_CLASS}
                  placeholder="Headline"
                  value={state.headline}
                  onChange={(event) => setState((prev) => ({ ...prev, headline: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Phone</p>
                <Input
                  className={PROFILE_INPUT_CLASS}
                  placeholder="Phone"
                  value={state.phone}
                  onChange={(event) => setState((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
              <div className="space-y-1 md:max-w-sm">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Location</p>
                <Select
                  value={normalizedLocation}
                  onValueChange={(value) => setState((prev) => ({ ...prev, location: value }))}
                >
                  <SelectTrigger className={`${PROFILE_SELECT_CLASS} w-full`}>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent
                    className="max-h-56 overflow-y-auto"
                    position="popper"
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    avoidCollisions={false}
                  >
                    {locationOptions.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Bio</p>
              <Textarea
                className={`min-h-[120px] ${PROFILE_TEXTAREA_CLASS}`}
                placeholder="Short bio"
                value={state.bio}
                onChange={(event) => setState((prev) => ({ ...prev, bio: event.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className={PROFILE_CARD_CLASS}>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <CardTitle className="[font-family:var(--font-space-grotesk)] text-lg tracking-tight text-slate-900 dark:text-slate-100">Social Links</CardTitle>
            <CardDescription className="leading-relaxed text-slate-500 dark:text-slate-400">
              Use full URLs, for example `https://github.com/username`.
            </CardDescription>
            <div className="pt-2">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Links Visibility</p>
              <Select
                value={state.visibility.links}
                onValueChange={(value) =>
                  setState((prev) => ({
                    ...prev,
                    visibility: { ...prev.visibility, links: value as ProfileVisibilityValue },
                  }))
                }
              >
                <SelectTrigger className={`${PROFILE_VISIBILITY_SELECT_CLASS} w-full md:w-60`}>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent
                  className={PROFILE_SELECT_CONTENT_CLASS}
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  avoidCollisions={false}
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              className={PROFILE_INPUT_CLASS}
              placeholder="GitHub URL"
              value={state.githubUrl}
              onChange={(event) => setState((prev) => ({ ...prev, githubUrl: event.target.value }))}
            />
            <Input
              className={PROFILE_INPUT_CLASS}
              placeholder="LinkedIn URL"
              value={state.linkedinUrl}
              onChange={(event) => setState((prev) => ({ ...prev, linkedinUrl: event.target.value }))}
            />
            <Input
              className={PROFILE_INPUT_CLASS}
              placeholder="Twitter URL"
              value={state.twitterUrl}
              onChange={(event) => setState((prev) => ({ ...prev, twitterUrl: event.target.value }))}
            />
            <Input
              className={PROFILE_INPUT_CLASS}
              placeholder="Website URL"
              value={state.websiteUrl}
              onChange={(event) => setState((prev) => ({ ...prev, websiteUrl: event.target.value }))}
            />
          </CardContent>
        </Card>

        <Card className={PROFILE_CARD_CLASS}>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <CardTitle className="[font-family:var(--font-space-grotesk)] text-lg tracking-tight text-slate-900 dark:text-slate-100">Skills</CardTitle>
            <CardDescription className="leading-relaxed text-slate-500 dark:text-slate-400">Add skills one-by-one or comma separated.</CardDescription>
            <div className="pt-2">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Skills Visibility</p>
              <Select
                value={state.visibility.skills}
                onValueChange={(value) =>
                  setState((prev) => ({
                    ...prev,
                    visibility: { ...prev.visibility, skills: value as ProfileVisibilityValue },
                  }))
                }
              >
                <SelectTrigger className={`${PROFILE_VISIBILITY_SELECT_CLASS} w-full md:w-60`}>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent
                  className={PROFILE_SELECT_CONTENT_CLASS}
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  avoidCollisions={false}
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className={PROFILE_INPUT_CLASS}
                placeholder="e.g. React, Mentoring, Product Strategy"
                value={skillDraft}
                onChange={(event) => setSkillDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addSkill(skillDraft);
                  }
                }}
              />
              <Button type="button" className="gap-2" onClick={() => addSkill(skillDraft)}>
                <Plus className="size-4" />
                Add Skill
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {state.skills.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No skills added yet.</p>
              ) : (
                state.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-2 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 px-3 py-1 text-xs font-medium text-sky-900 dark:text-sky-400"
                  >
                    {skill}
                    <button
                      type="button"
                      aria-label={`Remove ${skill}`}
                      className="rounded-full text-sky-800 dark:text-sky-400 transition-colors hover:text-sky-950 dark:hover:text-sky-200"
                      onClick={() => removeSkill(skill)}
                    >
                      x
                    </button>
                  </span>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={PROFILE_CARD_CLASS}>
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 [font-family:var(--font-space-grotesk)] text-lg text-slate-900 dark:text-slate-100">
                <GraduationCap className="size-5 text-sky-700 dark:text-sky-400" />
                Education
              </CardTitle>
              <CardDescription>Add schools and certifications using clear fields.</CardDescription>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2">
              <Select
                value={state.visibility.education}
                onValueChange={(value) =>
                  setState((prev) => ({
                    ...prev,
                    visibility: { ...prev.visibility, education: value as ProfileVisibilityValue },
                  }))
                }
              >
                <SelectTrigger className={`${PROFILE_VISIBILITY_SELECT_CLASS} w-full [&>span]:truncate`}>
                  <SelectValue placeholder="Visibility" />
                </SelectTrigger>
                <SelectContent
                  className={PROFILE_SELECT_CONTENT_CLASS}
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  avoidCollisions={false}
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => setState((prev) => ({ ...prev, education: [...prev.education, emptyEducation()] }))}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.education.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 p-4 text-sm text-slate-600 dark:text-slate-400">
                No education entries yet.
              </div>
            ) : (
              state.education.map((item, index) => (
                <div key={item.id} className={PROFILE_PANEL_CLASS}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Education {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-700"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          education: prev.education.filter((entry) => entry.id !== item.id),
                        }))
                      }
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input
                      className={PROFILE_INPUT_CLASS}
                      placeholder="School"
                      value={item.school}
                      onChange={(event) => updateEducation(item.id, { school: event.target.value })}
                    />
                    <Input
                      className={PROFILE_INPUT_CLASS}
                      placeholder="Degree"
                      value={item.degree}
                      onChange={(event) => updateEducation(item.id, { degree: event.target.value })}
                    />
                    <Input
                      className={PROFILE_INPUT_CLASS}
                      placeholder="Field of study"
                      value={item.fieldOfStudy}
                      onChange={(event) => updateEducation(item.id, { fieldOfStudy: event.target.value })}
                    />
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={item.isCurrent}
                        onChange={(event) =>
                          updateEducation(item.id, {
                            isCurrent: event.target.checked,
                            endDate: event.target.checked ? "" : item.endDate,
                          })
                        }
                      />
                      Currently studying
                    </label>
                    <DateInput
                      type="date"
                      placeholder="Start date"
                      value={item.startDate}
                      onChange={(event) => updateEducation(item.id, { startDate: event.target.value })}
                    />
                    <DateInput
                      type="date"
                      placeholder="End date"
                      value={item.endDate}
                      disabled={item.isCurrent}
                      onChange={(event) => updateEducation(item.id, { endDate: event.target.value })}
                    />
                  </div>
                  <Textarea
                    className={`mt-3 min-h-[90px] ${PROFILE_TEXTAREA_CLASS}`}
                    placeholder="Description"
                    value={item.description}
                    onChange={(event) => updateEducation(item.id, { description: event.target.value })}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={PROFILE_CARD_CLASS}>
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 [font-family:var(--font-space-grotesk)] text-lg text-slate-900 dark:text-slate-100">
                <Briefcase className="size-5 text-sky-700 dark:text-sky-400" />
                Experience
              </CardTitle>
              <CardDescription>Add your work history with structured fields.</CardDescription>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2">
              <Select
                value={state.visibility.experience}
                onValueChange={(value) =>
                  setState((prev) => ({
                    ...prev,
                    visibility: { ...prev.visibility, experience: value as ProfileVisibilityValue },
                  }))
                }
              >
                <SelectTrigger className={`${PROFILE_VISIBILITY_SELECT_CLASS} w-full [&>span]:truncate`}>
                  <SelectValue placeholder="Visibility" />
                </SelectTrigger>
                <SelectContent
                  className={PROFILE_SELECT_CONTENT_CLASS}
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  avoidCollisions={false}
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => setState((prev) => ({ ...prev, experience: [...prev.experience, emptyExperience()] }))}
              >
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.experience.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 p-4 text-sm text-slate-600 dark:text-slate-400">
                No experience entries yet.
              </div>
            ) : (
              state.experience.map((item, index) => (
                <div key={item.id} className={PROFILE_PANEL_CLASS}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Experience {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-700"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          experience: prev.experience.filter((entry) => entry.id !== item.id),
                        }))
                      }
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input
                      className={PROFILE_INPUT_CLASS}
                      placeholder="Company"
                      value={item.company}
                      onChange={(event) => updateExperience(item.id, { company: event.target.value })}
                    />
                    <Input
                      className={PROFILE_INPUT_CLASS}
                      placeholder="Title"
                      value={item.title}
                      onChange={(event) => updateExperience(item.id, { title: event.target.value })}
                    />
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={item.isCurrent}
                        onChange={(event) =>
                          updateExperience(item.id, {
                            isCurrent: event.target.checked,
                            endDate: event.target.checked ? "" : item.endDate,
                          })
                        }
                      />
                      Current role
                    </label>
                    <div />
                    <DateInput
                      type="date"
                      placeholder="Start date"
                      value={item.startDate}
                      onChange={(event) => updateExperience(item.id, { startDate: event.target.value })}
                    />
                    <DateInput
                      type="date"
                      placeholder="End date"
                      value={item.endDate}
                      disabled={item.isCurrent}
                      onChange={(event) => updateExperience(item.id, { endDate: event.target.value })}
                    />
                  </div>
                  <Textarea
                    className={`mt-3 min-h-[90px] ${PROFILE_TEXTAREA_CLASS}`}
                    placeholder="Description"
                    value={item.description}
                    onChange={(event) => updateExperience(item.id, { description: event.target.value })}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end pt-1">
          <Button disabled={saving} onClick={() => void save()} className="min-w-44 rounded-xl shadow-sm">
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
