"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";

type State =
  | { kind: "starting" }
  | { kind: "no-token" }
  | { kind: "blocked"; href: string }
  | { kind: "error"; message: string };

/**
 * Exchanges a launch token for an embed session, inside the iframe.
 *
 * WHY THE FRAGMENT. The token arrives as `#t=…`, not `?t=…`. A fragment is never sent to a server,
 * so the token stays out of our access logs, out of `Referer` headers to third parties, and out of
 * any analytics the school's page happens to run. It is a bearer credential for a child's session;
 * a query string is the wrong place for it. We strip it from the URL the moment it is spent.
 *
 * WHY THE FALLBACK. This is a third-party iframe, so the session cookie must be
 * `SameSite=None; Secure; Partitioned`. That works in Chrome, Edge and Firefox. It does NOT reliably
 * work in Safari, whose Storage Access API grant has historically required prior first-party
 * interaction with our domain, a condition a pupil launching from their school's portal, who has
 * never visited us directly, will simply fail.
 *
 * So when the cookie does not stick, we do not show a broken empty frame to a Year-5 teacher with no
 * way to debug it. We render one button that performs the SAME exchange in a TOP-LEVEL tab, where
 * cookies work in every browser ever shipped. It degrades honestly.
 */
export function EmbedLauncher({
  schoolSlug,
  schoolName,
}: {
  schoolSlug: string;
  schoolName: string;
}) {
  const [state, setState] = useState<State>({ kind: "starting" });
  // A launch token is single-use: redeeming twice burns it. React 18 StrictMode double-invokes
  // effects in development, which would spend the token and then fail on the replay guard.
  const spent = useRef(false);

  const redeem = useCallback(async () => {
    const hash = window.location.hash;
    const token = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash).get("t");

    if (!token) {
      setState({ kind: "no-token" });
      return;
    }
    if (spent.current) return;
    spent.current = true;

    // Strip the token from the address bar before anything else can read it back.
    window.history.replaceState(null, "", window.location.pathname);

    const res = await fetch("/api/school/embed/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, schoolSlug }),
    });

    const payload = (await res.json().catch(() => ({}))) as { error?: string; handoff?: string };

    if (!res.ok) {
      setState({ kind: "error", message: payload.error ?? "This link is no longer valid." });
      return;
    }

    // The exchange succeeded, but did the browser KEEP the cookie? It drops a third-party cookie
    // silently, with no error, so we have to ask the server. Reloading blindly would loop forever
    // in Safari, showing a pupil an empty frame that flickers.
    if (window.self !== window.top && !(await cookieStuck())) {
      // Blocked. The launch token we arrived with is now SPENT (single-use, by design), so it
      // cannot open the tab for us, which is exactly why the server handed back a fresh one.
      const href = payload.handoff
        ? `/embed/${encodeURIComponent(schoolSlug)}#t=${encodeURIComponent(payload.handoff)}`
        : `/embed/${encodeURIComponent(schoolSlug)}`;
      setState({ kind: "blocked", href });
      return;
    }

    window.location.reload();
  }, [schoolSlug]);

  useEffect(() => {
    void redeem();
  }, [redeem]);

  if (state.kind === "starting") {
    return (
      <main className="flex min-h-[240px] items-center justify-center font-body text-stone-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Opening your lessons…
      </main>
    );
  }

  if (state.kind === "blocked") {
    return (
      <Notice
        title="Your browser is blocking this window"
        body={`Safari and some privacy settings will not let ${schoolName}'s page keep you signed in inside a frame. Open your lessons in a tab instead, and everything works the same.`}
      >
        <Button asChild className="gap-1.5 bg-orange-700 text-white hover:bg-orange-800">
          <a href={state.href} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Open my lessons
          </a>
        </Button>
      </Notice>
    );
  }

  if (state.kind === "no-token") {
    return (
      <Notice
        title="This lesson window needs to be opened from your school's page"
        body="Go back to your school portal and click through from there."
      />
    );
  }

  return (
    <Notice
      title="This link has expired"
      body={`${state.message} Return to ${schoolName}'s page and open your lessons again. The link is only valid for a minute, on purpose.`}
    />
  );
}

/**
 * Did the Set-Cookie actually stick?
 *
 * The cookie is HttpOnly, so script cannot read it. We ask the server instead: a request that
 * carries it gets 200, one that does not gets 401. That is the only honest way to know whether a
 * third-party cookie survived, and browsers give no error when they silently drop one.
 */
async function cookieStuck(): Promise<boolean> {
  try {
    const res = await fetch("/api/school/embed/session", { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

function Notice({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-md px-6 py-10 text-center font-body">
      <h1 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
        {title}
      </h1>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{body}</p>
      {children ? <div className="mt-5 flex justify-center">{children}</div> : null}
    </main>
  );
}
