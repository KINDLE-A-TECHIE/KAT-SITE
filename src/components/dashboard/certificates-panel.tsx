"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRoleValue } from "@/lib/enums";

type Certificate = {
  id: string;
  credentialId: string;
  issuedAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  program: { id: string; name: string; level: string };
  issuedBy: { id: string; firstName: string; lastName: string };
};

type Learner = { id: string; firstName: string; lastName: string; email: string; role: string };
type Program = { id: string; name: string; level: string };

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  FELLOWSHIP: "Fellowship",
};

const LEVEL_COLOUR: Record<string, string> = {
  BEGINNER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  INTERMEDIATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  ADVANCED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  FELLOWSHIP: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CertificatesPanel({ role }: { role: UserRoleValue }) {
  const canIssue = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(role);
  const canRevoke = ["SUPER_ADMIN", "ADMIN"].includes(role);

  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);

  // Issue form state
  const [learners, setLearners] = useState<Learner[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [issuing, setIssuing] = useState(false);

  const fetchCerts = async () => {
    const res = await fetch("/api/certificates");
    if (res.ok) {
      const data = await res.json() as { certificates: Certificate[] };
      setCerts(data.certificates);
    }
    setLoading(false);
  };

  useEffect(() => { void fetchCerts(); }, []);

  const openIssue = async () => {
    setIssueOpen(true);
    if (learners.length === 0) {
      // Fetch learners and programs in parallel
      const [lr, pr] = await Promise.all([
        fetch("/api/users?roles=STUDENT,FELLOW").then(r => r.ok ? r.json() as Promise<{ users: Learner[] }> : { users: [] }),
        fetch("/api/programs").then(r => r.ok ? r.json() as Promise<{ programs: Program[] }> : { programs: [] }),
      ]);
      setLearners(lr.users ?? []);
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
      toast.success("Certificate issued successfully.");
      setIssueOpen(false);
      setSelectedUser("");
      setSelectedProgram("");
      void fetchCerts();
    } else {
      const err = await res.json() as { error?: string };
      toast.error(err.error ?? "Could not issue certificate.");
    }
  };

  const revokeCertificate = async (id: string, name: string) => {
    if (!confirm(`Revoke certificate for ${name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/certificates/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Certificate revoked.");
      setCerts(prev => prev.filter(c => c.id !== id));
    } else {
      toast.error("Could not revoke certificate.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {canIssue
            ? "Issue, view, and manage certificates for your learners."
            : "Download and share your earned certificates."}
        </p>
        {canIssue && (
          <Button
            size="sm"
            className="gap-1.5 bg-[#0D1F45] hover:bg-[#162d5e]"
            onClick={() => void openIssue()}
          >
            <Plus className="size-3.5" />
            Issue Certificate
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : certs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
          <Award className="size-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {canIssue ? "No certificates issued yet." : "You haven't earned any certificates yet."}
          </p>
          {canIssue && (
            <Button size="sm" variant="outline" onClick={() => void openIssue()}>
              <Plus className="mr-1.5 size-3.5" /> Issue first certificate
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map(cert => (
            <div
              key={cert.id}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {/* Icon */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0D1F45]/8 dark:bg-[#0D1F45]/30">
                <Award className="size-5 text-[#0D1F45] dark:text-blue-300" />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {cert.program.name}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${LEVEL_COLOUR[cert.program.level] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                    {LEVEL_LABEL[cert.program.level] ?? cert.program.level}
                  </span>
                </div>
                {canIssue ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {cert.user.firstName} {cert.user.lastName} · {cert.user.email}
                  </p>
                ) : null}
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                  Issued {formatDate(cert.issuedAt)} by {cert.issuedBy.firstName} {cert.issuedBy.lastName}
                  {" · "}
                  <span className="font-mono text-[10px]">{cert.credentialId.slice(0, 12)}…</span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/certificate/${cert.credentialId}`}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <ExternalLink className="size-3" />
                  View
                </Link>
                {canRevoke && (
                  <button
                    onClick={() => void revokeCertificate(cert.id, `${cert.user.firstName} ${cert.user.lastName}`)}
                    className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                    title="Revoke certificate"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issue dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="size-4 text-[#0D1F45]" />
              Issue Certificate
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Student / Fellow</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="[&>span]:truncate">
                  <SelectValue placeholder="Select recipient…" />
                </SelectTrigger>
                <SelectContent>
                  {learners.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-400">Loading learners…</div>
                  ) : (
                    learners.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.firstName} {l.lastName}
                        <span className="ml-1.5 text-slate-400">({l.role.toLowerCase()})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Programme</label>
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger className="[&>span]:truncate">
                  <SelectValue placeholder="Select programme…" />
                </SelectTrigger>
                <SelectContent>
                  {programs.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-400">Loading programmes…</div>
                  ) : (
                    programs.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        <span className="ml-1.5 text-slate-400">· {LEVEL_LABEL[p.level] ?? p.level}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setIssueOpen(false)}>
                <X className="mr-1.5 size-3.5" /> Cancel
              </Button>
              <Button
                className="flex-1 bg-[#0D1F45] hover:bg-[#162d5e]"
                disabled={issuing || !selectedUser || !selectedProgram}
                onClick={() => void issueCertificate()}
              >
                <Award className="mr-1.5 size-3.5" />
                {issuing ? "Issuing…" : "Issue Certificate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
