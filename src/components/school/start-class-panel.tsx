"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { KeyRound, Loader2, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * In-class sign-in (Option A). For a computer lab with no management system: the teacher taps a
 * pupil, a 60-second QR appears, the pupil scans it on their own device and lands in their lesson.
 * No pupil password exists. Authority is the teacher's ownership of this class, enforced server-side.
 */

type Pupil = { enrollmentId: string; name: string };

export function StartClassPanel({ classId }: { classId: string }) {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [active, setActive] = useState<{ name: string; qr: string; expiresAt: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/school/teach/launch?classId=${encodeURIComponent(classId)}`);
    if (res.ok) {
      const data = await res.json();
      setPupils(data.pupils ?? []);
    }
    setLoading(false);
  }, [classId]);

  useEffect(() => { void load(); }, [load]);

  // Countdown for the open QR; the link is only valid for 60s.
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const left = Math.max(0, Math.round((active.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setActive(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  const launch = async (pupil: Pupil) => {
    setBusyId(pupil.enrollmentId);
    try {
      const res = await fetch("/api/school/teach/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: pupil.enrollmentId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Could not create the sign-in link."); return; }
      const qr = await QRCode.toDataURL(data.launchUrl as string, { width: 320, margin: 1 });
      setActive({ name: pupil.name, qr, expiresAt: new Date(data.expiresAt).getTime() });
    } catch {
      toast.error("Could not create the sign-in link.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 sm:p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-kat-clay" />
        <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">In-class sign-in</h2>
      </div>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Tap a pupil, then have them scan the code on their own device. Each code works once and lasts one minute.
      </p>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ) : pupils.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400 dark:text-stone-500">No pupils on this class yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {pupils.map((p) => (
              <li key={p.enrollmentId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="truncate text-sm font-medium text-stone-800 dark:text-stone-200">{p.name}</span>
                <button
                  onClick={() => void launch(p)}
                  disabled={busyId === p.enrollmentId}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-kat-clay px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-kat-clay-deep disabled:opacity-50"
                >
                  {busyId === p.enrollmentId ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Sign in
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* QR modal */}
      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setActive(null)}>
          <div
            className="w-full max-w-xs rounded-lg bg-white p-6 text-center dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-bold text-stone-900 dark:text-stone-100">{active.name}</p>
              <button onClick={() => setActive(null)} aria-label="Close" className="text-stone-400 hover:text-stone-600">
                <X className="size-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.qr} alt="Sign-in QR code" className="mx-auto mt-4 h-56 w-56 rounded-md border border-stone-200 dark:border-stone-700" />
            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
              Scan to sign in. Expires in{" "}
              <span className="font-mono font-semibold tabular-nums text-stone-800 dark:text-stone-200">{secondsLeft}s</span>.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
