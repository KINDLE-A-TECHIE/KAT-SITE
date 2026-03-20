"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type WaitlistState, SCHEDULE_ROWS } from "../landing-tokens";

const LEVEL_STYLES: Record<string, { badge: string; dot: string }> = {
  Builders:   { badge: "bg-blue-100 text-blue-700",   dot: "bg-blue-500" },
  Innovators: { badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  Explorers:  { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  "All Tracks": { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
};

const STATUS_STYLES: Record<string, string> = {
  Open:        "bg-emerald-100 text-emerald-700",
  "Few Seats": "bg-amber-100 text-amber-700",
  Live:        "bg-blue-100 text-[var(--kat-primary-blue)]",
};

export function ScheduleWaitlistSection() {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistState, setWaitlistState] = useState<WaitlistState>("idle");
  const waitlistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWaitlistSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (waitlistTimerRef.current) clearTimeout(waitlistTimerRef.current);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail.trim());
    if (!emailValid) { setWaitlistState("error"); return; }
    setWaitlistState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail.trim() }),
      });
      if (res.ok) { setWaitlistState("success"); setWaitlistEmail(""); }
      else setWaitlistState("error");
    } catch {
      setWaitlistState("error");
    }
  };

  return (
    <section id="schedule" className="kat-page kat-defer pb-16 sm:pb-20">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">

        {/* Schedule — visual card grid */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--kat-primary-blue)]">
            Schedule
          </p>
          <h2 className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-[var(--kat-text-primary)]">
            Weekly Learning Schedule
          </h2>
          <p className="mt-1 mb-4 text-sm text-[var(--kat-text-secondary)]">
            Live classes run every week — find the session that suits your child&apos;s track.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SCHEDULE_ROWS.map((row) => {
              const level = LEVEL_STYLES[row.level] ?? LEVEL_STYLES["All Tracks"];
              const status = STATUS_STYLES[row.status] ?? STATUS_STYLES.Open;
              return (
                <div
                  key={`${row.day}-${row.className}`}
                  className="rounded-2xl border border-[var(--kat-border)] bg-white p-4 shadow-[0_2px_12px_-4px_rgba(19,43,94,0.08)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("mt-0.5 size-2.5 shrink-0 rounded-full", level.dot)} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--kat-text-secondary)]">
                        {row.day}
                      </p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status)}>
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-2 [font-family:var(--font-space-grotesk)] text-base font-semibold text-[var(--kat-text-primary)]">
                    {row.className}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", level.badge)}>
                      {row.level}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[var(--kat-text-secondary)]">
                      <Clock className="size-3" />
                      {row.time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Waitlist */}
        <Card className="rounded-3xl border-[var(--kat-border)] bg-white py-5 shadow-[0_8px_30px_-16px_rgba(19,43,94,0.12)]">
          <CardHeader className="px-5 pb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--kat-primary-blue)]">
              Waitlist
            </p>
            <CardTitle className="[font-family:var(--font-space-grotesk)] text-2xl text-[var(--kat-text-primary)]">
              Join the Waitlist
            </CardTitle>
            <CardDescription className="text-[var(--kat-text-secondary)]">
              Be first to hear about new cohorts, scholarships, and coding camps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5">
            <form className="space-y-3" onSubmit={handleWaitlistSubmit}>
              <Input
                type="email"
                placeholder="Parent or student email address"
                value={waitlistEmail}
                onChange={(e) => {
                  setWaitlistEmail(e.target.value);
                  if (waitlistState !== "idle") setWaitlistState("idle");
                }}
                className="h-11 rounded-xl border-[var(--kat-border)] focus-visible:border-[var(--kat-primary-blue)] focus-visible:ring-0"
              />
              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-white"
                disabled={waitlistState === "loading"}
                style={{ background: "var(--kat-gradient)" }}
              >
                {waitlistState === "loading" ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Notify Me"
                )}
              </Button>
            </form>

            {waitlistState === "success" && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="text-[var(--kat-success)]" />
                <AlertTitle className="text-[var(--kat-text-primary)]">You&apos;re on the list!</AlertTitle>
                <AlertDescription className="text-[var(--kat-text-secondary)]">
                  We&apos;ll send cohort updates and enrollment windows to your inbox.
                </AlertDescription>
              </Alert>
            )}
            {waitlistState === "error" && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="text-[var(--kat-danger)]" />
                <AlertTitle className="text-[var(--kat-text-primary)]">Invalid email</AlertTitle>
                <AlertDescription className="text-[var(--kat-text-secondary)]">
                  Please enter a valid email address.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
