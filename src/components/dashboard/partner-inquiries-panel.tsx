"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, Phone, Building2, School } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ProvisionSchoolDialog } from "@/components/dashboard/provision-school-dialog";

type Inquiry = {
  id: string;
  name: string;
  organization: string;
  type: "SCHOOL" | "CORPORATE" | "GOVERNMENT" | "OTHER";
  email: string;
  phone: string | null;
  programs: string[];
  message: string;
  status: "NEW" | "CONTACTED" | "APPROVED" | "ARCHIVED";
  schoolId: string | null;
  createdAt: string;
};

const STATUS_STYLES: Record<Inquiry["status"], string> = {
  NEW: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  CONTACTED: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  ARCHIVED: "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300",
};

const TYPE_LABELS: Record<Inquiry["type"], string> = {
  SCHOOL: "School",
  CORPORATE: "Corporate",
  GOVERNMENT: "Government",
  OTHER: "Other",
};

const PROGRAM_LABELS: Record<string, string> = {
  primary_1_3: "Primary 1–3",
  primary_4_6: "Primary 4–6",
  jss: "JSS 1–3",
  sss: "SSS 1–3",
  // legacy values from older submissions
  coding_clubs: "Coding Clubs",
  tech_labs: "Tech Labs",
  after_school: "After-School Programmes",
  hackathons: "Hackathons",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PartnerInquiriesPanel({ canProvision = false }: { canProvision?: boolean }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const loadInquiries = async (type: string) => {
    setLoading(true);
    const query = type === "ALL" ? "" : `?type=${type}`;
    const res = await fetch(`/api/admin/partner-inquiries${query}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      toast.error(payload?.error ?? "Could not load partner inquiries.");
      return;
    }
    setInquiries(payload.inquiries ?? []);
    setLoading(false);
  };

  useEffect(() => { void loadInquiries(typeFilter); }, [typeFilter]);

  const updateStatus = async (id: string, status: Inquiry["status"]) => {
    setBusy(id);
    const res = await fetch("/api/admin/partner-inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { toast.error(payload?.error ?? "Could not update status."); return; }
    setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    toast.success("Status updated.");
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="kat-card flex items-center gap-3">
        <span className="text-sm text-stone-600 dark:text-stone-400">Filter by type:</span>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-40 rounded-xl border border-stone-300 dark:border-stone-600 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="SCHOOL">School</SelectItem>
            <SelectItem value="CORPORATE">Corporate</SelectItem>
            <SelectItem value="GOVERNMENT">Government</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">
          {inquiries.length} result{inquiries.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="kat-card space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="kat-card flex flex-col items-center gap-2 py-12 text-center">
          <Building2 className="size-8 text-stone-300 dark:text-stone-600" />
          <p className="text-sm text-stone-500 dark:text-stone-400">No partner inquiries yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq, i) => (
            <motion.div
              key={inq.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="kat-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-stone-900 dark:text-stone-100">{inq.organization}</h3>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                      {TYPE_LABELS[inq.type]}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[inq.status]}`}>
                      {inq.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
                    {inq.name} · {formatDate(inq.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Provisioning: super-admin only, SCHOOL leads only, once each. */}
                  {canProvision && inq.type === "SCHOOL" && !inq.schoolId ? (
                    <ProvisionSchoolDialog
                      inquiry={{
                        id: inq.id,
                        name: inq.name,
                        organization: inq.organization,
                        email: inq.email,
                      }}
                      onProvisioned={() => loadInquiries(typeFilter)}
                    />
                  ) : null}

                  {inq.schoolId ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      <School className="size-3.5" /> Provisioned
                    </span>
                  ) : null}

                  <span className="text-xs text-stone-400 dark:text-stone-500">Status</span>
                  <Select
                    value={inq.status}
                    onValueChange={(v) => updateStatus(inq.id, v as Inquiry["status"])}
                    disabled={busy === inq.id}
                  >
                    <SelectTrigger className="h-8 w-32 rounded-xl border border-stone-300 dark:border-stone-600 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">New</SelectItem>
                      <SelectItem value="CONTACTED">Contacted</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contact + programmes */}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                <a
                  href={`mailto:${inq.email}`}
                  className="inline-flex items-center gap-1.5 text-orange-700 hover:underline dark:text-orange-400"
                >
                  <Mail className="size-3.5" /> {inq.email}
                </a>
                {inq.phone ? (
                  <a
                    href={`tel:${inq.phone}`}
                    className="inline-flex items-center gap-1.5 text-stone-600 hover:underline dark:text-stone-300"
                  >
                    <Phone className="size-3.5" /> {inq.phone}
                  </a>
                ) : null}
              </div>

              {inq.programs.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {inq.programs.map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-stone-200 px-2 py-0.5 text-xs text-stone-600 dark:border-stone-700 dark:text-stone-300"
                    >
                      {PROGRAM_LABELS[p] ?? p}
                    </span>
                  ))}
                </div>
              ) : null}

              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-600 dark:bg-stone-800/50 dark:text-stone-300">
                {inq.message}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
