"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Download, Radio, RefreshCcw, Search, Users, Video, X } from "lucide-react";
import { toast } from "sonner";
import { ProfilePreviewCard, type ProfilePreviewContact } from "@/components/dashboard/profile-preview-card";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  MeetingRecordingModeValue,
  MeetingRecordingStatusValue,
  MeetingStatusValue,
  UserRoleValue,
} from "@/lib/enums";

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  status: MeetingStatusValue;
  recordingMode: MeetingRecordingModeValue;
  recordingStatus: MeetingRecordingStatusValue;
  recordingPlayUrl: string | null;
  recordingDownloadUrl: string | null;
  recordingSyncedAt: string | null;
  roomUrl: string;
  host: { id: string; firstName: string; lastName: string };
  participants: {
    user: { id: string; firstName: string; lastName: string; role: UserRoleValue };
  }[];
};

type MeetingsPanelProps = {
  role: UserRoleValue;
  userId: string;
};

const HOST_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR", "FELLOW"];
const SKILL_DISCOVERY_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];
const RECORDING_VIEW_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN"];
// Flat column tones on the warm palette: pine = live, clay = upcoming, stone = ended.
const COLUMN_META = {
  live: {
    label: "Live",
    tone: "bg-kat-pine",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    accent: "border-l-[var(--kat-pine)]",
    emptyIcon: Radio,
    emptyLabel: "No live sessions right now.",
  },
  upcoming: {
    label: "Upcoming",
    tone: "bg-kat-clay",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    accent: "border-l-[var(--kat-clay)]",
    emptyIcon: CalendarClock,
    emptyLabel: "No upcoming sessions scheduled.",
  },
  ended: {
    label: "Ended",
    tone: "bg-stone-500 dark:bg-stone-600",
    chip: "bg-stone-200 text-stone-700 dark:bg-stone-600 dark:text-stone-300",
    accent: "border-l-stone-300 dark:border-l-stone-600",
    emptyIcon: Video,
    emptyLabel: "No ended sessions yet.",
  },
} as const;

function recordingModeLabel(mode: MeetingRecordingModeValue) {
  if (mode === "AUTO_REQUIRED") {
    return "Auto recording required";
  }
  if (mode === "MANUAL") {
    return "Manual recording";
  }
  return "Recording off";
}

function recordingStatusLabel(status: MeetingRecordingStatusValue) {
  if (status === "AVAILABLE") {
    return "Recording ready";
  }
  if (status === "PENDING") {
    return "Recording processing";
  }
  if (status === "FAILED") {
    return "Recording missing";
  }
  return "Not requested";
}

export function MeetingsPanel({ role, userId }: MeetingsPanelProps) {
  const [activeColumn, setActiveColumn] = useState<"live" | "upcoming" | "ended">("upcoming");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [recordingLibrary, setRecordingLibrary] = useState<Meeting[]>([]);
  const [contacts, setContacts] = useState<ProfilePreviewContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordingLibraryLoading, setRecordingLibraryLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantPickerId, setParticipantPickerId] = useState("");
  const [skillQuery, setSkillQuery] = useState("");

  const canHost = HOST_ROLES.includes(role);
  const canDiscoverBySkill = SKILL_DISCOVERY_ROLES.includes(role);
  const canWatchRecordings = RECORDING_VIEW_ROLES.includes(role);
  const canViewRecordingLibrary = role === "SUPER_ADMIN";
  const canCancelMeeting = useCallback(
    (meeting: Meeting) => {
      if (role === "SUPER_ADMIN") {
        return true;
      }
      const isAdminOrInstructor = role === "ADMIN" || role === "INSTRUCTOR";
      return isAdminOrInstructor && meeting.host.id === userId;
    },
    [role, userId],
  );

  const grouped = useMemo(
    () => ({
      live: meetings.filter((meeting) => meeting.status === "LIVE"),
      upcoming: meetings.filter((meeting) => meeting.status === "UPCOMING"),
      ended: meetings.filter((meeting) => meeting.status === "ENDED"),
    }),
    [meetings],
  );

  const contactsById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);


  const participantOptions = useMemo(
    () => contacts.filter((contact) => !selectedParticipants.includes(contact.id)),
    [contacts, selectedParticipants],
  );

  const addParticipant = (participantId: string) => {
    setSelectedParticipants((previous) =>
      previous.includes(participantId) ? previous : [...previous, participantId],
    );
  };

  const removeParticipant = (participantId: string) => {
    setSelectedParticipants((previous) => previous.filter((id) => id !== participantId));
  };

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const meetingResponse = await fetch("/api/meetings");
      if (!meetingResponse.ok) {
        toast.error("Could not load meetings.");
        return;
      }
      const payload = await meetingResponse.json();
      setMeetings(payload.meetings ?? []);
    } catch {
      toast.error("Could not load meetings.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecordingLibrary = useCallback(async () => {
    if (!canViewRecordingLibrary) {
      setRecordingLibrary([]);
      return;
    }

    setRecordingLibraryLoading(true);
    try {
      const response = await fetch("/api/meetings?scope=recordings");
      if (!response.ok) {
        toast.error("Could not load recording library.");
        return;
      }
      const payload = await response.json();
      setRecordingLibrary(payload.meetings ?? []);
    } catch {
      toast.error("Could not load recording library.");
    } finally {
      setRecordingLibraryLoading(false);
    }
  }, [canViewRecordingLibrary]);

  const loadContacts = useCallback(
    async (skill: string) => {
      setContactsLoading(true);
      try {
        const search = skill.trim();
        const query = canDiscoverBySkill && search ? `?skill=${encodeURIComponent(search)}` : "";
        const response = await fetch(`/api/messages/contacts${query}`);
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        setContacts(payload.contacts ?? []);
      } catch {
        // Keep current contacts if discovery refresh fails.
      } finally {
        setContactsLoading(false);
      }
    },
    [canDiscoverBySkill],
  );

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    if (!canViewRecordingLibrary) {
      return;
    }
    void loadRecordingLibrary();
  }, [canViewRecordingLibrary, loadRecordingLibrary]);

  useEffect(() => {
    if (!canDiscoverBySkill) {
      void loadContacts("");
      return;
    }

    const handle = window.setTimeout(() => {
      void loadContacts(skillQuery);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [canDiscoverBySkill, loadContacts, skillQuery]);

  const createMeeting = async () => {
    if (!title || !startTime || !endTime || selectedParticipants.length === 0) {
      toast.error("Provide title, schedule, and at least one participant.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        participantIds: selectedParticipants,
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Could not create meeting.");
      return;
    }

    toast.success("Meeting created.");
    setTitle("");
    setDescription("");
    setStartTime("");
    setEndTime("");
    setSelectedParticipants([]);
    await loadMeetings();
  };

  const setRecordingMode = async (meetingId: string, recordingMode: MeetingRecordingModeValue) => {
    const response = await fetch("/api/meetings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, recordingMode }),
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload?.error ?? "Could not update recording mode.");
      return;
    }
    setMeetings((prev) =>
      prev.map((m) =>
        m.id === meetingId
          ? { ...m, recordingMode: (payload.meeting as Meeting).recordingMode, recordingStatus: (payload.meeting as Meeting).recordingStatus }
          : m,
      ),
    );
    toast.success("Recording mode updated.");
  };

  const removeMeeting = async (meetingId: string) => {
    const response = await fetch(`/api/meetings?meetingId=${meetingId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload?.error ?? "Could not remove meeting.");
      return;
    }
    toast.success("Meeting removed.");
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
  };

  const cancelMeeting = async (meetingId: string) => {
    const response = await fetch("/api/meetings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId,
        status: "CANCELLED",
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload?.error ?? "Could not cancel meeting.");
      return;
    }
    toast.success("Meeting cancelled.");
    await loadMeetings();
  };

  const joinMeeting = useCallback(async (meetingId: string) => {
    setJoiningId(meetingId);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/join`);
      const payload = await response.json();
      if (!response.ok || !payload?.joinUrl) {
        toast.error(payload?.error ?? "Could not get meeting join link.");
        return;
      }
      window.open(payload.joinUrl as string, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not get meeting join link.");
    } finally {
      setJoiningId(null);
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* Mobile tab switcher, hidden on xl where columns show side by side */}
      <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1 xl:hidden dark:border-stone-700 dark:bg-stone-800/50">
        {(["live", "upcoming", "ended"] as const).map((key) => {
          const Icon = key === "live" ? Radio : key === "upcoming" ? CalendarClock : Video;
          return (
            <button
              key={key}
              onClick={() => setActiveColumn(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition ${activeColumn === key ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100" : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"}`}
            >
              <Icon className="size-3.5" />
              {COLUMN_META[key].label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${COLUMN_META[key].chip}`}>
                {grouped[key].length}
              </span>
            </button>
          );
        })}
      </div>

      {canHost ? (
        <section className="rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-[0_18px_40px_-30px_rgba(26, 23, 20,0.5)] sm:p-5 dark:border-stone-700 dark:bg-stone-900/95">
          <div className="mb-4 flex items-center gap-3">
            <div className="inline-flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              <CalendarClock className="size-5" />
            </div>
            <div>
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-stone-900 dark:text-stone-100">
                Schedule a Learning Session
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Set the title, date/time, participants, and recording policy for your next class.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Session Title</p>
              <Input
                className="h-11 border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-800"
                placeholder="e.g. Python Mission Lab"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Start Date and Time</p>
                <DateInput
                  type="datetime-local"
                  placeholder="Select start date & time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">End Date and Time</p>
                <DateInput
                  type="datetime-local"
                  placeholder="Select end date & time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Description (Optional)</p>
              <Input
                className="h-11 border-stone-300 bg-stone-50 dark:border-stone-600 dark:bg-stone-800"
                placeholder="Add context for participants"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          {canDiscoverBySkill ? (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Participant Discovery</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                <Input
                  className="border-stone-300 bg-stone-50 pl-9 dark:border-stone-600 dark:bg-stone-800"
                  placeholder="Search contacts by skill"
                  value={skillQuery}
                  onChange={(event) => setSkillQuery(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3">
            <Select
              value={participantPickerId || undefined}
              onValueChange={(value) => {
                setParticipantPickerId(value);
                addParticipant(value);
                setParticipantPickerId("");
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border border-stone-300 bg-stone-50/70 px-3 text-sm text-stone-700 focus-visible:ring-2 focus-visible:ring-orange-200 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200">
                <SelectValue placeholder="Add participants" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto" position="popper" side="bottom" align="start" sideOffset={6}>
                {participantOptions.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName} ({contact.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canDiscoverBySkill ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Quick Add Participants</p>
              {contactsLoading ? (
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-28 w-full rounded-xl" />
                </div>
              ) : participantOptions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-3 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
                  No available contacts match this skill.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {participantOptions.slice(0, 6).map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className="w-full text-left transition-transform hover:-translate-y-0.5"
                        onClick={() => addParticipant(contact.id)}
                      >
                        <ProfilePreviewCard contact={contact} compact />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {selectedParticipants.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Selected ({selectedParticipants.length})
              </p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {selectedParticipants.map((participantId) => {
                  const participant = contactsById.get(participantId);
                  return (
                    <button
                      key={participantId}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 py-1 pl-3 pr-2 text-xs font-medium text-stone-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-stone-700 dark:bg-stone-700 dark:text-stone-300 dark:hover:border-rose-800 dark:hover:bg-rose-950 dark:hover:text-rose-300"
                      onClick={() => removeParticipant(participantId)}
                    >
                      {participant ? `${participant.firstName} ${participant.lastName}` : participantId}
                      <X className="size-3 opacity-60" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button className="w-full sm:min-w-44 sm:w-auto" disabled={busy} onClick={() => void createMeeting()}>
              {busy ? "Scheduling..." : "Schedule Session"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {(["live", "upcoming", "ended"] as const).map((key) => {
          const Icon = key === "live" ? Radio : key === "upcoming" ? CalendarClock : Video;
          const columnMeetings = grouped[key];
          return (
            <div
              key={key}
              className={`flex flex-col rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-[0_18px_40px_-30px_rgba(26, 23, 20,0.5)] dark:border-stone-700 dark:bg-stone-900/95 ${activeColumn === key ? "block" : "hidden xl:flex"}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`inline-flex size-8 items-center justify-center rounded-lg text-white ${COLUMN_META[key].tone}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-stone-900 dark:text-stone-100">
                    {COLUMN_META[key].label}
                  </h3>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COLUMN_META[key].chip}`}>
                  {columnMeetings.length}
                </span>
              </div>

               <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[62vh] xl:max-h-[560px]">
                {loading ? (
                  <>
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </>
                ) : columnMeetings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-4 py-10 text-center dark:border-stone-700 dark:bg-stone-800/30">
                    <Icon className="size-7 text-stone-300 dark:text-stone-600" />
                    <p className="text-sm text-stone-500 dark:text-stone-400">{COLUMN_META[key].emptyLabel}</p>
                  </div>
                ) : (
                  columnMeetings.map((meeting, index) => {
                    const recordingUrl = meeting.recordingPlayUrl ?? meeting.recordingDownloadUrl;

                    return (
                      <motion.article
                        key={meeting.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className={`rounded-xl border border-l-4 border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-800/80 ${COLUMN_META[key].accent}`}
                      >
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2">
                            {key === "live" && (
                              <span className="relative mt-1 flex shrink-0 size-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                              </span>
                            )}
                            <p className="break-words text-sm font-semibold leading-snug text-stone-900 dark:text-stone-100">
                              {meeting.title}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLUMN_META[key].chip}`}>
                            {meeting.status}
                          </span>
                        </div>

                        {/* Role badge */}
                        <div className="mt-1.5">
                          <span
                            className={
                              meeting.host.id === userId
                                ? "inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                                : "inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                            }
                          >
                            {meeting.host.id === userId ? "Host" : "Attendee"}
                          </span>
                        </div>

                        {/* Date/time + participants */}
                        <div className="mt-2.5 space-y-1">
                          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone-600 dark:text-stone-400">
                            <CalendarClock className="size-3.5 shrink-0 text-stone-400" />
                            <span>{new Date(meeting.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                            <span className="text-stone-300 dark:text-stone-600">·</span>
                            <span>{new Date(meeting.startTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} – {new Date(meeting.endTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                            <Users className="size-3.5 shrink-0 text-stone-400" />
                            {meeting.participants.length} participant{meeting.participants.length !== 1 ? "s" : ""}
                          </p>
                        </div>

                        {/* Recording chips */}
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                            {recordingModeLabel(meeting.recordingMode)}
                          </span>
                          {meeting.recordingStatus !== "NOT_REQUESTED" && (
                            <span
                              className={
                                meeting.recordingStatus === "AVAILABLE"
                                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                  : meeting.recordingStatus === "FAILED"
                                    ? "rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                                    : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                              }
                            >
                              {recordingStatusLabel(meeting.recordingStatus)}
                            </span>
                          )}
                        </div>

                        {/* Recording mode selector (super_admin) */}
                        {role === "SUPER_ADMIN" && (
                          <div className="mt-3 border-t border-stone-100 pt-3 dark:border-stone-700/60">
                            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">Recording Mode</p>
                            <Select
                              value={meeting.recordingMode}
                              onValueChange={(v) => void setRecordingMode(meeting.id, v as MeetingRecordingModeValue)}
                            >
                              <SelectTrigger className="h-8 w-full rounded-lg border-stone-200 bg-stone-50 text-xs dark:border-stone-700 dark:bg-stone-800 sm:w-52">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">No recording</SelectItem>
                                <SelectItem value="MANUAL">Manual recording</SelectItem>
                                <SelectItem value="AUTO_REQUIRED">Auto recording (Jibri)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Actions footer */}
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3 dark:border-stone-700/60">
                          {(meeting.status === "LIVE" || meeting.status === "UPCOMING") && (
                            <Button
                              size="sm"
                              className="h-8 flex-1 sm:flex-none"
                              disabled={joiningId === meeting.id}
                              onClick={() => void joinMeeting(meeting.id)}
                            >
                              {joiningId === meeting.id ? "Joining..." : meeting.status === "LIVE" ? "Join Now" : "Join"}
                            </Button>
                          )}
                          {canWatchRecordings && recordingUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 flex-1 sm:flex-none"
                              onClick={() => window.open(recordingUrl, "_blank")}
                            >
                              Watch
                            </Button>
                          ) : null}
                          {role === "SUPER_ADMIN" && meeting.recordingDownloadUrl ? (
                            <a href={meeting.recordingDownloadUrl} download>
                              <Button size="sm" variant="outline" className="h-8">
                                <Download className="size-3.5" />
                              </Button>
                            </a>
                          ) : null}
                          {canCancelMeeting(meeting) && meeting.status !== "ENDED" && meeting.status !== "CANCELLED" ? (
                            <Button size="sm" variant="outline" className="h-8 flex-1 sm:flex-none" onClick={() => void cancelMeeting(meeting.id)}>
                              Cancel
                            </Button>
                          ) : null}
                          {(meeting.status === "ENDED" || meeting.status === "CANCELLED") &&
                            (role === "SUPER_ADMIN" || ((role === "ADMIN" || role === "INSTRUCTOR") && meeting.host.id === userId)) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 sm:flex-none dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
                              onClick={() => void removeMeeting(meeting.id)}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </motion.article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </section>

      {canViewRecordingLibrary ? (
        <section className="rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-[0_18px_40px_-30px_rgba(26, 23, 20,0.5)] sm:p-5 dark:border-stone-700 dark:bg-stone-900/95">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-stone-900 dark:text-stone-100">Recording Library</h3>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Super admin view of organization-wide ended sessions and available recordings.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-center gap-2 sm:w-auto"
              onClick={() => void loadRecordingLibrary()}
              disabled={recordingLibraryLoading}
            >
              <RefreshCcw className={`size-4 ${recordingLibraryLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <div className="mt-3 space-y-3">
            {recordingLibraryLoading ? (
              <>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </>
            ) : recordingLibrary.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-4 py-10 text-center dark:border-stone-700 dark:bg-stone-800/30">
                <Video className="size-7 text-stone-300 dark:text-stone-600" />
                <p className="text-sm text-stone-500 dark:text-stone-400">No ended meetings with recordings found yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recordingLibrary.map((meeting) => {
                  const recordingUrl = meeting.recordingPlayUrl ?? meeting.recordingDownloadUrl;
                  return (
                    <div key={`recording-${meeting.id}`} className="flex flex-col rounded-xl border border-l-4 border-stone-200 border-l-stone-300 bg-white p-3 shadow-sm dark:border-stone-700 dark:border-l-stone-600 dark:bg-stone-800/80">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{meeting.title}</p>
                          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                            Host: {meeting.host.firstName} {meeting.host.lastName}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                          {meeting.status}
                        </span>
                      </div>

                      {/* Date/time */}
                      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone-600 dark:text-stone-400">
                        <CalendarClock className="size-3.5 shrink-0 text-stone-400" />
                        <span>{new Date(meeting.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span className="text-stone-300 dark:text-stone-600">·</span>
                        <span>{new Date(meeting.startTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} – {new Date(meeting.endTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                      </p>

                      {/* Recording chips */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                          {recordingModeLabel(meeting.recordingMode)}
                        </span>
                        <span
                          className={
                            meeting.recordingStatus === "AVAILABLE"
                              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : meeting.recordingStatus === "FAILED"
                                ? "rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                                : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          }
                        >
                          {recordingStatusLabel(meeting.recordingStatus)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3 dark:border-stone-700/60">
                        {recordingUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1 sm:flex-none"
                            onClick={() => window.open(recordingUrl, "_blank")}
                          >
                            Watch
                          </Button>
                        ) : null}
                        {meeting.recordingDownloadUrl ? (
                          <a href={meeting.recordingDownloadUrl} download>
                            <Button size="sm" variant="outline" className="h-8">
                              <Download className="size-3.5" />
                            </Button>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
