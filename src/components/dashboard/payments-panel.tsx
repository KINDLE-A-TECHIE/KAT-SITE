"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Check, Loader2, Plus, ShoppingCart, Tag, Trash2, User, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const PAGE_SIZE = 50;

// ── Types ────────────────────────────────────────────────────────────────────

type Program = { id: string; name: string; monthlyFee: number };
type Child = { id: string; firstName: string; lastName: string; email: string; enrollments: { id: string; program: Program }[] };
type CartItem = {
  id: string; // wardId-programId-billingMonth
  wardId: string;
  wardName: string;
  programId: string;
  programName: string;
  billingMonth: string; // YYYY-MM
  amount: number;        // base amount
  finalAmount: number;   // after discount
  currency: string;
  discountCode?: string;
  discountPercent?: number;
};

type PaymentRecord = {
  id: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  billingMonth: string;
  receipt: { id: string; receiptNumber: string } | null;
  program: { name: string } | null;
  user: { id: string; firstName: string; lastName: string } | null;
};

type DiscountCode = {
  id: string;
  code: string;
  description: string | null;
  discountPercent: number;
  isActive: boolean;
  usedCount: number;
  maxUses: number | null;
  expiresAt: string | null;
  program: { id: string; name: string } | null;
  createdBy: { firstName: string; lastName: string };
  _count: { redemptions: number };
};

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  FAILED:  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  REFUNDED:"bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  PENDING: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
};

// ── Promo code input ──────────────────────────────────────────────────────────

function PromoCodeInput({
  programId,
  onApplied,
  onRemoved,
  appliedCode,
}: {
  programId: string;
  onApplied: (code: string, percent: number) => void;
  onRemoved: () => void;
  appliedCode?: string;
}) {
  const [input, setInput] = useState(appliedCode ?? "");
  const [checking, setChecking] = useState(false);

  const apply = async () => {
    if (!input.trim()) return;
    setChecking(true);
    const res = await fetch("/api/discount-codes/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: input.trim().toUpperCase(), programId }),
    });
    const payload = await res.json();
    setChecking(false);
    if (!res.ok) { toast.error(payload?.error ?? "Invalid code."); return; }
    toast.success(`Code applied: ${payload.discountPercent}% off!`);
    onApplied(input.trim().toUpperCase(), payload.discountPercent as number);
  };

  const remove = () => {
    setInput("");
    onRemoved();
  };

  if (appliedCode) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
        <Tag className="h-3.5 w-3.5 text-emerald-600" />
        <span className="font-medium text-emerald-700">{appliedCode} applied</span>
        <button type="button" onClick={remove} className="ml-auto rounded p-0.5 text-emerald-500 hover:text-emerald-700">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Promo code"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter") void apply(); }}
        className="h-9 text-sm uppercase"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!input.trim() || checking}
        onClick={() => void apply()}
        className="h-9 shrink-0 text-xs"
      >
        {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
      </Button>
    </div>
  );
}

// ── Parent payment form (with cart) ──────────────────────────────────────────

function ParentPayForm({ onSuccess }: { onSuccess: () => void }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pendingCode, setPendingCode] = useState<{ code: string; percent: number } | undefined>(undefined);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/parent/children"), fetch("/api/programs")])
      .then(async ([cr, pr]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (cr.ok) { const p = await cr.json(); setChildren((p.children ?? []).map((c: any) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, enrollments: (c.enrollments ?? []).map((e: any) => ({ id: e.id, program: { ...e.program, monthlyFee: Number(e.program.monthlyFee) } })) }))); }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (pr.ok) { const p = await pr.json(); setPrograms((p.programs ?? []).filter((x: any) => x.isActive).map((x: any) => ({ id: x.id, name: x.name, monthlyFee: Number(x.monthlyFee) }))); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedChild   = useMemo(() => children.find((c) => c.id === selectedChildId) ?? null, [children, selectedChildId]);
  const selectedProgram = useMemo(() => programs.find((p) => p.id === selectedProgramId) ?? null, [programs, selectedProgramId]);

  useEffect(() => { setSelectedProgramId(""); setPendingCode(undefined); }, [selectedChildId]);
  useEffect(() => { setPendingCode(undefined); }, [selectedProgramId]);

  const enrolledProgramIds = useMemo(
    () => new Set(selectedChild?.enrollments.map((e) => e.program.id) ?? []),
    [selectedChild],
  );

  const cartItemId   = `${selectedChildId}-${selectedProgramId}-${billingMonth}`;
  const alreadyInCart = cart.some((i) => i.id === cartItemId);
  const cartTotal     = cart.reduce((sum, i) => sum + i.finalAmount, 0);
  const cartSavings   = cart.reduce((sum, i) => sum + (i.amount - i.finalAmount), 0);

  const baseAmount    = selectedProgram?.monthlyFee ?? 0;
  const discountedAmt = pendingCode ? Math.round(baseAmount * (1 - pendingCode.percent / 100)) : baseAmount;

  const addToCart = () => {
    if (!selectedChild || !selectedProgram) { toast.error("Select a child and program first."); return; }
    if (alreadyInCart) { toast.error("This item is already in your cart."); return; }
    setCart((prev) => [
      ...prev,
      {
        id: cartItemId,
        wardId: selectedChildId,
        wardName: `${selectedChild.firstName} ${selectedChild.lastName}`,
        programId: selectedProgramId,
        programName: selectedProgram.name,
        billingMonth,
        amount: selectedProgram.monthlyFee,
        finalAmount: discountedAmt,
        currency: "NGN",
        discountCode: pendingCode?.code,
        discountPercent: pendingCode?.percent,
      },
    ]);
    setSelectedProgramId("");
    setPendingCode(undefined);
    toast.success(`Added ${selectedProgram.name} for ${selectedChild.firstName} to cart.`);
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const checkout = async () => {
    if (cart.length === 0) { toast.error("Your cart is empty."); return; }
    setBusy(true);
    const response = await fetch("/api/payments/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "PAYSTACK",
        items: cart.map((item) => ({
          wardId: item.wardId,
          programId: item.programId,
          amount: item.amount,
          currency: item.currency,
          billingMonth: new Date(`${item.billingMonth}-01T00:00:00.000Z`).toISOString(),
          discountCode: item.discountCode,
        })),
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) { toast.error(payload?.error ?? "Could not initialize payment."); return; }

    const authUrl = payload.authorizationUrl as string;
    if (authUrl.includes("mock=true")) {
      const batchRef = new URL(authUrl, window.location.origin).searchParams.get("batchRef");
      if (batchRef) {
        const vr = await fetch("/api/payments/batch/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchReference: batchRef, provider: "PAYSTACK" }),
        });
        const vp = await vr.json();
        if (vr.ok) {
          toast.success(`${vp.paymentCount as number} payment${(vp.paymentCount as number) !== 1 ? "s" : ""} confirmed!`);
          setCart([]);
        } else {
          toast.error(vp?.error ?? "Verification failed.");
        }
      }
    } else {
      toast.success(`Redirecting to Paystack for ${cart.length} payment${cart.length !== 1 ? "s" : ""}…`);
      window.location.href = authUrl;
    }
    onSuccess();
  };

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /></div>;
  }

  if (children.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800">
        <User className="mx-auto mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No children linked yet</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Add your child&apos;s account in{" "}
          <a href="/dashboard/children" className="text-blue-600 hover:underline">My Children</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step 1: Select child */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Step 1 — Who are you paying for?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => setSelectedChildId(child.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                selectedChildId === child.id
                  ? "border-[#1E5FAF] bg-blue-50 ring-1 ring-[#1E5FAF]/20 dark:bg-blue-950/40"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
                {child.firstName[0]}{child.lastName[0]}
              </div>
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${selectedChildId === child.id ? "text-[#1E5FAF]" : "text-slate-800 dark:text-slate-200"}`}>
                  {child.firstName} {child.lastName}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{child.email}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Select program */}
      {selectedChild && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Step 2 — Select a program</p>
          {programs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">No programs available yet.</p>
          ) : (
            <div className="space-y-2">
              {programs.map((prog) => {
                const alreadyEnrolled = enrolledProgramIds.has(prog.id);
                const inCart = cart.some((i) => i.wardId === selectedChildId && i.programId === prog.id && i.billingMonth === billingMonth);
                return (
                  <button
                    key={prog.id}
                    type="button"
                    onClick={() => setSelectedProgramId(prog.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      selectedProgramId === prog.id
                        ? "border-[#1E5FAF] bg-blue-50 ring-1 ring-[#1E5FAF]/20 dark:bg-blue-950/40"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{prog.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">NGN {prog.monthlyFee.toLocaleString()} / month</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {inCart && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">In cart</span>}
                      {alreadyEnrolled && !inCart && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Enrolled</span>}
                      {selectedProgramId === prog.id && <span className="rounded-full bg-[#1E5FAF] px-2.5 py-0.5 text-xs font-semibold text-white">Selected</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Billing month + Promo code + Add to Cart */}
      {selectedProgram && selectedChild && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Step 3 — Billing month &amp; discount</p>
          <Input className="kat-date-input mb-3" type="month" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} />

          {/* Promo code */}
          <div className="mb-3">
            <PromoCodeInput
              programId={selectedProgramId}
              appliedCode={pendingCode?.code}
              onApplied={(code, percent) => setPendingCode({ code, percent })}
              onRemoved={() => setPendingCode(undefined)}
            />
          </div>

          {/* Summary */}
          <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>For</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{selectedChild.firstName} {selectedChild.lastName}</span>
            </div>
            <div className="mt-1 flex justify-between text-slate-500 dark:text-slate-400">
              <span>Program</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{selectedProgram.name}</span>
            </div>
            {pendingCode && (
              <div className="mt-1 flex justify-between text-emerald-600">
                <span>Discount ({pendingCode.percent}% off)</span>
                <span className="font-medium">− NGN {(baseAmount - discountedAmt).toLocaleString()}</span>
              </div>
            )}
            <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 font-semibold dark:border-slate-700">
              <span className="text-slate-700 dark:text-slate-300">Amount</span>
              <span className="text-[#1E5FAF]">
                {pendingCode && (
                  <span className="mr-2 text-xs font-normal text-slate-400 dark:text-slate-500 line-through">
                    NGN {baseAmount.toLocaleString()}
                  </span>
                )}
                NGN {discountedAmt.toLocaleString()}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            disabled={alreadyInCart}
            className="w-full rounded-xl border-[#1E5FAF] text-[#1E5FAF] hover:bg-blue-50"
            onClick={addToCart}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {alreadyInCart ? "Already in cart" : "Add to Cart"}
          </Button>
        </div>
      )}

      {/* Cart */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-xl border border-violet-200 bg-violet-50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-800">
                <ShoppingCart className="h-4 w-4" />
                Cart ({cart.length} item{cart.length !== 1 ? "s" : ""})
              </p>
              <div className="text-right">
                {cartSavings > 0 && (
                  <p className="text-xs font-medium text-emerald-600">Saving NGN {cartSavings.toLocaleString()}</p>
                )}
                <p className="text-sm font-bold text-violet-900">NGN {cartTotal.toLocaleString()}</p>
              </div>
            </div>
            <ul className="mb-4 space-y-2">
              {cart.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-800">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-200">{item.wardName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.programName} · {new Date(`${item.billingMonth}-01`).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
                    </p>
                    {item.discountCode && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600">
                        <Tag className="h-3 w-3" />
                        {item.discountCode} ({item.discountPercent}% off)
                      </p>
                    )}
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      {item.discountCode && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 line-through">NGN {item.amount.toLocaleString()}</p>
                      )}
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">NGN {item.finalAmount.toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40 transition-colors"
                      aria-label="Remove from cart"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              disabled={busy}
              className="h-11 w-full rounded-xl bg-[#1E5FAF] font-semibold hover:bg-[#1a52a0]"
              onClick={() => void checkout()}
            >
              {busy ? "Processing…" : `Checkout ${cart.length} payment${cart.length !== 1 ? "s" : ""} · NGN ${cartTotal.toLocaleString()} →`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared: org user search hook ─────────────────────────────────────────────

type OrgUser = { id: string; firstName: string; lastName: string; email: string; role: string };

function useOrgUsers(roles = "STUDENT,FELLOW,PARENT") {
  const [users, setUsers]   = useState<OrgUser[]>([]);
  const [query, setQuery]   = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(async () => {
      const q = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : "";
      const res = await fetch(`/api/org-users?role=${roles}${q}`);
      if (res.ok) { const p = await res.json() as { users?: OrgUser[] }; setUsers(p.users ?? []); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, roles]);

  return { users, query, setQuery, loading };
}

// ── Admin: Pay for a Student ──────────────────────────────────────────────────

function AdminPayForStudentForm({ onSuccess }: { onSuccess: () => void }) {
  const { users, query, setQuery, loading: usersLoading } = useOrgUsers("STUDENT,FELLOW");
  const [programs, setPrograms]     = useState<Program[]>([]);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [programId, setProgramId]   = useState("");
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [appliedCode, setAppliedCode] = useState<{ code: string; percent: number } | undefined>(undefined);
  const [busy, setBusy]             = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetch("/api/programs").then(async (r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (r.ok) { const p = await r.json(); setPrograms((p.programs ?? []).filter((x: any) => x.isActive).map((x: any) => ({ id: x.id, name: x.name, monthlyFee: Number(x.monthlyFee) }))); }
    });
  }, []);

  const selectedProgram = programs.find((p) => p.id === programId);
  const baseAmount = selectedProgram?.monthlyFee ?? 0;
  const finalAmount = appliedCode ? Math.round(baseAmount * (1 - appliedCode.percent / 100)) : baseAmount;

  useEffect(() => { setAppliedCode(undefined); }, [programId]);

  const selectUser = (u: OrgUser) => {
    setSelectedUser(u);
    setQuery(u.firstName + " " + u.lastName);
    setShowDropdown(false);
    setProgramId("");
    setAppliedCode(undefined);
  };

  const pay = async () => {
    if (!selectedUser || !programId) { toast.error("Select a student and program."); return; }
    setBusy(true);
    const response = await fetch("/api/payments/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wardId: selectedUser.id,
        programId,
        provider: "PAYSTACK",
        amount: baseAmount,
        currency: "NGN",
        billingMonth: new Date(`${billingMonth}-01T00:00:00.000Z`).toISOString(),
        discountCode: appliedCode?.code,
      }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) { toast.error(payload?.error ?? "Could not initialize payment."); return; }
    const authUrl = payload.authorizationUrl as string;
    if (authUrl.includes("mock=true")) {
      const ref = new URL(authUrl, window.location.origin).searchParams.get("reference");
      if (ref) {
        const vr = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: ref, provider: "PAYSTACK" }) });
        const vp = await vr.json();
        toast.success(vr.ok ? `Payment ${vp.payment?.status === "SUCCESS" ? "confirmed" : vp.payment?.status} for ${selectedUser.firstName}.` : (vp?.error ?? "Failed."));
      }
    } else {
      toast.success(`Redirecting to Paystack for ${selectedUser.firstName}…`);
      window.location.href = authUrl;
    }
    onSuccess();
  };

  return (
    <div className="space-y-3">
      {/* Student search */}
      <div className="relative">
        <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Student / Fellow</label>
        <div className="relative">
          <Input
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); if (!e.target.value) setSelectedUser(null); }}
            onFocus={() => setShowDropdown(true)}
            className="pr-8"
          />
          {usersLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
        </div>
        {showDropdown && users.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                onMouseDown={() => selectUser(u)}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
                  {u.firstName[0]}{u.lastName[0]}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{u.firstName} {u.lastName}</p>
                  <p className="truncate text-xs text-slate-400 dark:text-slate-500">{u.email} · {u.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Program */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Program</label>
        <Select value={programId || undefined} onValueChange={setProgramId} disabled={!selectedUser}>
          <SelectTrigger className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"><SelectValue placeholder="Select program" /></SelectTrigger>
          <SelectContent className="max-h-56 overflow-y-auto" position="popper" sideOffset={6}>
            {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — NGN {p.monthlyFee.toLocaleString()}/mo</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Billing month */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Billing month</label>
        <Input className="kat-date-input" type="month" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} />
      </div>

      {/* Promo code */}
      {programId && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Discount code (optional)</label>
          <PromoCodeInput
            programId={programId}
            appliedCode={appliedCode?.code}
            onApplied={(code, percent) => setAppliedCode({ code, percent })}
            onRemoved={() => setAppliedCode(undefined)}
          />
        </div>
      )}

      {/* Summary */}
      {selectedUser && selectedProgram && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>For</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{selectedUser.firstName} {selectedUser.lastName}</span>
          </div>
          <div className="mt-1 flex justify-between text-slate-500 dark:text-slate-400">
            <span>Program</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{selectedProgram.name}</span>
          </div>
          {appliedCode && (
            <div className="mt-1 flex justify-between text-emerald-600">
              <span>Discount ({appliedCode.percent}% off)</span>
              <span className="font-medium">− NGN {(baseAmount - finalAmount).toLocaleString()}</span>
            </div>
          )}
          <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 font-semibold dark:border-slate-700">
            <span className="text-slate-700 dark:text-slate-300">Amount</span>
            <span className="text-[#1E5FAF]">
              {appliedCode && <span className="mr-2 text-xs font-normal text-slate-400 dark:text-slate-500 line-through">NGN {baseAmount.toLocaleString()}</span>}
              NGN {finalAmount.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <Button
        disabled={busy || !selectedUser || !programId}
        className="w-full bg-[#1E5FAF] hover:bg-[#1a52a0]"
        onClick={() => void pay()}
      >
        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</> : "Pay for Student"}
      </Button>
    </div>
  );
}

// ── SA: Manual Enrollment ─────────────────────────────────────────────────────

function ManualEnrollmentForm({ programs, onSuccess }: { programs: Program[]; onSuccess: () => void }) {
  const { users, query, setQuery, loading: usersLoading } = useOrgUsers("STUDENT,FELLOW");
  const [selectedUsers, setSelectedUsers] = useState<OrgUser[]>([]);
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());
  const [billingType, setBillingType] = useState<"WAIVED" | "BILLABLE">("WAIVED");
  const [showDropdown, setShowDropdown] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleProgram = (id: string) =>
    setSelectedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const addUser = async (u: OrgUser) => {
    if (selectedUsers.some((x) => x.id === u.id)) return;
    setSelectedUsers((prev) => [...prev, u]);
    setQuery("");
    setShowDropdown(false);
    // Pre-select their existing enrollments
    try {
      const res = await fetch(`/api/enrollments?userId=${u.id}`);
      if (res.ok) {
        const p = await res.json() as { enrollments?: { program: { id: string } }[] };
        const enrolledIds: string[] = (p.enrollments ?? []).map((e) => e.program.id);
        if (enrolledIds.length > 0) {
          setSelectedProgramIds((prev) => {
            const next = new Set(prev);
            enrolledIds.forEach((id) => next.add(id));
            return next;
          });
        }
      }
    } catch { /* ignore */ }
  };

  const removeUser = (id: string) =>
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id));

  const enroll = async () => {
    if (selectedUsers.length === 0 || selectedProgramIds.size === 0) {
      toast.error("Select at least one student and one program.");
      return;
    }
    setBusy(true);
    const programIds = Array.from(selectedProgramIds);
    let successCount = 0;
    const errors: string[] = [];

    await Promise.all(
      selectedUsers.flatMap((user) =>
        programIds.map(async (programId) => {
          const res = await fetch("/api/enrollments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, programId, billingType }),
          });
          const p = await res.json();
          if (res.ok || res.status === 201) {
            successCount++;
          } else {
            const prog = programs.find((x) => x.id === programId);
            errors.push(`${user.firstName} → ${prog?.name ?? programId}: ${p?.error ?? "failed"}`);
          }
        }),
      ),
    );

    setBusy(false);
    if (successCount > 0) {
      toast.success(`Created ${successCount} enrollment${successCount !== 1 ? "s" : ""}.`);
      setSelectedUsers([]);
      setSelectedProgramIds(new Set());
      onSuccess();
    }
    errors.forEach((e) => toast.error(e));
  };

  const totalEnrollments = selectedUsers.length * selectedProgramIds.size;

  return (
    <div className="space-y-4">
      {/* Student search */}
      <div className="relative">
        <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Students / Fellows <span className="text-slate-400 dark:text-slate-500">(add one or more)</span>
        </label>

        {/* Selected students chips */}
        {selectedUsers.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedUsers.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1.5 rounded-full bg-violet-100 py-1 pl-2.5 pr-1.5 text-xs font-medium text-violet-800"
              >
                {u.firstName} {u.lastName}
                <button
                  type="button"
                  onClick={() => removeUser(u.id)}
                  className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-violet-200 transition-colors"
                  aria-label={`Remove ${u.firstName}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <Input
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            className="pr-8"
          />
          {usersLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
        </div>
        {showDropdown && users.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {users.map((u) => {
              const already = selectedUsers.some((x) => x.id === u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${already ? "bg-violet-50 dark:bg-violet-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                  onMouseDown={() => { if (!already) void addUser(u); }}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{u.firstName} {u.lastName}</p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">{u.email} · {u.role}</p>
                  </div>
                  {already && <Check className="h-4 w-4 shrink-0 text-violet-500" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Program multi-select */}
      {programs.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Programs <span className="text-slate-400 dark:text-slate-500">(select one or more)</span>
          </label>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
            {programs.map((prog) => {
              const checked = selectedProgramIds.has(prog.id);
              return (
                <button
                  key={prog.id}
                  type="button"
                  onClick={() => toggleProgram(prog.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                    checked
                      ? "border-[#1E5FAF] bg-blue-50 ring-1 ring-[#1E5FAF]/20 dark:bg-blue-950/40"
                      : "border-transparent bg-white hover:border-slate-200 dark:bg-slate-900 dark:hover:border-slate-700"
                  }`}
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${checked ? "border-[#1E5FAF] bg-[#1E5FAF]" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"}`}>
                    {checked && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{prog.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">NGN {prog.monthlyFee.toLocaleString()} / mo</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Billing type */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Billing
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["WAIVED", "BILLABLE"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setBillingType(type)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                billingType === type
                  ? type === "WAIVED"
                    ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400/30 dark:bg-emerald-950/40"
                    : "border-amber-400 bg-amber-50 ring-1 ring-amber-400/30 dark:bg-amber-950/40"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              <p className={`text-sm font-semibold ${
                billingType === type
                  ? type === "WAIVED" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                  : "text-slate-700 dark:text-slate-300"
              }`}>
                {type === "WAIVED" ? "Waived" : "Billable"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {type === "WAIVED"
                  ? "No payment required — scholarship or admin grant"
                  : "Billing starts today — 30-day cycle"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {totalEnrollments > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This will create <strong>{totalEnrollments}</strong> enrollment{totalEnrollments !== 1 ? "s" : ""}{" "}
          ({selectedUsers.length} student{selectedUsers.length !== 1 ? "s" : ""} × {selectedProgramIds.size} program{selectedProgramIds.size !== 1 ? "s" : ""}){" "}
          — <span className={billingType === "WAIVED" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
            {billingType === "WAIVED" ? "billing waived" : "first payment due in 30 days"}
          </span>.
        </p>
      )}

      <Button
        disabled={busy || selectedUsers.length === 0 || selectedProgramIds.size === 0}
        className="w-full bg-violet-600 hover:bg-violet-700"
        onClick={() => void enroll()}
      >
        {busy
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enrolling…</>
          : <><UserPlus className="mr-2 h-4 w-4" />Manually Enroll {totalEnrollments > 0 ? `(${totalEnrollments})` : ""}</>}
      </Button>
    </div>
  );
}

// ── SA: Enrollments manager ───────────────────────────────────────────────────

type EnrollmentRecord = {
  id: string;
  status: string;
  isBillingWaived: boolean;
  currentPeriodEnd: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; role: string } | null;
  program: { id: string; name: string } | null;
  cohort: { id: string; name: string } | null;
};

const ENROLLMENT_STATUS_STYLES: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  COMPLETED: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  PAUSED:    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  DROPPED:   "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
};

function EnrollmentsManager() {
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [droppingId, setDroppingId]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/enrollments");
    if (res.ok) {
      const p = await res.json() as { enrollments?: EnrollmentRecord[] };
      setEnrollments(p.enrollments ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const unenroll = async (enrollment: EnrollmentRecord) => {
    setDroppingId(enrollment.id);
    const res = await fetch("/api/enrollments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId: enrollment.id, status: "DROPPED" }),
    });
    setDroppingId(null);
    if (res.ok) {
      setEnrollments((prev) =>
        prev.map((e) => e.id === enrollment.id ? { ...e, status: "DROPPED" } : e),
      );
      const name = enrollment.user ? `${enrollment.user.firstName} ${enrollment.user.lastName}` : "Student";
      toast.success(`${name} unenrolled from ${enrollment.program?.name ?? "program"}.`);
    } else {
      toast.error("Could not unenroll.");
    }
  };

  const filtered = enrollments.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.user?.firstName.toLowerCase().includes(q) ||
      e.user?.lastName.toLowerCase().includes(q) ||
      e.program?.name.toLowerCase().includes(q) ||
      e.cohort?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="kat-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Enrollments</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">View all org enrollments and unenroll students when needed.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <div className="mt-4">
        <Input
          placeholder="Search by name or program…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
            <UserPlus className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400 dark:text-slate-500">{search ? "No results." : "No enrollments yet."}</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {filtered.map((e) => (
              <div
                key={e.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${e.status === "DROPPED" ? "border-slate-100 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-800/50" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}
              >
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                  {e.user?.firstName?.[0] ?? "?"}{e.user?.lastName?.[0] ?? ""}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {e.user ? `${e.user.firstName} ${e.user.lastName}` : "Unknown"}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{e.user?.role}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ENROLLMENT_STATUS_STYLES[e.status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"}`}>
                      {e.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {e.program?.name ?? "—"}
                    {e.cohort ? ` · ${e.cohort.name}` : ""}
                    {" · "}Enrolled {new Date(e.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    {e.isBillingWaived
                      ? <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Waived</span>
                      : e.currentPeriodEnd
                        ? <span className="ml-1.5 text-slate-400"> · Due {new Date(e.currentPeriodEnd).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
                        : null}
                  </p>
                </div>

                {/* Actions */}
                {e.status !== "DROPPED" && (
                  <button
                    type="button"
                    title="Unenroll"
                    disabled={droppingId === e.id}
                    onClick={() => void unenroll(e)}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                  >
                    {droppingId === e.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><UserMinus className="h-3.5 w-3.5" /> Unenroll</>}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            {filtered.length} enrollment{filtered.length !== 1 ? "s" : ""}
            {search ? " matching" : ""} · {enrollments.filter((e) => e.status === "ACTIVE").length} active
          </p>
        )}
      </div>
    </div>
  );
}

// ── SA: Discount Codes management ────────────────────────────────────────────

type DCFormState = {
  code: string;
  description: string;
  discountPercent: string;
  programId: string;
  maxUses: string;
  expiresAt: string;
};

const DC_FORM_DEFAULTS: DCFormState = { code: "", description: "", discountPercent: "", programId: "", maxUses: "", expiresAt: "" };

function DiscountCodesManager({ programs }: { programs: Program[] }) {
  const [codes, setCodes]       = useState<DiscountCode[]>([]);
  const [loading, setLoading]   = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm]         = useState<DCFormState>(DC_FORM_DEFAULTS);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/discount-codes");
    if (res.ok) {
      const p = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCodes((p.codes ?? []).map((c: any) => ({ ...c, discountPercent: Number(c.discountPercent) })));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!form.code.trim() || !form.discountPercent) { toast.error("Code and discount % are required."); return; }
    setSaving(true);
    const res = await fetch("/api/discount-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code:            form.code.trim().toUpperCase(),
        description:     form.description || undefined,
        discountPercent: Number(form.discountPercent),
        programId:       form.programId || undefined,
        maxUses:         form.maxUses ? Number(form.maxUses) : undefined,
        expiresAt:       form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      }),
    });
    const p = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(p?.error ?? "Could not create code."); return; }
    toast.success(`Code ${p.code.code} created.`);
    setFormOpen(false);
    setForm(DC_FORM_DEFAULTS);
    void load();
  };

  const toggleActive = async (codeId: string, current: boolean) => {
    const res = await fetch(`/api/discount-codes/${codeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok) {
      setCodes((prev) => prev.map((c) => c.id === codeId ? { ...c, isActive: !current } : c));
      toast.success(!current ? "Code activated." : "Code deactivated.");
    } else {
      toast.error("Could not update code.");
    }
  };

  const deleteCode = async (codeId: string, code: string) => {
    const res = await fetch(`/api/discount-codes/${codeId}`, { method: "DELETE" });
    if (res.ok) {
      setCodes((prev) => prev.filter((c) => c.id !== codeId));
      toast.success(`Code ${code} deleted.`);
    } else {
      toast.error("Could not delete code.");
    }
  };

  return (
    <div className="kat-card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Discount Codes</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Create special promo codes for individual learners.</p>
        </div>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-[#1E5FAF] hover:bg-[#1a52a0]">
              <Plus className="h-4 w-4" /> New Code
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-700">
            <DialogHeader>
              <DialogTitle>Create Discount Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Code <span className="text-rose-500">*</span></label>
                <Input
                  placeholder="e.g. SCHOLAR25"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="uppercase"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Discount % <span className="text-rose-500">*</span></label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="e.g. 25"
                  value={form.discountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Description</label>
                <Input
                  placeholder="Internal note (e.g. Scholarship — John Doe)"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Restrict to program</label>
                <Select value={form.programId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, programId: v === "__all" ? "" : v }))}>
                  <SelectTrigger className="h-10 w-full rounded-xl text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"><SelectValue placeholder="All programs" /></SelectTrigger>
                  <SelectContent position="popper" sideOffset={6}>
                    <SelectItem value="__all">All programs</SelectItem>
                    {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Max uses</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={form.maxUses}
                    onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Expires</label>
                  <Input
                    type="date"
                    className="kat-date-input"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Cancel</Button>
                <Button disabled={saving} className="flex-1 bg-[#1E5FAF] hover:bg-[#1a52a0]" onClick={() => void create()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Code"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : codes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
            <Tag className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400 dark:text-slate-500">No discount codes yet.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {codes.map((dc) => (
              <div
                key={dc.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${dc.isActive ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" : "border-slate-100 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-800/50"}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <Tag className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">{dc.code}</span>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                      {dc.discountPercent}% off
                    </span>
                    {dc.program && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                        {dc.program.name}
                      </span>
                    )}
                    {!dc.isActive && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">Inactive</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                    <span>{dc._count.redemptions} use{dc._count.redemptions !== 1 ? "s" : ""}{dc.maxUses ? ` / ${dc.maxUses}` : ""}</span>
                    {dc.expiresAt && <span>Expires {new Date(dc.expiresAt).toLocaleDateString()}</span>}
                    {dc.description && <span className="truncate max-w-[180px]">{dc.description}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title={dc.isActive ? "Deactivate" : "Activate"}
                    onClick={() => void toggleActive(dc.id, dc.isActive)}
                    className={`rounded-lg p-1.5 transition-colors ${dc.isActive ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => void deleteCode(dc.id, dc.code)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function PaymentsPanel({ role }: { role: string }) {
  const isParent = role === "PARENT";
  const isAdmin  = role === "SUPER_ADMIN" || role === "ADMIN";
  const isSA     = role === "SUPER_ADMIN";
  const canVerify = isAdmin;

  const [loading, setLoading]             = useState(true);
  const [payments, setPayments]           = useState<PaymentRecord[]>([]);
  const [programs, setPrograms]           = useState<Program[]>([]);
  const [total, setTotal]                 = useState(0);
  const [nextCursor, setNextCursor]       = useState<string | null>(null);
  const [cursorStack, setCursorStack]     = useState<string[]>([]);
  const [hasMore, setHasMore]             = useState(false);
  const [referenceToVerify, setReferenceToVerify] = useState("");
  const [busy, setBusy]                   = useState(false);
  const autoVerifyRan = useRef(false);

  const loadPayments = async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/payments?${params.toString()}`);
    if (res.ok) {
      const payload = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPayments((payload.payments ?? []).map((p: any) => ({ ...p, amount: Number(p.amount) })));
      setTotal(payload.meta?.total ?? 0);
      setNextCursor(payload.meta?.nextCursor ?? null);
      setHasMore(payload.meta?.hasMore ?? false);
    }
    setLoading(false);
  };

  useEffect(() => { void loadPayments(); }, []);

  useEffect(() => {
    if (isSA) {
      fetch("/api/programs").then(async (r) => {
        if (r.ok) {
          const p = await r.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setPrograms((p.programs ?? []).map((x: any) => ({ id: x.id, name: x.name, monthlyFee: Number(x.monthlyFee) })));
        }
      });
    }
  }, [isSA]);

  useEffect(() => {
    if (autoVerifyRan.current) return;
    const params  = new URLSearchParams(window.location.search);
    const ref      = params.get("reference");
    const batchRef = params.get("batchRef");
    if (!ref && !batchRef) return;
    autoVerifyRan.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    toast.info("Verifying your payment…");
    void (async () => {
      if (batchRef) {
        const res = await fetch("/api/payments/batch/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchReference: batchRef, provider: "PAYSTACK" }) });
        const payload = await res.json();
        if (res.ok) {
          toast.success(`${payload.paymentCount as number} payment${(payload.paymentCount as number) !== 1 ? "s" : ""} confirmed!`);
        } else {
          toast.error(payload?.error ?? "Batch verification failed.");
        }
      } else {
        const res = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: ref, provider: "PAYSTACK" }) });
        const payload = await res.json();
        if (res.ok) {
          toast.success(`Payment ${payload.payment.status === "SUCCESS" ? "confirmed" : payload.payment.status}.`);
        } else {
          toast.error(payload?.error ?? "Auto-verification failed.");
          setReferenceToVerify(ref!);
        }
      }
      await loadPayments();
    })();
  }, []);

  const verifyPayment = async () => {
    if (!referenceToVerify.trim()) { toast.error("Enter a payment reference."); return; }
    setBusy(true);
    const res = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: referenceToVerify.trim(), provider: "PAYSTACK" }) });
    const payload = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(payload?.error ?? "Verification failed."); return; }
    toast.success(`Verification complete: ${payload.payment.status}`);
    setReferenceToVerify("");
    await loadPayments(cursorStack[cursorStack.length - 1]);
  };

  const hasPrev     = cursorStack.length > 0;
  const currentPage = cursorStack.length + 1;
  const showFor     = isAdmin || isParent;

  return (
    <div className="space-y-4">
      {(isParent || isAdmin || canVerify) && (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {isParent && (
            <div className="kat-card">
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Pay for Your Children</h3>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Add payments for one or more children to your cart, then checkout in a single transaction.</p>
              <ParentPayForm onSuccess={() => void loadPayments(0)} />
            </div>
          )}

          {isAdmin && (
            <div className="kat-card">
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Pay for a Student</h3>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Process a payment on behalf of a student and redirect to Paystack.</p>
              <AdminPayForStudentForm onSuccess={() => void loadPayments(0)} />
            </div>
          )}

          {canVerify && (
            <div className="kat-card">
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Verify Financial Records</h3>
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Confirm transactions and maintain receipt transparency.</p>
              <div className="space-y-3">
                <Input placeholder="Reference (e.g. KAT-ABC-123)" value={referenceToVerify} onChange={(e) => setReferenceToVerify(e.target.value)} />
                <Button disabled={busy} variant="outline" className="w-full" onClick={() => void verifyPayment()}>
                  {busy ? "Verifying…" : "Verify Transaction"}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* SA: Discount code management */}
      {isSA && <DiscountCodesManager programs={programs} />}

      {/* SA: Enrollments list */}
      {isSA && <EnrollmentsManager />}

      {/* SA: Manual enrollment (bank-transfer / offline payment) */}
      {isSA && (
        <div className="kat-card">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
              <UserPlus className="h-5 w-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Manual Enrollment</h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                For students whose parents paid via bank transfer and showed a receipt. Enroll them directly without going through Paystack.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <ManualEnrollmentForm programs={programs} onSuccess={() => void loadPayments(0)} />
          </div>
        </div>
      )}

      <section className="kat-card">
        <div className="flex items-center justify-between">
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Financial History</h3>
          {total > 0 && <p className="text-xs text-slate-400 dark:text-slate-500">Page {currentPage} · {total} total</p>}
        </div>

        <div className="mt-4 max-h-96 overflow-auto pb-1">
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : payments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No payment records yet.</p>
          ) : (
            <table className="min-w-[820px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="pb-2 pr-4">Reference</th>
                  {showFor && <th className="pb-2 pr-4">For</th>}
                  <th className="pb-2 pr-4">Program</th>
                  <th className="pb-2 pr-4">Month</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((payment, index) => (
                  <motion.tr key={payment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                    <td className="py-3 pr-4 font-mono text-xs">{payment.reference}</td>
                    {showFor && (
                      <td className="py-3 pr-4">
                        {payment.user ? `${payment.user.firstName} ${payment.user.lastName}` : <span className="text-slate-400 dark:text-slate-500">—</span>}
                      </td>
                    )}
                    <td className="py-3 pr-4">{payment.program?.name ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {new Date(payment.billingMonth).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 pr-4">{payment.currency} {payment.amount.toLocaleString()}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[payment.status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {payment.receipt ? (
                        <a href={`/dashboard/payments/receipt/${payment.receipt.id}`} className="text-xs font-medium text-sky-600 hover:underline">
                          {payment.receipt.receiptNumber}
                        </a>
                      ) : <span className="text-slate-400 dark:text-slate-500">—</span>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {(hasPrev || hasMore) && (
          <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button variant="outline" size="sm" disabled={!hasPrev || loading} onClick={() => {
              const newStack = cursorStack.slice(0, -1);
              setCursorStack(newStack);
              void loadPayments(newStack[newStack.length - 1]);
            }}>Previous</Button>
            <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => {
              if (nextCursor) {
                setCursorStack(prev => [...prev, nextCursor]);
                void loadPayments(nextCursor);
              }
            }}>Next</Button>
          </div>
        )}
      </section>
    </div>
  );
}