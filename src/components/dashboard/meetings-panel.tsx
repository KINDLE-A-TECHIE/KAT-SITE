"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Radio, RefreshCcw, Search, Users, Video } from "lucide-react";
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
  dailyRoomUrl: string;
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
const AUTO_RECORD_ROLES: UserRoleValue[] = ["STUDENT", "FELLOW"];
const RECORDING_VIEW_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN"];
const COLUMN_META = {
  live: {
    label: "Live",
    tone: "from-emerald-500 to-teal-400",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  upcoming: {
    label: "Upcoming",
    tone: "from-blue-600 to-cyan-500",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  ended: {
    label: "Ended",
    tone: "from-slate-600 to-slate-500",
    chip: "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300",
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
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [recordingLibrary, setRecordingLibrary] = useState<Meeting[]>([]);
  const [contacts, setContacts] = useState<ProfilePreviewContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordingLibraryLoading, setRecordingLibraryLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recordingSyncingId, setRecordingSyncingId] = useState<string | null>(null);

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
  const canSyncRecordings = role === "SUPER_ADMIN";
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

  const requiresAutoRecording = useMemo(() => {
    if (AUTO_RECORD_ROLES.includes(role)) {
      return true;
    }
    return selectedParticipants.some((participantId) => {
      const participantRole = contactsById.get(participantId)?.role;
      return participantRole === "STUDENT" || participantRole === "FELLOW";
    });
  }, [contactsById, role, selectedParticipants]);

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

  const syncMeetingRecording = useCallback(
    async (meetingId: string) => {
      setRecordingSyncingId(meetingId);
      try {
        const response = await fetch("/api/meetings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingId,
            syncRecording: true,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          toast.error(payload?.error ?? "Could not sync recording.");
          return;
        }
        const status = payload?.meeting?.recordingStatus as MeetingRecordingStatusValue | undefined;
        if (status === "AVAILABLE") {
          toast.success("Recording is ready.");
        } else if (status === "FAILED") {
          toast.error("Recording not found yet.");
        } else {
          toast.message("Recording is still processing.");
        }
        await loadMeetings();
        if (canViewRecordingLibrary) {
          await loadRecordingLibrary();
        }
      } finally {
        setRecordingSyncingId(null);
      }
    },
    [canViewRecordingLibrary, loadMeetings, loadRecordingLibrary],
  );

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["live", "upcoming", "ended"] as const).map((key) => {
          const Icon = key === "live" ? Radio : key === "upcoming" ? CalendarClock : Video;
          return (
            <div
              key={key}
              className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.55)] dark:border-slate-700 dark:bg-slate-800/90"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-white ${COLUMN_META[key].tone}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{COLUMN_META[key].label}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COLUMN_META[key].chip}`}>
                  {grouped[key].length}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {canHost ? (
        <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.5)] sm:p-5 dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mb-4 flex items-center gap-3">
            <div className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <CalendarClock className="size-5" />
            </div>
            <div>
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
                Schedule a Learning Session
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Set the title, date/time, participants, and recording policy for your next class.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Session Title</p>
              <Input
                className="h-11 border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
                placeholder="e.g. Python Mission Lab"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Start Date and Time</p>
                <DateInput
                  type="datetime-local"
                  placeholder="Select start date & time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">End Date and Time</p>
                <DateInput
                  type="datetime-local"
                  placeholder="Select end date & time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Description (Optional)</p>
              <Input
                className="h-11 border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
                placeholder="Add context for participants"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          {canDiscoverBySkill ? (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Participant Discovery</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  className="border-slate-300 bg-slate-50 pl-9 dark:border-slate-600 dark:bg-slate-800"
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
              <SelectTrigger className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
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
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Add Participants</p>
              {contactsLoading ? (
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-28 w-full rounded-xl" />
                </div>
              ) : participantOptions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
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

          <div className="mt-4 flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
            {selectedParticipants.map((participantId) => {
              const participant = contactsById.get(participantId);
              return (
                <button
                  key={participantId}
                  type="button"
                  className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  onClick={() => removeParticipant(participantId)}
                >
                  {participant ? `${participant.firstName} ${participant.lastName}` : participantId} x
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {requiresAutoRecording
                ? "This meeting is marked AUTO_REQUIRED. Ensure Zoho host settings have automatic recording enabled (or start recording manually at session start)."
                : "This meeting will use manual recording mode."}
            </p>
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
              className="flex flex-col rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.5)] dark:border-slate-700 dark:bg-slate-900/95"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-white ${COLUMN_META[key].tone}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
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
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    No {key} meetings.
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
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/70"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="break-words font-medium text-slate-900 dark:text-slate-100">{meeting.title}</p>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {meeting.status}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-xs text-slate-600 dark:text-slate-400">
                          {new Date(meeting.startTime).toLocaleString()} - {new Date(meeting.endTime).toLocaleString()}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Users className="size-3.5" />
                          {meeting.participants.length} participant(s)
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {recordingModeLabel(meeting.recordingMode)}
                          </span>
                          <span
                            className={
                              meeting.recordingStatus === "AVAILABLE"
                                ? "rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : meeting.recordingStatus === "FAILED"
                                  ? "rounded-full bg-rose-100 px-2 py-1 text-[11px] text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                                  : "rounded-full bg-amber-100 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            }
                          >
                            {recordingStatusLabel(meeting.recordingStatus)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={
                              meeting.host.id === userId
                                ? "inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-[11px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                : "inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            }
                          >
                            {meeting.host.id === userId ? "Joining as host" : "Joining as attendee"}
                          </span>
                          <Button
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => window.open(meeting.dailyRoomUrl, "_blank", "noopener,noreferrer")}
                          >
                            Join
                          </Button>
                          {canWatchRecordings && recordingUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              onClick={() => window.open(recordingUrl, "_blank")}
                            >
                              Watch Recording
                            </Button>
                          ) : null}
                          {canSyncRecordings &&
                          meeting.status === "ENDED" &&
                          meeting.recordingMode === "AUTO_REQUIRED" &&
                          meeting.recordingStatus !== "AVAILABLE" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto"
                              disabled={recordingSyncingId === meeting.id}
                              onClick={() => void syncMeetingRecording(meeting.id)}
                            >
                              {recordingSyncingId === meeting.id ? "Syncing..." : "Sync Recording"}
                            </Button>
                          ) : null}
                          {canCancelMeeting(meeting) && meeting.status !== "ENDED" && meeting.status !== "CANCELLED" ? (
                            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => void cancelMeeting(meeting.id)}>
                              Cancel
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
        <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.5)] sm:p-5 dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">Recording Library</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
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
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                No ended meetings with recording mode found yet.
              </div>
            ) : (
              recordingLibrary.map((meeting) => {
                const recordingUrl = meeting.recordingPlayUrl ?? meeting.recordingDownloadUrl;
                return (
                  <div key={`recording-${meeting.id}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{meeting.title}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Host: {meeting.host.firstName} {meeting.host.lastName}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {new Date(meeting.startTime).toLocaleString()} - {new Date(meeting.endTime).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        {meeting.status}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        {recordingModeLabel(meeting.recordingMode)}
                      </span>
                      <span
                        className={
                          meeting.recordingStatus === "AVAILABLE"
                            ? "rounded-full bg-emerald-100 px-2 py-1 text-[11px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : meeting.recordingStatus === "FAILED"
                              ? "rounded-full bg-rose-100 px-2 py-1 text-[11px] text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                              : "rounded-full bg-amber-100 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                        }
                      >
                        {recordingStatusLabel(meeting.recordingStatus)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={
                          meeting.host.id === userId
                            ? "inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-[11px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            : "inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        }
                      >
                        {meeting.host.id === userId ? "Joining as host" : "Joining as attendee"}
                      </span>
                      {recordingUrl ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => window.open(recordingUrl, "_blank")}
                        >
                          Watch Recording
                        </Button>
                      ) : null}
                      {canSyncRecordings &&
                      meeting.recordingMode === "AUTO_REQUIRED" &&
                      meeting.recordingStatus !== "AVAILABLE" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={recordingSyncingId === meeting.id}
                          onClick={() => void syncMeetingRecording(meeting.id)}
                        >
                          {recordingSyncingId === meeting.id ? "Syncing..." : "Sync Recording"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
