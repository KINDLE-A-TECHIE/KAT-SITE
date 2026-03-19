"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarCheck2,
  CheckCircle2,
  Loader2,
  Sparkles,
  Star,
  UserRound,
  WifiOff,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type WaitlistState, SIDEBAR_ITEMS } from "../landing-tokens";

const WAITLIST_QUEUE_KEY = "kat-waitlist-queue";

async function submitWaitlistEmail(email: string): Promise<"success" | "error" | "offline"> {
  try {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return res.ok ? "success" : "error";
  } catch {
    return "offline";
  }
}

type HeroSectionProps = {
  enrollments: number;
  passRate: number;
};

export function HeroSection({ enrollments, passRate }: HeroSectionProps) {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistState, setWaitlistState] = useState<WaitlistState>("idle");
  const waitlistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On reconnect, flush any queued email
  useEffect(() => {
    const flush = async () => {
      const queued = localStorage.getItem(WAITLIST_QUEUE_KEY);
      if (!queued) return;
      const result = await submitWaitlistEmail(queued);
      if (result !== "offline") {
        localStorage.removeItem(WAITLIST_QUEUE_KEY);
        if (result === "success") setWaitlistState("success");
      }
    };
    window.addEventListener("online", flush);
    void flush(); // also try immediately in case we're already online with a stale queue
    return () => window.removeEventListener("online", flush);
  }, []);

  const handleWaitlistSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (waitlistTimerRef.current) clearTimeout(waitlistTimerRef.current);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail.trim());
    if (!emailValid) {
      setWaitlistState("error");
      return;
    }
    setWaitlistState("loading");
    const result = await submitWaitlistEmail(waitlistEmail.trim());
    if (result === "success") {
      setWaitlistState("success");
      setWaitlistEmail("");
    } else if (result === "offline") {
      localStorage.setItem(WAITLIST_QUEUE_KEY, waitlistEmail.trim());
      setWaitlistState("offline");
      setWaitlistEmail("");
    } else {
      setWaitlistState("error");
    }
  };

  const displayEnrollments = enrollments >= 1000
    ? `${(enrollments / 1000).toFixed(1).replace(/\.0$/, "")}k+`
    : `${enrollments}+`;

  return (
    <section className="kat-page pb-10 pt-14 sm:pt-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_0.88fr] lg:items-center">

        {/* Left: Text content */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-[var(--kat-primary-blue)]">
            <Sparkles className="size-3.5" />
            Africa&apos;s coding school for ages 8–19
          </div>

          <div className="space-y-5">
            <h1 className="[font-family:var(--font-space-grotesk)] text-[2.5rem] font-bold leading-[1.08] tracking-tight text-[var(--kat-text-primary)] sm:text-5xl lg:text-[3.75rem]">
              Learn to code, build real projects,{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--kat-gradient)" }}
              >
                and become Africa&apos;s next tech builder.
              </span>
            </h1>
            <p className="max-w-lg text-[1.05rem] leading-relaxed text-[var(--kat-text-secondary)]">
              KAT gives children and teens a fun but serious coding path — live mentors, weekly
              challenges, parent visibility, and real portfolio projects.
            </p>
          </div>

          {/* Star rating + trust */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="font-semibold text-[var(--kat-text-primary)]">4.9</span>
            <span className="text-[var(--kat-text-secondary)]">·</span>
            <span className="text-[var(--kat-text-secondary)]">
              Trusted by{" "}
              <strong className="text-[var(--kat-text-primary)]">{displayEnrollments} students</strong>{" "}
              across Africa
            </span>
            <Badge className="border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {passRate}% pass rate
            </Badge>
          </div>

          {/* Button CTAs */}
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-xl gap-2 px-7 text-white shadow-[0_8px_24px_-8px_rgba(30,95,175,0.55)]"
              style={{ background: "var(--kat-gradient)" }}
            >
              <Link href="/register">
                Enroll Your Child
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-xl border-[var(--kat-border)] text-[var(--kat-text-primary)] hover:border-[var(--kat-primary-blue)] hover:bg-blue-50"
            >
              <Link href="#tracks">View Tracks</Link>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" variant="ghost" className="rounded-xl text-[var(--kat-primary-blue)] hover:bg-blue-50">
                  How It Works
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="[font-family:var(--font-space-grotesk)] text-2xl text-[var(--kat-text-primary)]">
                    How Enrollment Works
                  </DialogTitle>
                  <DialogDescription className="text-[var(--kat-text-secondary)]">
                    From registration to your child&apos;s first live class — three steps.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  {[
                    {
                      step: "01",
                      heading: "Parent registers and enrolls",
                      detail: "Create a parent account, pick the right age track, and complete monthly enrollment. Your child gets access immediately.",
                    },
                    {
                      step: "02",
                      heading: "Your child joins live classes",
                      detail: "Small groups of 6–12 students. Live sessions with a dedicated mentor every week. Real coding from day one.",
                    },
                    {
                      step: "03",
                      heading: "Track progress from your dashboard",
                      detail: "See attendance, submission scores, mentor feedback, and project milestones — all from your parent portal.",
                    },
                  ].map(({ step, heading, detail }) => (
                    <div key={step} className="flex gap-4 rounded-xl border border-[var(--kat-border)] p-4">
                      <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ background: "var(--kat-gradient)" }}
                      >
                        {step}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--kat-text-primary)]">{heading}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--kat-text-secondary)]">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button
                    asChild
                    className="w-full rounded-xl text-white"
                    style={{ background: "var(--kat-gradient)" }}
                  >
                    <Link href="/register">Register as a Parent</Link>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Inline hero waitlist */}
          <div className="rounded-2xl border border-[var(--kat-border)] bg-white p-4 shadow-[0_4px_20px_-8px_rgba(19,43,94,0.1)]">
            <p className="mb-3 text-sm font-semibold text-[var(--kat-text-primary)]">
              Not ready yet? Join the waitlist.
            </p>
            <form className="flex gap-2" onSubmit={handleWaitlistSubmit}>
              <Input
                type="email"
                placeholder="Your email address"
                value={waitlistEmail}
                onChange={(e) => {
                  setWaitlistEmail(e.target.value);
                  if (waitlistState !== "idle") setWaitlistState("idle");
                }}
                className="h-10 flex-1 rounded-xl border-[var(--kat-border)] focus-visible:border-[var(--kat-primary-blue)] focus-visible:ring-0"
              />
              <Button
                type="submit"
                size="sm"
                className="h-10 rounded-xl px-4 text-white"
                disabled={waitlistState === "loading"}
                style={{ background: "var(--kat-gradient)" }}
              >
                {waitlistState === "loading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Notify Me"
                )}
              </Button>
            </form>
            {waitlistState === "success" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                You&apos;re on the list! We&apos;ll email you when the next cohort opens.
              </p>
            )}
            {waitlistState === "offline" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                <WifiOff className="size-3.5" />
                You&apos;re offline — we&apos;ll send your email when you reconnect.
              </p>
            )}
            {waitlistState === "error" && (
              <p className="mt-2 text-xs text-rose-600">Please enter a valid email address.</p>
            )}
          </div>
        </div>

        {/* Right: Dashboard preview */}
        <div className="relative">
          <div
            className="absolute inset-0 translate-y-6 scale-95 rounded-3xl opacity-25 blur-3xl"
            style={{ background: "var(--kat-gradient)" }}
          />
          <Card className="relative overflow-hidden rounded-3xl border-[var(--kat-border)] bg-white py-0 shadow-[0_32px_80px_-20px_rgba(19,43,94,0.22)]">
            {/* Window chrome */}
            <div className="flex items-center justify-between border-b border-[var(--kat-border)] bg-[#F8FAFF] px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="size-3 rounded-full bg-red-400" />
                  <span className="size-3 rounded-full bg-amber-400" />
                  <span className="size-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs font-medium text-[var(--kat-text-secondary)]">Student Dashboard</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--kat-text-secondary)]">
                <Bell className="size-3.5" />
                <UserRound className="size-3.5" />
              </div>
            </div>

            {/* Top nav strip */}
            <div className="border-b border-[var(--kat-border)] bg-[#EEF6FF] px-5 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--kat-primary-blue)]">
                <Sparkles className="size-3.5" />
                Classes · Challenges · Projects · Messages
              </div>
            </div>

            {/* Body */}
            <div className="grid min-h-[300px] grid-cols-1 sm:grid-cols-[152px_1fr]">
              <aside className="hidden border-r border-[var(--kat-border)] bg-[#F8FAFF] p-3 sm:block">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--kat-text-secondary)]">
                  Menu
                </p>
                <div className="space-y-1">
                  {SIDEBAR_ITEMS.map((item, i) => (
                    <div
                      key={item}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs",
                        i === 0
                          ? "font-semibold text-[var(--kat-primary-blue)]"
                          : "text-[var(--kat-text-secondary)]",
                      )}
                      style={
                        i === 0
                          ? { background: "linear-gradient(90deg, rgba(30,95,175,0.1), rgba(77,179,230,0.06))" }
                          : {}
                      }
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </aside>

              <div className="p-4 sm:p-5">
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50 py-3">
                    <CalendarCheck2 className="size-4 text-[var(--kat-success)]" />
                    <AlertTitle className="text-sm text-[var(--kat-text-primary)]">
                      Next class in 2 hours
                    </AlertTitle>
                    <AlertDescription className="text-xs text-[var(--kat-text-secondary)]">
                      Python Mission Lab · 4:00 PM WAT · Join link ready
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2.5">
                    {[
                      { label: "Frontend Sprint", value: 78, isBlue: true },
                      { label: "Python Practice", value: 64, isBlue: false },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-[var(--kat-text-secondary)]">{item.label}</span>
                          <span className="font-bold text-[var(--kat-text-primary)]">{item.value}%</span>
                        </div>
                        <Progress
                          value={item.value}
                          className={cn(
                            "h-2 bg-blue-100",
                            item.isBlue
                              ? "[&>[data-slot=progress-indicator]]:bg-[var(--kat-primary-blue)]"
                              : "[&>[data-slot=progress-indicator]]:bg-[var(--kat-accent-sky)]",
                          )}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-[var(--kat-border)] bg-[#FAFCFF] p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--kat-text-primary)]">
                      <Zap className="size-3.5 text-amber-500" />
                      Weekly Challenge
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--kat-text-secondary)]">
                      Build a mini quiz app and share your GitHub link before Friday.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
