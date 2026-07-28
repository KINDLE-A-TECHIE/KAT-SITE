"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Award, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SchoolClass = { id: string; name: string; sessionLabel: string };
type Candidate = {
  userId: string;
  name: string;
  externalRef: string | null;
  moduleId: string;
  moduleTitle: string;
  termNumber: number;
};
type CapstoneCandidate = {
  userId: string;
  name: string;
  externalRef: string | null;
  programId: string;
};
type IssuedCertificate = {
  id: string;
  credentialId: string;
  kind: "TERM" | "SESSION";
  programTitle: string;
  sessionLabel: string;
  termNumber: number | null;
  pupilName: string;
  nameConsent: boolean;
  status: "ISSUED" | "REVOKED";
  issuedAt: string;
};

/**
 * SCHOOL_ADMIN certificates panel. Pick a class, see the pupils who have completed a licensed term and
 * do not yet hold its certificate, and issue. Pupil names are shown only here (to the school's own
 * admin) and are never sent in a URL or query string; issuing is keyed on the opaque userId.
 */
export function CertificatesPanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [capstoneCandidates, setCapstoneCandidates] = useState<CapstoneCandidate[]>([]);
  const [issued, setIssued] = useState<IssuedCertificate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [issuing, setIssuing] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const keyOf = (c: Candidate) => `${c.userId}:${c.moduleId}`;

  const loadIssued = useCallback(async () => {
    const res = await fetch("/api/school/certificates");
    if (res.ok) setIssued(((await res.json()) as { certificates: IssuedCertificate[] }).certificates);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/school/classes");
      if (res.ok) {
        const list = ((await res.json()) as { classes?: SchoolClass[] }).classes ?? [];
        setClasses(list);
        if (list.length > 0) setClassId(list[0].id);
      }
    })();
    void loadIssued();
  }, [loadIssued]);

  useEffect(() => {
    if (!classId) return;
    setLoadingCandidates(true);
    void (async () => {
      try {
        const res = await fetch(`/api/school/certificates/eligible?classId=${encodeURIComponent(classId)}`);
        if (res.ok) {
          const data = (await res.json()) as { candidates: Candidate[]; capstoneCandidates: CapstoneCandidate[] };
          setCandidates(data.candidates);
          setCapstoneCandidates(data.capstoneCandidates ?? []);
        } else {
          setCandidates([]);
          setCapstoneCandidates([]);
        }
      } finally {
        setLoadingCandidates(false);
      }
    })();
  }, [classId]);

  const issue = async (c: Candidate) => {
    const k = keyOf(c);
    setIssuing(k);
    try {
      const res = await fetch("/api/school/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: c.userId, moduleId: c.moduleId, nameConsent: !!consent[k] }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not issue the certificate.");
        return;
      }
      toast.success(`Certificate issued for ${c.name}, Term ${c.termNumber}.`);
      setCandidates((prev) => prev.filter((x) => keyOf(x) !== k));
      await loadIssued();
    } catch {
      toast.error("Network error while issuing.");
    } finally {
      setIssuing(null);
    }
  };

  const issueCapstone = async (c: CapstoneCandidate) => {
    setIssuing(`cap:${c.userId}`);
    try {
      const res = await fetch("/api/school/certificates/capstone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: c.userId, programId: c.programId, nameConsent: !!consent[`cap:${c.userId}`] }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not issue the year certificate.");
        return;
      }
      toast.success(`Year certificate issued for ${c.name}.`);
      setCapstoneCandidates((prev) => prev.filter((x) => x.userId !== c.userId));
      await loadIssued();
    } catch {
      toast.error("Network error while issuing.");
    } finally {
      setIssuing(null);
    }
  };

  const revoke = async (cert: IssuedCertificate) => {
    const label = cert.kind === "SESSION" ? "year" : `Term ${cert.termNumber}`;
    if (!window.confirm(`Revoke ${cert.pupilName}'s ${label} certificate? The shared link will stop verifying.`)) return;
    setRevoking(cert.id);
    try {
      const res = await fetch(`/api/school/certificates/${cert.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not revoke the certificate.");
        return;
      }
      toast.success("Certificate revoked.");
      await loadIssued();
    } catch {
      toast.error("Network error while revoking.");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Ready to issue */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
            Ready to certify
          </h2>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-kat-clay focus:outline-none focus:ring-1 focus:ring-kat-clay dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200"
          >
            {classes.length === 0 && <option value="">No classes</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.sessionLabel}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400">
          A pupil appears here once they complete every lesson in a term your school has an active
          licence for. Tick consent only if a parent has agreed to show the pupil&rsquo;s name on the
          shareable certificate.
        </p>

        {loadingCandidates ? (
          <div className="flex items-center gap-2 py-8 text-sm text-stone-500">
            <Loader2 className="size-4 animate-spin" /> Loading pupils…
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-500 dark:border-stone-800">
            No pupils are ready to certify in this class yet.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
            {candidates.map((c) => {
              const k = keyOf(c);
              return (
                <li key={k} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-800 dark:text-stone-100">
                      {c.name}
                      {c.externalRef ? (
                        <span className="ml-2 font-mono text-xs text-stone-400">{c.externalRef}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Term {c.termNumber} · {c.moduleTitle}
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={!!consent[k]}
                      onChange={(e) => setConsent((prev) => ({ ...prev, [k]: e.target.checked }))}
                      className="size-3.5 accent-kat-clay"
                    />
                    Parent consent
                  </label>
                  <Button
                    size="sm"
                    onClick={() => void issue(c)}
                    disabled={issuing === k}
                    className="gap-1.5 bg-kat-clay text-xs hover:bg-kat-clay-deep"
                  >
                    {issuing === k ? <Loader2 className="size-3.5 animate-spin" /> : <Award className="size-3.5" />}
                    Issue
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Year capstone */}
      {capstoneCandidates.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
            Ready for the year certificate
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            A pupil appears here once they hold a certificate for every term of the programme.
          </p>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
            {capstoneCandidates.map((c) => {
              const k = `cap:${c.userId}`;
              return (
                <li key={c.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-800 dark:text-stone-100">
                      {c.name}
                      {c.externalRef ? (
                        <span className="ml-2 font-mono text-xs text-stone-400">{c.externalRef}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">Full year, all terms complete</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={!!consent[k]}
                      onChange={(e) => setConsent((prev) => ({ ...prev, [k]: e.target.checked }))}
                      className="size-3.5 accent-kat-clay"
                    />
                    Parent consent
                  </label>
                  <Button
                    size="sm"
                    onClick={() => void issueCapstone(c)}
                    disabled={issuing === k}
                    className="gap-1.5 bg-kat-pine text-xs hover:brightness-110"
                  >
                    {issuing === k ? <Loader2 className="size-3.5 animate-spin" /> : <Award className="size-3.5" />}
                    Year certificate
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Issued */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
          Issued certificates
        </h2>
        {issued.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-500 dark:border-stone-800">
            No certificates issued yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Pupil</th>
                  <th className="px-4 py-2.5 font-medium">Term</th>
                  <th className="px-4 py-2.5 font-medium">Programme</th>
                  <th className="px-4 py-2.5 font-medium">Issued</th>
                  <th className="px-4 py-2.5 font-medium">Verify</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {issued.map((c) => {
                  const revoked = c.status === "REVOKED";
                  return (
                  <tr key={c.credentialId} className={revoked ? "opacity-55" : undefined}>
                    <td className="px-4 py-2.5 text-stone-800 dark:text-stone-100">
                      {c.pupilName}
                      {revoked ? (
                        <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                          revoked
                        </span>
                      ) : !c.nameConsent ? (
                        <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800">
                          name hidden publicly
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-stone-500 dark:text-stone-400">
                      {c.kind === "SESSION" ? "Full year" : `Term ${c.termNumber}`} · {c.sessionLabel}
                    </td>
                    <td className="px-4 py-2.5 text-stone-500 dark:text-stone-400">{c.programTitle}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-stone-400">
                      {new Date(c.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5">
                      {revoked ? (
                        <span className="text-xs text-stone-400">Not valid</span>
                      ) : (
                        <a
                          href={`/certificate/${c.credentialId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-kat-clay hover:underline"
                        >
                          Open <ExternalLink className="size-3" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!revoked ? (
                        <button
                          type="button"
                          onClick={() => void revoke(c)}
                          disabled={revoking === c.id}
                          className="text-xs font-medium text-stone-400 transition hover:text-rose-600 disabled:opacity-50"
                        >
                          {revoking === c.id ? "Revoking…" : "Revoke"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
