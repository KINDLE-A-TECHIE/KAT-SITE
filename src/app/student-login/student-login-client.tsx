"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { ArrowLeft, Delete, Loader2 } from "lucide-react";

/**
 * Pupil sign-in by class code + PIN (Option B), for schools with no system to launch from.
 *
 * Lives at the app root (NOT under /learn, which middleware login-gates) so a pupil with no session
 * can reach it. Three steps, each big and simple for a young child: class code → pick your name →
 * type your PIN. Names only load AFTER a valid teacher-controlled code, and show first name + last
 * initial only.
 */

type Pupil = { ref: string; firstName: string; lastInitial: string };
type Step = "code" | "name" | "pin";

export function StudentLoginClient() {
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [className, setClassName] = useState("");
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [pupil, setPupil] = useState<Pupil | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/school/student-login/roster?code=${encodeURIComponent(code)}`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data?.error ?? "We couldn't find that class code."); return; }
    if ((data.pupils ?? []).length === 0) { setError("No pupils are set up for sign-in in this class yet."); return; }
    setClassName(data.className ?? "");
    setPupils(data.pupils);
    setStep("name");
  };

  const pickName = (p: Pupil) => {
    setPupil(p);
    setPin("");
    setError(null);
    setStep("pin");
  };

  const pressDigit = (d: string) => {
    setError(null);
    setPin((prev) => (prev.length >= 6 ? prev : prev + d));
  };

  const submitPin = async () => {
    if (!pupil || pin.length < 4) return;
    setBusy(true);
    setError(null);
    const res = await signIn("student-pin", {
      classCode: code,
      pupilRef: pupil.ref,
      pin,
      redirect: false,
    });
    setBusy(false);
    if (res?.ok) {
      window.location.assign("/learn");
    } else {
      setPin("");
      setError(res?.error ?? "That PIN is not right. Check your card and try again.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 dark:bg-stone-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Image src="/kindle-a-techie.svg" alt="KAT Learning" width={44} height={44} />
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-stone-400 dark:text-stone-500">
            Student sign-in
          </p>
        </div>

        {/* Step 1: class code */}
        {step === "code" && (
          <form onSubmit={submitCode} className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
            <label htmlFor="code" className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Enter your class code
            </label>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">It&apos;s on the card from your teacher.</p>
            <input
              id="code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={16}
              className="mt-4 w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-center font-mono text-2xl uppercase tracking-[0.3em] text-stone-900 outline-none focus:border-kat-clay focus:ring-2 focus:ring-orange-200 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            />
            {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.trim().length < 4}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-kat-clay px-4 py-3 font-semibold text-white transition hover:bg-kat-clay-deep disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Next
            </button>
          </form>
        )}

        {/* Step 2: pick your name */}
        {step === "name" && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
            <button onClick={() => { setStep("code"); setError(null); }} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-kat-clay dark:text-stone-400">
              <ArrowLeft className="size-3" /> Class code
            </button>
            <p className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">Find your name</p>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{className}</p>
            <div className="mt-4 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto">
              {pupils.map((p) => (
                <button
                  key={p.ref}
                  onClick={() => pickName(p)}
                  className="rounded-lg border border-stone-200 px-4 py-3 text-left text-base font-medium text-stone-800 transition hover:border-kat-clay hover:bg-orange-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-orange-950/30"
                >
                  {p.firstName} {p.lastInitial}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: PIN pad */}
        {step === "pin" && pupil && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
            <button onClick={() => { setStep("name"); setPin(""); setError(null); }} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-kat-clay dark:text-stone-400">
              <ArrowLeft className="size-3" /> Names
            </button>
            <p className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Hi {pupil.firstName}! Type your PIN
            </p>

            {/* PIN dots */}
            <div className="mt-4 flex justify-center gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={`size-3.5 rounded-full ${i < pin.length ? "bg-kat-clay" : "bg-stone-200 dark:bg-stone-700"}`}
                />
              ))}
            </div>
            {error && <p className="mt-3 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>}

            {/* Keypad */}
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  onClick={() => pressDigit(d)}
                  className="rounded-lg border border-stone-200 py-4 font-mono text-2xl font-semibold text-stone-800 transition hover:bg-stone-50 active:bg-stone-100 dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-800"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => setPin((p) => p.slice(0, -1))}
                aria-label="Delete"
                className="flex items-center justify-center rounded-lg border border-stone-200 py-4 text-stone-500 transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
              >
                <Delete className="size-6" />
              </button>
              <button
                onClick={() => pressDigit("0")}
                className="rounded-lg border border-stone-200 py-4 font-mono text-2xl font-semibold text-stone-800 transition hover:bg-stone-50 active:bg-stone-100 dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-800"
              >
                0
              </button>
              <button
                onClick={() => void submitPin()}
                disabled={busy || pin.length < 4}
                aria-label="Sign in"
                className="flex items-center justify-center rounded-lg bg-kat-clay py-4 font-semibold text-white transition hover:bg-kat-clay-deep disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-5 animate-spin" /> : "Go"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
