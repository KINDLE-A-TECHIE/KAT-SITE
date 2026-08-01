"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, RotateCcw, Trash2, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Module = { id: string; title: string; termNumber: number };
type Member = { userId: string; name: string };
type RosterEntry = { userId: string; name: string; assigned: boolean };
type Team = {
  id: string;
  name: string;
  status: "FORMING" | "APPROVED" | "NEEDS_WORK";
  submissionNote: string | null;
  submissionUrl: string | null;
  reviewNote: string | null;
  reviewedByName: string | null;
  approvedAt: string | null;
  members: Member[];
};

const STATUS_BADGE: Record<Team["status"], { label: string; className: string }> = {
  FORMING: { label: "Forming", className: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300" },
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  NEEDS_WORK: { label: "Needs work", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
};

/**
 * Teacher-driven project TEAMS for one CODING unit of a class. KAT sets the project brief; the teacher
 * groups pupils, records the build, and approves it. Approving a team passes that unit's project gate
 * (report-only) for every member. Teamwork is the point, so a pupil sits on one team per unit.
 */
export function ProjectTeamsPanel({ classId, modules }: { classId: string; modules: Module[] }) {
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [teams, setTeams] = useState<Team[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  const unassigned = useMemo(() => roster.filter((r) => !r.assigned), [roster]);

  const load = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    // no-store: after every mutation we reload, and a cached GET would show the pre-change state.
    const res = await fetch(
      `/api/school/teach/project-teams?classId=${encodeURIComponent(classId)}&moduleId=${encodeURIComponent(moduleId)}`,
      { cache: "no-store" },
    );
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not load project teams.");
      return;
    }
    setTeams(payload.teams ?? []);
    setRoster(payload.roster ?? []);
  }, [classId, moduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>, tag: string, okMsg: string) => {
    setBusy(tag);
    const res = await fetch("/api/school/teach/project-teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not update project teams.");
      return false;
    }
    toast.success(okMsg);
    await load();
    return true;
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    if (await post({ action: "create", classId, moduleId, name }, "create", "Team created.")) setNewName("");
  };

  if (modules.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-orange-600" /> Project teams
            </CardTitle>
            <CardDescription>
              Group pupils to build the unit&apos;s project together. Approving a team records the project
              gate for every member.
            </CardDescription>
          </div>
          {modules.length > 1 ? (
            <label className="text-xs text-stone-600 dark:text-stone-300">
              Unit
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="mt-0.5 block rounded-md border border-stone-200 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900"
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    Term {m.termNumber}: {m.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : (
          <>
            {teams.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No teams yet for this unit. Create one below and add pupils to it.
              </p>
            ) : (
              <ul className="space-y-3">
                {teams.map((team) => {
                  const badge = STATUS_BADGE[team.status];
                  return (
                    <li
                      key={team.id}
                      className="rounded-lg border border-stone-200 p-3 dark:border-stone-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 font-medium text-stone-900 dark:text-stone-100">
                          {team.name}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.className}`}>
                            {badge.label}
                          </span>
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === `del:${team.id}`}
                          onClick={() => void post({ action: "delete", teamId: team.id }, `del:${team.id}`, "Team deleted.")}
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                        >
                          {busy === `del:${team.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        </Button>
                      </div>

                      {/* Members */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {team.members.length === 0 ? (
                          <span className="text-xs text-stone-400">No members yet.</span>
                        ) : (
                          team.members.map((m) => (
                            <span
                              key={m.userId}
                              className="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-2.5 pr-1 text-xs text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                            >
                              {m.name}
                              <button
                                type="button"
                                aria-label={`Remove ${m.name}`}
                                disabled={busy === `rm:${team.id}:${m.userId}`}
                                onClick={() =>
                                  void post(
                                    { action: "removeMember", teamId: team.id, userId: m.userId },
                                    `rm:${team.id}:${m.userId}`,
                                    "Pupil removed.",
                                  )
                                }
                                className="rounded-full p-0.5 text-stone-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              >
                                <UserMinus className="size-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      {/* Add a pupil (only those not already on a team for this unit) */}
                      {unassigned.length > 0 ? (
                        <div className="mt-2">
                          <label className="sr-only" htmlFor={`add-${team.id}`}>
                            Add a pupil to {team.name}
                          </label>
                          <select
                            id={`add-${team.id}`}
                            value=""
                            disabled={busy === `add:${team.id}`}
                            onChange={(e) => {
                              const userId = e.target.value;
                              if (userId)
                                void post(
                                  { action: "addMember", teamId: team.id, userId },
                                  `add:${team.id}`,
                                  "Pupil added.",
                                );
                            }}
                            className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs dark:border-stone-700 dark:bg-stone-900"
                          >
                            <option value="">+ Add a pupil…</option>
                            {unassigned.map((r) => (
                              <option key={r.userId} value={r.userId}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      {team.reviewNote ? (
                        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                          Note: {team.reviewNote}
                          {team.reviewedByName ? ` (${team.reviewedByName})` : ""}
                        </p>
                      ) : null}

                      {/* Review controls */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                        <input
                          type="text"
                          value={reviewNote[team.id] ?? ""}
                          onChange={(e) => setReviewNote((s) => ({ ...s, [team.id]: e.target.value }))}
                          placeholder="Feedback (optional)"
                          className="min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs dark:border-stone-700 dark:bg-stone-900"
                        />
                        {team.status === "APPROVED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === `rev:${team.id}` || team.members.length === 0}
                            onClick={() =>
                              void post(
                                { action: "review", teamId: team.id, status: "NEEDS_WORK", reviewNote: reviewNote[team.id] || undefined },
                                `rev:${team.id}`,
                                "Approval withdrawn.",
                              )
                            }
                            className="gap-1.5"
                          >
                            <RotateCcw className="size-3.5" /> Withdraw
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === `rev:${team.id}`}
                              onClick={() =>
                                void post(
                                  { action: "review", teamId: team.id, status: "NEEDS_WORK", reviewNote: reviewNote[team.id] || undefined },
                                  `rev:${team.id}`,
                                  "Marked needs work.",
                                )
                              }
                            >
                              Needs work
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5"
                              disabled={busy === `rev:${team.id}` || team.members.length === 0}
                              onClick={() =>
                                void post(
                                  { action: "review", teamId: team.id, status: "APPROVED", reviewNote: reviewNote[team.id] || undefined },
                                  `rev:${team.id}`,
                                  "Team approved.",
                                )
                              }
                            >
                              {busy === `rev:${team.id}` ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3.5" />
                              )}
                              Approve
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Create a new team */}
            <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-4 dark:border-stone-800">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void create();
                }}
                placeholder="New team name (e.g. Team Ada)"
                className="min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
              <Button size="sm" className="gap-1.5" disabled={busy === "create" || !newName.trim()} onClick={() => void create()}>
                {busy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Add team
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
