"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Check, Copy, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PROGRAM_LEVEL_COLOR, PROGRAM_LEVEL_LABEL } from "@/lib/enums";
import { PaginationControls } from "@/components/pagination-controls";
import { UserSearchPicker } from "@/components/user-search-picker";
import type { UserRoleValue } from "@/lib/enums";

type CertStatus = "PENDING" | "APPROVED" | "REJECTED";

type Certificate = {
  id: string;
  credentialId: string;
  issuedAt: string;
  status: CertStatus;
  approvedAt?: string | null;
  rejectionNote?: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
  program: { id: string; name: string; level: string };
  issuedBy: { id: string; firstName: string; lastName: string };
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
};

type Program = { id: string; name: string; level: string };

const STATUS_STYLE: Record<CertStatus, string> = {
  PENDING:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
};

const STATUS_LABEL: Record<CertStatus, string> = {
  PENDING:  "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const FILTER_TABS = [
  { value: "",         label: "All"      },
  { value: "PENDING",  label: "Pending"  },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CertificatesPanel({ role }: { role: UserRoleValue }) {
  const canIssue     = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(role);
  const canRevoke    = ["SUPER_ADMIN", "ADMIN"].includes(role);
  const canApprove   = role === "SUPER_ADMIN";
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | "PENDING" | "APPROVED" | "REJECTED">("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [issueOpen, setIssueOpen] = useState(false);

  // Issue form
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [issuing, setIssuing] = useState(false);

  // Revoke
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Reject
  const [rejectTarget, setRejectTarget] = useState<Certificate | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const fetchCerts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (canIssue && statusFilter) params.set("status", statusFilter);
    params.set("page", String(page));
    const res = await fetch(`/api/certificates?${params.toString()}`);
    if (res.ok) {
      const data = await res.json() as { certificates: Certificate[]; page?: number; totalPages?: number; total?: number };
      setCerts(data.certificates);
      setMeta({ page: data.page ?? 1, totalPages: data.totalPages ?? 1, total: data.total ?? data.certificates.length });
    }
    setLoading(false);
  };

  // Re-fetch whenever the status filter or page changes
  useEffect(() => { void fetchCerts(); }, [statusFilter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const openIssue = async () => {
    setIssueOpen(true);
    if (programs.length === 0) {
      const pr = await fetch("/api/programs").then(r => r.ok ? r.json() as Promise<{ programs: Program[] }> : { programs: [] });
      setPrograms(pr.programs ?? []);
    }
  };

  const issueCertificate = async () => {
    if (!selectedUser || !selectedProgram) {
      toast.error("Please select a student and a programme.");
      return;
    }
    setIssuing(true);
    const res = await fetch("/api/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUser, programId: selectedProgram }),
    });
    setIssuing(false);
    if (res.ok) {
      toast.success(isSuperAdmin ? "Certificate issued successfully." : "Certificate request submitted for approval.");
      setIssueOpen(false);
      setSelectedUser("");
      setSelectedName("");
      setSelectedProgram("");
      void fetchCerts();
    } else {
      const err = await res.json() as { error?: string };
      toast.error(err.error ?? "Could not issue certificate.");
    }
  };

  const reviewCert = async (id: string, action: "APPROVE" | "REJECT", note?: string) => {
    setReviewing(true);
    const res = await fetch(`/api/certificates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionNote: note }),
    });
    setReviewing(false);
    if (res.ok) {
      toast.success(action === "APPROVE" ? "Certificate approved." : "Certificate rejected.");
      setRejectTarget(null);
      setRejectionNote("");
      void fetchCerts();
    } else {
      const err = await res.json() as { error?: string };
      toast.error(err.error ?? "Action failed.");
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const res = await fetch(`/api/certificates/${revokeTarget.id}`, { method: "DELETE" });
    setRevoking(false);
    if (res.ok) {
      toast.success("Certificate revoked.");
      setCerts(prev => prev.filter(c => c.id !== revokeTarget.id));
      setRevokeTarget(null);
    } else {
      toast.error("Could not revoke certificate.");
    }
  };

  const copyLink = async (credentialId: string) => {
    const url = `${window.location.origin}/certificate/${credentialId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Certificate link copied!");
  };

  // Group certs by programme; groups with pending certs float to the top
  const programGroups = (() => {
    const map = new Map<string, { program: Certificate["program"]; certs: Certificate[] }>();
    for (const cert of certs) {
      const key = cert.program.id;
      if (!map.has(key)) map.set(key, { program: cert.program, certs: [] });
      map.get(key)!.certs.push(cert);
    }
    const STATUS_ORDER: Record<CertStatus, number> = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
    for (const group of map.values()) {
      group.certs.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    }
    return [...map.values()].sort((a, b) => {
      const aPending = a.certs.some(c => c.status === "PENDING") ? 0 : 1;
      const bPending = b.certs.some(c => c.status === "PENDING") ? 0 : 1;
      return aPending - bPending;
    });
  })();

  return (
    <div className="space-y-5">
      {/* Header row. The page header explains the surface; only the approval rule is added here. */}
      {canIssue && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {isSuperAdmin ? "" : "Requests need super admin approval before they are issued."}
          </p>
          <Button
            size="sm"
            className="ml-auto gap-1.5 bg-kat-ink hover:bg-stone-800"
            onClick={() => void openIssue()}
          >
            <Plus className="size-3.5" />
            {isSuperAdmin ? "Issue Certificate" : "Request Certificate"}
          </Button>
        </div>
      )}

      {/* Status filter tabs, issuers only */}
      {canIssue && (
        <div className="flex w-fit items-center gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800/60">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === tab.value
                  ? "bg-white shadow-sm text-stone-800 dark:bg-stone-700 dark:text-stone-100"
                  : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : certs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-200 py-16 text-center dark:border-stone-700">
          <Award className="size-10 text-stone-300 dark:text-stone-600" />
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
            {canIssue
              ? statusFilter
                ? `No ${STATUS_LABEL[statusFilter as CertStatus].toLowerCase()} certificates.`
                : "No certificates yet."
              : "You haven't earned any certificates yet."}
          </p>
          {canIssue && !statusFilter && (
            <Button size="sm" variant="outline" onClick={() => void openIssue()}>
              <Plus className="mr-1.5 size-3.5" />
              {isSuperAdmin ? "Issue first certificate" : "Request first certificate"}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {programGroups.map(({ program, certs: groupCerts }) => {
            const pendingCount  = groupCerts.filter(c => c.status === "PENDING").length;
            const approvedCount = groupCerts.filter(c => c.status === "APPROVED").length;
            const rejectedCount = groupCerts.filter(c => c.status === "REJECTED").length;
            return (
              <section key={program.id} className="space-y-2">
                {/* Programme header */}
                <div className="flex flex-wrap items-center gap-2 pb-0.5">
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                    {program.name}
                  </h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PROGRAM_LEVEL_COLOR[program.level] ?? "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300"}`}>
                    {PROGRAM_LEVEL_LABEL[program.level] ?? program.level}
                  </span>
                  {canIssue && (
                    <div className="ml-1 flex items-center gap-1.5">
                      {pendingCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          {pendingCount} pending
                        </span>
                      )}
                      {approvedCount > 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          {approvedCount} approved
                        </span>
                      )}
                      {rejectedCount > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-400">
                          {rejectedCount} rejected
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Cert rows */}
                <div className="space-y-2">
                  {groupCerts.map(cert => (
                    <CertRow
                      key={cert.id}
                      cert={cert}
                      canIssue={canIssue}
                      canRevoke={canRevoke}
                      canApprove={canApprove && cert.status === "PENDING"}
                      onApprove={() => void reviewCert(cert.id, "APPROVE")}
                      onReject={() => { setRejectTarget(cert); setRejectionNote(""); }}
                      onRevoke={() => setRevokeTarget({ id: cert.id, name: `${cert.user.firstName} ${cert.user.lastName}` })}
                      onCopyLink={() => void copyLink(cert.credentialId)}
                      reviewing={reviewing}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPageChange={setPage}
        disabled={loading}
      />

      {/* Issue / Request dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-md dark:border-stone-700 dark:bg-stone-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-stone-100">
              <Award className="size-4 text-[#1A1714] dark:text-orange-400" />
              {isSuperAdmin ? "Issue Certificate" : "Request Certificate"}
            </DialogTitle>
          </DialogHeader>

          {!isSuperAdmin && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              This request will be sent to a super admin for approval before the certificate is issued.
            </p>
          )}

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400">Student / Fellow</label>
              <UserSearchPicker
                roles="STUDENT,FELLOW"
                selectedId={selectedUser}
                onSelect={(u) => { setSelectedUser(u.id); setSelectedName(`${u.firstName} ${u.lastName}`); }}
              />
              {selectedName ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Selected: <span className="font-medium text-stone-700 dark:text-stone-300">{selectedName}</span>
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400">Programme</label>
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger className="[&>span]:truncate">
                  <SelectValue placeholder="Select programme…" />
                </SelectTrigger>
                <SelectContent>
                  {programs.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-stone-400">Loading programmes…</div>
                  ) : (
                    programs.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        <span className="ml-1.5 text-stone-400">· {PROGRAM_LEVEL_LABEL[p.level] ?? p.level}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 dark:border-stone-600 dark:text-stone-300" onClick={() => setIssueOpen(false)}>
                <X className="mr-1.5 size-3.5" /> Cancel
              </Button>
              <Button
                className="flex-1 bg-[#1A1714] hover:bg-[#162d5e]"
                disabled={issuing || !selectedUser || !selectedProgram}
                onClick={() => void issueCertificate()}
              >
                <Award className="mr-1.5 size-3.5" />
                {issuing
                  ? isSuperAdmin ? "Issuing…" : "Requesting…"
                  : isSuperAdmin ? "Issue Certificate" : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={open => !open && setRevokeTarget(null)}>
        <DialogContent className="max-w-sm dark:border-stone-700 dark:bg-stone-900">
          <DialogHeader>
            <DialogTitle className="dark:text-stone-100">Revoke Certificate</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Are you sure you want to revoke the certificate for{" "}
            <span className="font-semibold text-stone-800 dark:text-stone-200">{revokeTarget?.name}</span>?
            This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="dark:border-stone-600 dark:text-stone-300" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={revoking} onClick={() => void confirmRevoke()}>
              {revoking ? "Revoking…" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={open => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-sm dark:border-stone-700 dark:bg-stone-900">
          <DialogHeader>
            <DialogTitle className="dark:text-stone-100">Reject Certificate Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Rejecting certificate for{" "}
              <span className="font-semibold text-stone-800 dark:text-stone-200">
                {rejectTarget?.user.firstName} {rejectTarget?.user.lastName}
              </span>{" "}
              {rejectTarget?.program.name}.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                Rejection note <span className="text-stone-400">(optional)</span>
              </label>
              <textarea
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                placeholder="Reason for rejection…"
                rows={3}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1A1714]/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:placeholder:text-stone-500 dark:focus:ring-orange-500/30"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="dark:border-stone-600 dark:text-stone-300" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reviewing}
              onClick={() => rejectTarget && void reviewCert(rejectTarget.id, "REJECT", rejectionNote)}
            >
              {reviewing ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Certificate row ──────────────────────────────────────────────────────────

function CertRow({
  cert,
  canIssue,
  canRevoke,
  canApprove,
  onApprove,
  onReject,
  onRevoke,
  onCopyLink,
  reviewing,
}: {
  cert: Certificate;
  canIssue: boolean;
  canRevoke: boolean;
  canApprove: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onRevoke: () => void;
  onCopyLink: () => void;
  reviewing: boolean;
}) {
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopy = () => {
    onCopyLink();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-sm dark:border-stone-700 dark:bg-stone-900">
      {/* Icon */}
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1A1714]/8 dark:bg-[#1A1714]/30">
        <Award className="size-5 text-[#1A1714] dark:text-orange-300" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Issuer sees learner name; learner sees programme name */}
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            {canIssue ? `${cert.user.firstName} ${cert.user.lastName}` : cert.program.name}
          </p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PROGRAM_LEVEL_COLOR[cert.program.level] ?? "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300"}`}>
            {PROGRAM_LEVEL_LABEL[cert.program.level] ?? cert.program.level}
          </span>
          {canIssue && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[cert.status]}`}>
              {STATUS_LABEL[cert.status]}
            </span>
          )}
        </div>

        {/* Issuer: programme name + email on second line */}
        {canIssue && (
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            {cert.program.name} · {cert.user.email}
          </p>
        )}

        <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
          {canIssue
            ? <>Requested {formatDate(cert.issuedAt)} by {cert.issuedBy.firstName} {cert.issuedBy.lastName}</>
            : <>Issued {formatDate(cert.issuedAt)}</>
          }
          {cert.status === "APPROVED" && cert.approvedBy && (
            <> · Approved by {cert.approvedBy.firstName} {cert.approvedBy.lastName}</>
          )}
          {cert.status === "REJECTED" && cert.rejectionNote && (
            <> · <span className="text-rose-400 dark:text-rose-500">{cert.rejectionNote}</span></>
          )}
          {" · "}
          <span className="font-mono text-[10px]">{cert.credentialId.slice(0, 12)}…</span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {canApprove && cert.status === "PENDING" && (
          <>
            <button
              disabled={reviewing}
              onClick={onApprove}
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
            >
              <Check className="size-3" /> Approve
            </button>
            <button
              disabled={reviewing}
              onClick={onReject}
              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40"
            >
              <X className="size-3" /> Reject
            </button>
          </>
        )}

        {cert.status === "APPROVED" && (
          <>
            <button
              onClick={handleCopy}
              title="Copy certificate link"
              className="flex size-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
            >
              {linkCopied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            </button>
            <Link
              href={`/certificate/${cert.credentialId}`}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              <ExternalLink className="size-3" />
              View
            </Link>
          </>
        )}

        {canRevoke && (
          <button
            onClick={onRevoke}
            className="flex size-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
            title="Revoke certificate"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
