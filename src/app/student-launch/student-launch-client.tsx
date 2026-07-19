"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, XCircle } from "lucide-react";

/**
 * Redeems a teacher-minted launch token into a pupil session.
 *
 * Lives at the app root (NOT under /learn) on purpose: /learn is login-gated by middleware, and the
 * pupil has no session YET, this page is how they get one. The token arrives in the URL FRAGMENT
 * (`#t=…`), which never reaches the server or a Referer header. We read it, exchange it via the
 * "student-launch" NextAuth provider, strip it from the address bar, and land on /learn.
 */
export function StudentLaunchClient() {
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false); // React StrictMode double-invokes effects; a launch token is single-use.

  const redeem = useCallback(async () => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const token = new URLSearchParams(hash).get("t");
    if (!token) {
      setError("This sign-in link is incomplete. Ask your teacher to show it again.");
      return;
    }
    // Strip the token from the address bar before anything else, so it is not left in history.
    window.history.replaceState(null, "", "/student-launch");

    const res = await signIn("student-launch", { token, redirect: false });
    if (res?.ok) {
      window.location.assign("/learn");
    } else {
      setError(res?.error ?? "This sign-in link has expired. Ask your teacher for a new one.");
    }
  }, []);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void redeem();
  }, [redeem]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 dark:bg-stone-950">
      {error ? (
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
            <XCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-4 font-display text-lg font-bold text-stone-900 dark:text-stone-100">
            Let&apos;s try again
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{error}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-kat-clay" />
          <p className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
            Getting your class ready…
          </p>
        </div>
      )}
    </main>
  );
}
