"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type ManagedSchool = {
  id: string;
  name: string;
  slug: string;
  pricePerSeat: number;
  discountPercent: number;
  discountReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  adminCount: number;
  activeLicenses: number;
  seatLimit: number;
  seatsUsed: number;
  paidRevenue: number;
  pendingInvoiceCount: number;
  pendingInvoiceAmount: number;
  pupilCount: number;
};

type LicenseRow = {
  sessionLabel: string;
  termNumber: number;
  status: string;
  seatLimit: number;
  seatsUsed: number;
  pricePerSeat: number;
  startsAt: string | null;
  endsAt: string | null;
  lifecycle: "UNLIMITED" | "NOT_STARTED" | "ACTIVE" | "GRACE" | "EXPIRED";
};

const LIFECYCLE_LABEL: Record<LicenseRow["lifecycle"], string | null> = {
  UNLIMITED: "No end date",
  NOT_STARTED: "Not started",
  ACTIVE: null,
  GRACE: "In grace",
  EXPIRED: "Expired",
};
type InvoiceRow = {
  id: string;
  sessionLabel: string;
  termNumber: number;
  seatCount: number;
  amount: number;
  discountPercent: number;
  status: string;
  paymentMethod: string;
  paymentNote: string | null;
  createdAt: string;
};
type SchoolDetail = {
  licenses: LicenseRow[];
  invoices: InvoiceRow[];
};
type DetailState = { status: "loading" } | { status: "error" } | { status: "ready"; data: SchoolDetail };

function naira(amount: number): string {
  return "₦" + Math.round(amount).toLocaleString("en-NG");
}

function shortDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "n/a";
}

const STATUS_CHIP: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  VOID: "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400",
  DRAFT: "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400",
  EXPIRED: "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PAYSTACK: "Paystack",
  BANK_TRANSFER: "Bank transfer",
  SPONSORED: "Sponsored",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[status] ?? STATUS_CHIP.DRAFT}`}>
      {status}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-stone-400 dark:text-stone-500">{label}</p>
      <p className="mt-0.5 font-medium text-stone-800 dark:text-stone-200">{value}</p>
    </div>
  );
}

export function ManageSchoolsPanel() {
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<ManagedSchool[]>([]);
  const [query, setQuery] = useState("");

  // Inline per-seat price + concession editing.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState("");
  const [draftDiscount, setDraftDiscount] = useState("");
  const [draftReason, setDraftReason] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Suspension + drill-down.
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailById, setDetailById] = useState<Record<string, DetailState>>({});

  // Manual licensing (bank transfer): mark an existing invoice paid, or record a new payment.
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordTerm, setRecordTerm] = useState("");
  const [recordSeats, setRecordSeats] = useState("");
  const [recordNote, setRecordNote] = useState("");
  const [recordStart, setRecordStart] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/schools");
    const payload = await res.json();
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not load schools.");
    } else {
      setSchools(payload.schools ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));
  }, [schools, query]);

  const totals = useMemo(
    () => ({
      schools: schools.length,
      pupils: schools.reduce((sum, s) => sum + s.pupilCount, 0),
      revenue: schools.reduce((sum, s) => sum + s.paidRevenue, 0),
      seatsUsed: schools.reduce((sum, s) => sum + s.seatsUsed, 0),
      unpriced: schools.filter((s) => s.pricePerSeat <= 0 && !s.suspendedAt).length,
      suspended: schools.filter((s) => s.suspendedAt).length,
    }),
    [schools],
  );

  const startEdit = (school: ManagedSchool) => {
    setEditingId(school.id);
    setDraftPrice(school.pricePerSeat > 0 ? String(school.pricePerSeat) : "");
    setDraftDiscount(school.discountPercent > 0 ? String(school.discountPercent) : "");
    setDraftReason(school.discountReason ?? "");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftPrice("");
    setDraftDiscount("");
    setDraftReason("");
  };

  const savePrice = async (school: ManagedSchool) => {
    const value = Number(draftPrice);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid price (0 or more).");
      return;
    }
    const discount = draftDiscount.trim() === "" ? 0 : Number(draftDiscount);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      toast.error("Concession must be between 0 and 100%.");
      return;
    }
    setSavingId(school.id);
    const res = await fetch(`/api/super-admin/schools/${school.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricePerSeat: value, discountPercent: discount, discountReason: draftReason.trim() }),
    });
    const payload = await res.json();
    setSavingId(null);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not update the school.");
      return;
    }
    const newPrice = Number(payload.school?.pricePerSeat ?? value);
    const newDiscount = Number(payload.school?.discountPercent ?? discount);
    const newReason = (payload.school?.discountReason ?? null) as string | null;
    setSchools((prev) =>
      prev.map((s) =>
        s.id === school.id ? { ...s, pricePerSeat: newPrice, discountPercent: newDiscount, discountReason: newReason } : s,
      ),
    );
    toast.success(
      newDiscount >= 100
        ? `${school.name}: sponsored (free terms).`
        : newDiscount > 0
          ? `${school.name}: ${naira(newPrice)}/seat, ${newDiscount}% off.`
          : newPrice > 0
            ? `${school.name}: ${naira(newPrice)} per seat.`
            : `${school.name}: invoicing suspended (price 0).`,
    );
    cancelEdit();
  };

  const toggleSuspend = async (school: ManagedSchool) => {
    const next = !school.suspendedAt;
    if (next && !window.confirm(
      `Suspend billing for ${school.name}? They cannot raise new invoices or buy seats. Pupils already in a paid term keep access until it ends.`,
    )) {
      return;
    }
    setSuspendingId(school.id);
    const res = await fetch(`/api/super-admin/schools/${school.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: next }),
    });
    const payload = await res.json();
    setSuspendingId(null);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not update the school.");
      return;
    }
    const suspendedAt = payload.school?.suspendedAt ?? null;
    setSchools((prev) => prev.map((s) => (s.id === school.id ? { ...s, suspendedAt } : s)));
    toast.success(next ? `${school.name}: billing suspended.` : `${school.name}: billing resumed.`);
  };

  const loadDetail = async (schoolId: string) => {
    setDetailById((prev) => ({ ...prev, [schoolId]: prev[schoolId] ?? { status: "loading" } }));
    const res = await fetch(`/api/super-admin/schools/${schoolId}`);
    const payload = await res.json();
    if (!res.ok) {
      setDetailById((prev) => ({ ...prev, [schoolId]: { status: "error" } }));
      toast.error(payload?.error ?? "Could not load the school's details.");
      return;
    }
    setDetailById((prev) => ({
      ...prev,
      [schoolId]: { status: "ready", data: { licenses: payload.detail.licenses ?? [], invoices: payload.detail.invoices ?? [] } },
    }));
  };

  const toggleDetails = async (school: ManagedSchool) => {
    if (expandedId === school.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(school.id);
    if (!detailById[school.id]) await loadDetail(school.id);
  };

  // MANUAL LICENSING: confirm a bank transfer against an existing PENDING invoice, then activate.
  const markInvoicePaid = async (school: ManagedSchool, invoice: InvoiceRow) => {
    const note = window.prompt(
      `Confirm a bank transfer of ${naira(invoice.amount)} for ${school.name} (${invoice.sessionLabel} Term ${invoice.termNumber})?\nThis marks the invoice paid and activates the term.\n\nOptional reference / who confirmed:`,
      "",
    );
    if (note === null) return; // cancelled
    setMarkingPaidId(invoice.id);
    const res = await fetch(`/api/super-admin/schools/${school.id}/invoices/${invoice.id}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const payload = await res.json();
    setMarkingPaidId(null);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not mark the invoice paid.");
      return;
    }
    toast.success(`${school.name}: payment recorded, term activated.`);
    await loadDetail(school.id);
    await load();
  };

  // MANUAL LICENSING: raise AND settle in one step (school paid before any invoice existed).
  const recordBankPayment = async (school: ManagedSchool) => {
    const seats = Number(recordSeats);
    if (!recordTerm.trim()) {
      toast.error("Enter the term, e.g. 2025/2026 Term 1.");
      return;
    }
    if (!Number.isFinite(seats) || seats < 1) {
      toast.error("Enter a seat count of 1 or more.");
      return;
    }
    setRecordingId(school.id);
    const res = await fetch(`/api/super-admin/schools/${school.id}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: recordTerm,
        seatCount: seats,
        note: recordNote,
        startsAt: recordStart || undefined,
      }),
    });
    const payload = await res.json();
    setRecordingId(null);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not record the payment.");
      return;
    }
    toast.success(`${school.name}: ${recordTerm} licensed (bank transfer).`);
    setRecordTerm("");
    setRecordSeats("");
    setRecordNote("");
    setRecordStart("");
    await loadDetail(school.id);
    await load();
  };

  return (
    <div className="space-y-4">
      {/* Summary + search + provision */}
      <section className="kat-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="Schools" value={String(totals.schools)} />
            <Stat label="Pupils" value={totals.pupils.toLocaleString("en-NG")} />
            <Stat label="Seats in use" value={totals.seatsUsed.toLocaleString("en-NG")} />
            <Stat label="Paid revenue" value={naira(totals.revenue)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard/partner-inquiries">
                <Plus className="mr-1.5 size-4" />
                Provision a school
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className="mr-1.5 size-4" />
              Refresh
            </Button>
          </div>
        </div>

        {totals.unpriced > 0 ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {totals.unpriced} school{totals.unpriced === 1 ? "" : "s"} without a seat price. Those schools cannot
            raise an invoice until you set one.
          </p>
        ) : null}
        {totals.suspended > 0 ? (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
            {totals.suspended} school{totals.suspended === 1 ? "" : "s"} suspended. New invoicing is blocked for
            {totals.suspended === 1 ? " it" : " them"} until you resume.
          </p>
        ) : null}

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            className="pl-9"
            placeholder="Search by name or slug…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>

      {/* School list */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : schools.length === 0 ? (
        <section className="kat-card text-center">
          <Building2 className="mx-auto size-8 text-stone-300 dark:text-stone-600" />
          <h3 className="mt-3 [font-family:var(--font-space-grotesk)] text-base font-semibold text-stone-900 dark:text-stone-100">
            No schools yet
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-600 dark:text-stone-400">
            Schools are created from an approved partner inquiry. Provision your first one to see it here.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/partner-inquiries">Go to Partner Inquiries</Link>
          </Button>
        </section>
      ) : filtered.length === 0 ? (
        <p className="px-1 text-sm text-stone-600 dark:text-stone-400">No school matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((school, index) => {
            const editing = editingId === school.id;
            const saving = savingId === school.id;
            const noPrice = school.pricePerSeat <= 0;
            const suspended = Boolean(school.suspendedAt);
            const expanded = expandedId === school.id;
            const detail = detailById[school.id];
            return (
              <motion.section
                key={school.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`kat-card ${suspended ? "border-rose-200 dark:border-rose-900/50" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="[font-family:var(--font-space-grotesk)] text-base font-semibold text-stone-900 dark:text-stone-100">
                        {school.name}
                      </h3>
                      {suspended ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                          Suspended
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      <span className="font-mono">{school.slug}</span> · since{" "}
                      {new Date(school.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </p>
                  </div>

                  {/* Per-seat price + inline edit */}
                  <div className="shrink-0">
                    {editing ? (
                      <div className="flex w-64 flex-col gap-2">
                        <div>
                          <label className="text-[11px] uppercase tracking-wide text-stone-400 dark:text-stone-500">
                            Price / seat
                          </label>
                          <div className="relative mt-1">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                              ₦
                            </span>
                            <Input
                              type="number"
                              min={0}
                              max={1_000_000}
                              autoFocus
                              className="h-9 w-full pl-6"
                              value={draftPrice}
                              onChange={(e) => setDraftPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void savePrice(school);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="w-20">
                            <label className="text-[11px] uppercase tracking-wide text-stone-400 dark:text-stone-500">
                              Off %
                            </label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="mt-1 h-9 w-full"
                              value={draftDiscount}
                              onChange={(e) => setDraftDiscount(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[11px] uppercase tracking-wide text-stone-400 dark:text-stone-500">
                              Reason
                            </label>
                            <Input
                              type="text"
                              maxLength={200}
                              className="mt-1 h-9 w-full"
                              value={draftReason}
                              onChange={(e) => setDraftReason(e.target.value)}
                              placeholder="pilot term"
                            />
                          </div>
                        </div>
                        {Number(draftDiscount) >= 100 ? (
                          <p className="text-[11px] text-pine dark:text-emerald-400">
                            100% = sponsored: terms activate free, no payment step.
                          </p>
                        ) : null}
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-8 flex-1" disabled={saving} onClick={() => void savePrice(school)}>
                            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Check className="mr-1 size-4" />}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" disabled={saving} onClick={cancelEdit}>
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          {noPrice ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              No price set
                            </span>
                          ) : (
                            <span className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                              {naira(school.pricePerSeat)}
                            </span>
                          )}
                          <p className="text-[11px] uppercase tracking-wide text-stone-400 dark:text-stone-500">
                            per seat / term
                          </p>
                          {school.discountPercent > 0 ? (
                            <span
                              className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              title={school.discountReason ?? undefined}
                            >
                              {school.discountPercent >= 100 ? "Sponsored (free)" : `${school.discountPercent}% off`}
                            </span>
                          ) : null}
                        </div>
                        <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => startEdit(school)}>
                          <Pencil className="mr-1 size-3.5" />
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-stone-100 pt-3 dark:border-stone-800 sm:grid-cols-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="size-4 shrink-0 text-stone-400" />
                    <Stat label="Pupils" value={school.pupilCount.toLocaleString("en-NG")} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-4 shrink-0 text-stone-400" />
                    <Stat label="Admins" value={String(school.adminCount)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 shrink-0 text-stone-400" />
                    <Stat
                      label="Active seats"
                      value={school.activeLicenses === 0 ? "No live licence" : `${school.seatsUsed} / ${school.seatLimit}`}
                    />
                  </div>
                  <Stat label="Paid revenue" value={naira(school.paidRevenue)} />
                </div>

                {school.pendingInvoiceCount > 0 ? (
                  <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
                    {school.pendingInvoiceCount} unpaid invoice{school.pendingInvoiceCount === 1 ? "" : "s"} worth{" "}
                    {naira(school.pendingInvoiceAmount)} awaiting payment.
                  </p>
                ) : null}

                {/* Actions */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                  <Button size="sm" variant="outline" onClick={() => void toggleDetails(school)}>
                    {expanded ? <ChevronUp className="mr-1.5 size-4" /> : <ChevronDown className="mr-1.5 size-4" />}
                    {expanded ? "Hide details" : "Licences & invoices"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={suspendingId === school.id}
                    className={suspended ? "" : "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/20"}
                    onClick={() => void toggleSuspend(school)}
                  >
                    {suspendingId === school.id ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : suspended ? (
                      <PlayCircle className="mr-1.5 size-4" />
                    ) : (
                      <PauseCircle className="mr-1.5 size-4" />
                    )}
                    {suspended ? "Resume billing" : "Suspend billing"}
                  </Button>
                </div>

                {/* Drill-down: licences + invoices */}
                <AnimatePresence>
                  {expanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
                        {!detail || detail.status === "loading" ? (
                          <Skeleton className="h-24 w-full" />
                        ) : detail.status === "error" ? (
                          <p className="text-sm text-rose-600 dark:text-rose-400">Could not load details.</p>
                        ) : (
                          <div className="grid gap-4 lg:grid-cols-2">
                            {/* Licences */}
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                                Licences by term
                              </p>
                              {detail.data.licenses.length === 0 ? (
                                <p className="text-sm text-stone-500 dark:text-stone-400">No licences yet.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {detail.data.licenses.map((l) => (
                                    <div
                                      key={`${l.sessionLabel}-${l.termNumber}`}
                                      className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm dark:bg-stone-800/60"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-stone-800 dark:text-stone-200">
                                          {l.sessionLabel} · Term {l.termNumber}
                                        </p>
                                        <p className="text-xs text-stone-500 dark:text-stone-400">
                                          {l.seatsUsed}/{l.seatLimit} seats · {shortDate(l.startsAt)} to {shortDate(l.endsAt)}
                                        </p>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-2">
                                        {LIFECYCLE_LABEL[l.lifecycle] ? (
                                          <span
                                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                              l.lifecycle === "GRACE"
                                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                                : l.lifecycle === "EXPIRED"
                                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                                                  : "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400"
                                            }`}
                                          >
                                            {LIFECYCLE_LABEL[l.lifecycle]}
                                          </span>
                                        ) : null}
                                        <StatusChip status={l.status} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Invoices */}
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                                Recent invoices
                              </p>
                              {detail.data.invoices.length === 0 ? (
                                <p className="text-sm text-stone-500 dark:text-stone-400">No invoices yet.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {detail.data.invoices.map((i) => (
                                    <div
                                      key={i.id}
                                      className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm dark:bg-stone-800/60"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-stone-800 dark:text-stone-200">
                                          {naira(i.amount)}{" "}
                                          <span className="font-normal text-stone-500 dark:text-stone-400">
                                            · {i.seatCount} seats{i.discountPercent > 0 ? ` · ${i.discountPercent}% off` : ""}
                                          </span>
                                        </p>
                                        <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                                          {i.sessionLabel} · Term {i.termNumber} · {shortDate(i.createdAt)}
                                          {i.status === "PAID" ? ` · ${PAYMENT_METHOD_LABEL[i.paymentMethod] ?? i.paymentMethod}` : ""}
                                          {i.paymentNote ? ` · ${i.paymentNote}` : ""}
                                        </p>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-2">
                                        {i.status === "PENDING" ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs"
                                            disabled={markingPaidId === i.id}
                                            onClick={() => void markInvoicePaid(school, i)}
                                          >
                                            {markingPaidId === i.id ? (
                                              <Loader2 className="size-3.5 animate-spin" />
                                            ) : (
                                              <>
                                                <Banknote className="mr-1 size-3.5" />
                                                Mark paid
                                              </>
                                            )}
                                          </Button>
                                        ) : null}
                                        <StatusChip status={i.status} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Record a bank transfer that arrived before any invoice existed. */}
                              <div className="mt-3 rounded-lg border border-dashed border-stone-200 p-3 dark:border-stone-700">
                                <p className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                                  Record a bank payment
                                </p>
                                <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
                                  Licence a term for a school that paid into your account directly. Amount is computed from
                                  the school&apos;s price and concession.
                                </p>
                                <div className="mt-2 flex flex-wrap items-end gap-2">
                                  <Input
                                    className="h-8 w-40 text-xs"
                                    placeholder="2025/2026 Term 1"
                                    value={recordTerm}
                                    onChange={(e) => setRecordTerm(e.target.value)}
                                  />
                                  <Input
                                    type="number"
                                    min={1}
                                    className="h-8 w-20 text-xs"
                                    placeholder="Seats"
                                    value={recordSeats}
                                    onChange={(e) => setRecordSeats(e.target.value)}
                                  />
                                  <Input
                                    type="date"
                                    title="Term start date (optional)"
                                    className="h-8 w-36 text-xs"
                                    value={recordStart}
                                    onChange={(e) => setRecordStart(e.target.value)}
                                  />
                                  <Input
                                    className="h-8 min-w-[7rem] flex-1 text-xs"
                                    placeholder="Bank ref / note (optional)"
                                    value={recordNote}
                                    onChange={(e) => setRecordNote(e.target.value)}
                                  />
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs"
                                    disabled={recordingId === school.id}
                                    onClick={() => void recordBankPayment(school)}
                                  >
                                    {recordingId === school.id ? (
                                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                                    ) : (
                                      <Banknote className="mr-1 size-3.5" />
                                    )}
                                    Record &amp; activate
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.section>
            );
          })}
        </div>
      )}
    </div>
  );
}
