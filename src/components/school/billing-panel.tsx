"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Loader2, Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Invoice = {
  id: string;
  term: string;
  seatCount: number;
  amount: number;
  status: "DRAFT" | "PENDING" | "PAID" | "VOID";
  paystackRef: string;
  createdAt: string;
};

type License = {
  term: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  seatLimit: number;
  seatsUsed: number;
};

type Billing = {
  school: { name: string; pricePerSeat: number };
  invoices: Invoice[];
  licenses: License[];
};

const INVOICE_BADGE: Record<Invoice["status"], string> = {
  PAID: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400",
  PENDING: "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400",
  DRAFT: "bg-stone-100 text-stone-600 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-300",
  VOID: "bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400",
};

const LICENSE_BADGE: Record<License["status"], string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400",
  PENDING: "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400",
  EXPIRED: "bg-stone-200 text-stone-600 hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-300",
  CANCELLED: "bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400",
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

export function BillingPanel() {
  const searchParams = useSearchParams();
  const returnedRef = searchParams.get("reference");

  const [data, setData] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [seats, setSeats] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/school/billing/invoices");
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not load billing.");
      setLoading(false);
      return;
    }
    setData(payload as Billing);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Verify-on-return: the webhook is authoritative, but it can be late. When Paystack
  // sends the admin back here, re-verify so they are never left paid-but-locked-out.
  useEffect(() => {
    if (!returnedRef) return;
    (async () => {
      const res = await fetch("/api/school/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: returnedRef }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.paid) {
        toast.success(`Payment confirmed. ${payload.term} is now active.`);
      } else if (res.ok) {
        toast.info("Payment not confirmed yet. It will activate automatically once it clears.");
      }
      await load();
    })();
  }, [returnedRef, load]);

  const seatCount = Number(seats);
  const preview =
    data && Number.isFinite(seatCount) && seatCount > 0
      ? seatCount * data.school.pricePerSeat
      : 0;

  const createInvoice = async () => {
    setBusy(true);
    const res = await fetch("/api/school/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // NOTE: no amount is sent, the server computes it from the school's agreed price.
      body: JSON.stringify({ term, seatCount }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      toast.error(payload?.error ?? "Could not create the invoice.");
      return;
    }
    setOpen(false);
    if (payload.authorizationUrl) {
      window.location.assign(payload.authorizationUrl); // straight to Paystack
      return;
    }
    toast.success("Invoice created. Payment could not be started. Try Pay now.");
    await load();
  };

  const payInvoice = async (invoice: Invoice) => {
    // Re-raise checkout for an existing PENDING invoice by verifying first; if it is
    // still unpaid, Paystack's hosted page can be reached with the same reference.
    toast.info("Opening Paystack…");
    window.location.assign(
      `https://checkout.paystack.com/${encodeURIComponent(invoice.paystackRef)}`,
    );
  };

  if (loading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (!data) return null;

  const noPrice = data.school.pricePerSeat <= 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Billing</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
            Seats &amp; licences
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {noPrice
              ? "No seat price agreed yet. Contact KAT."
              : `${naira(data.school.pricePerSeat)} per seat, per term.`}
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          disabled={noPrice}
          className="gap-1.5 bg-orange-600 text-white hover:bg-orange-700"
        >
          <Plus className="size-4" />
          Confirm seats for a term
        </Button>
      </header>

      {/* Licences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Licences</CardTitle>
          <CardDescription>
            A term unlocks for teachers and students once its invoice is paid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.licenses.length === 0 ? (
            <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
              No licence yet. Confirm your seat count for a term to raise an invoice.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {data.licenses.map((l) => (
                <li key={l.term} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-stone-900 dark:text-stone-100">{l.term}</p>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                      {l.seatsUsed} of {l.seatLimit} seats used
                    </p>
                  </div>
                  <Badge className={LICENSE_BADGE[l.status]}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="size-4 text-orange-600" />
            Invoices
          </CardTitle>
          <CardDescription>
            {data.invoices.length === 0 ? "No invoices yet." : `${data.invoices.length} invoice(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
              Invoices you raise will appear here with their payment status.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400 dark:border-stone-800">
                    <th className="pb-2 font-medium">Term</th>
                    <th className="pb-2 text-center font-medium">Seats</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                    <th className="pb-2 text-center font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Reference</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {data.invoices.map((i) => (
                    <tr key={i.id}>
                      <td className="py-2 pr-3 font-medium text-stone-900 dark:text-stone-100">{i.term}</td>
                      <td className="py-2 text-center text-stone-500 dark:text-stone-400">{i.seatCount}</td>
                      <td className="py-2 text-right font-medium text-stone-800 dark:text-stone-200">
                        {naira(i.amount)}
                      </td>
                      <td className="py-2 text-center">
                        <Badge className={INVOICE_BADGE[i.status]}>{i.status}</Badge>
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-stone-400">{i.paystackRef}</td>
                      <td className="py-2 pl-3 text-right">
                        {i.status === "PENDING" ? (
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => payInvoice(i)}>
                            <CreditCard className="size-3.5" />
                            Pay now
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New invoice */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm seats for a term</DialogTitle>
            <DialogDescription>
              The seat count is the total for that term. Paying activates the term&apos;s licence.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="term">Term</Label>
              <Input
                id="term"
                placeholder="e.g. 2025/2026 T1"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seats">Seats</Label>
              <Input
                id="seats"
                type="number"
                min={1}
                placeholder="e.g. 120"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
              />
            </div>

            <div className="rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-800/50">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-stone-400">
                  {seatCount > 0 ? `${seatCount} × ${naira(data.school.pricePerSeat)}` : "Amount"}
                </span>
                <span className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {naira(preview)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={createInvoice}
              disabled={busy || !term.trim() || !(seatCount > 0)}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              {busy ? "Creating…" : "Raise invoice & pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
