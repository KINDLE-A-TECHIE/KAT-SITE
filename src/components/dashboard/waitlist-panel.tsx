"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, Trash2, Download, RefreshCw, Users, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type WaitlistEntry = {
  id: string;
  email: string;
  createdAt: string;
  notifiedAt: string | null;
};

type ApiResponse = {
  entries: WaitlistEntry[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
};

type Cohort = {
  id: string;
  name: string;
  program: { name: string } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function WaitlistPanel() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState("");
  const [notifying, setNotifying] = useState(false);
  const unnotified = entries.filter((e) => !e.notifiedAt).length;

  const load = useCallback(async (cursor?: string, q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (cursor) params.set("cursor", cursor);
      if (q) params.set("search", q);
      const res = await fetch(`/api/waitlist/admin?${params}`);
      if (!res.ok) { toast.error("Failed to load waitlist."); return; }
      const data = await res.json() as ApiResponse;
      setEntries(cursor ? (prev) => [...prev, ...data.entries] : data.entries);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(undefined, search); }, [load, search]);

  const openNotifyDialog = async () => {
    if (cohorts.length === 0) {
      const res = await fetch("/api/cohorts?limit=50");
      if (res.ok) {
        const data = await res.json() as { cohorts: Cohort[] };
        setCohorts(data.cohorts ?? []);
      }
    }
    setNotifyOpen(true);
  };

  const handleNotify = async () => {
    if (!selectedCohort) { toast.error("Select a cohort first."); return; }
    setNotifying(true);
    try {
      const res = await fetch("/api/waitlist/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId: selectedCohort }),
      });
      const data = await res.json() as { sent?: number; total?: number; message?: string; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to send notifications."); return; }
      toast.success(data.message ?? `Sent to ${data.sent} of ${data.total} waitlist entries.`);
      setNotifyOpen(false);
      setSelectedCohort("");
      void load(undefined, search);
    } finally {
      setNotifying(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleDelete = async (entry: WaitlistEntry) => {
    if (!confirm(`Remove ${entry.email} from the waitlist?`)) return;
    setDeleting(entry.id);
    try {
      const res = await fetch("/api/waitlist/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });
      if (!res.ok) { toast.error("Failed to remove entry."); return; }
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setTotal((prev) => prev - 1);
      toast.success(`${entry.email} removed.`);
    } finally {
      setDeleting(null);
    }
  };

  const handleExport = () => {
    const csv = ["Email,Signed Up,Notified"]
      .concat(
        entries.map((e) =>
          `${e.email},${formatDate(e.createdAt)},${e.notifiedAt ? formatDate(e.notifiedAt) : "No"}`
        )
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kat-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="kat-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-slate-900 dark:text-slate-100">
                Waitlist
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {total} {total === 1 ? "person" : "people"} waiting
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(undefined, search)}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={entries.length === 0}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => void openNotifyDialog()}
              disabled={total === 0}
              className="bg-[#1E5FAF] text-white hover:bg-[#1a52a0]"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Notify Waitlist
              {unnotified > 0 && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                  {unnotified}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">Search</Button>
          {search && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setSearch(""); setSearchInput(""); }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="kat-card overflow-hidden p-0">
        {loading && entries.length === 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <div className="h-4 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {search ? "No results matching your search." : "No one on the waitlist yet."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              {/* Column headers */}
              <div className="grid min-w-[440px] grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Signed Up</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notified</p>
                <p className="w-8" />
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid min-w-[440px] grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {entry.email}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </p>
                    <p className="whitespace-nowrap">
                      {entry.notifiedAt ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {formatDate(entry.notifiedAt)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          Not yet
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => void handleDelete(entry)}
                      disabled={deleting === entry.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 dark:hover:bg-rose-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-sm"
                  disabled={loading}
                  onClick={() => void load(nextCursor ?? undefined, search)}
                >
                  {loading ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {/* Notify dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notify Waitlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select a cohort to notify. An email will be sent to all
              <strong> {unnotified} un-notified</strong> waitlist entries.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Cohort
              </label>
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select a cohort…</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.program ? ` — ${c.program.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>Cancel</Button>
            <Button
              onClick={() => void handleNotify()}
              disabled={!selectedCohort || notifying}
              className="bg-[#1E5FAF] text-white hover:bg-[#1a52a0]"
            >
              {notifying ? "Sending…" : `Send to ${unnotified} people`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
