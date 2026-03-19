"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteFooter } from "@/components/site-footer";

const schema = z.object({
  firstName:  z.string().trim().min(2, "First name is required"),
  lastName:   z.string().trim().min(2, "Last name is required"),
  email:      z.string().email("Enter a valid email address"),
  phone:      z.string().trim().min(7, "Enter a valid phone number").max(20).optional().or(z.literal("")),
  motivation: z.string().trim().min(50, "Must be at least 50 characters").max(3000),
  experience: z.string().trim().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

type CohortInfo = {
  id: string;
  name: string;
  externalApplicationFee: number | null;
  applicationClosesAt: string | null;
  program: { name: string; level: string };
};

function FellowshipApplyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cohortId = searchParams.get("cohort");

  const [cohort, setCohort] = useState<CohortInfo | null>(null);
  const [loadingCohort, setLoadingCohort] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [requiresPayment, setRequiresPayment] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", motivation: "", experience: "" },
  });

  useEffect(() => {
    if (!cohortId) { setLoadingCohort(false); return; }
    fetch(`/api/cohorts/${cohortId}?public=1`)
      .then((r) => r.ok ? r.json() as Promise<{ cohort: CohortInfo }> : Promise.reject())
      .then((d) => setCohort(d.cohort))
      .catch(() => setCohort(null))
      .finally(() => setLoadingCohort(false));
  }, [cohortId]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!cohortId) { toast.error("No cohort selected."); return; }
    const res = await fetch("/api/fellows/apply/external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, cohortId, phone: values.phone || undefined }),
    });
    const data = await res.json() as { message?: string; error?: string; requiresPayment?: boolean };
    if (!res.ok) {
      toast.error(data.error ?? "Submission failed. Please try again.");
      return;
    }
    setRequiresPayment(data.requiresPayment ?? false);
    setSubmitted(true);
  });

  if (loadingCohort) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Nav bar */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/#fellowship" className="flex items-center gap-2.5">
            <Image src="/kindle-a-techie.svg" alt="KAT logo" width={32} height={32} />
            <span className="[font-family:var(--font-space-grotesk)] text-sm font-semibold text-slate-900">
              KAT Learning
            </span>
          </Link>
          <Link
            href="/#fellowship"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {submitted ? (
            /* ── Success state ── */
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <CheckCircle2 className="mx-auto mb-4 size-14 text-emerald-500" />
              <h1 className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900">
                Application Submitted!
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                {requiresPayment
                  ? "Check your email — we've sent you a link to set up your account and pay the application fee."
                  : "Check your email for confirmation. We'll review your application and get back to you soon."}
              </p>
              <Button
                onClick={() => router.push("/")}
                className="mt-8 rounded-xl bg-[#0D1F45] px-8 text-sm font-semibold hover:bg-[#132B5E]"
              >
                Back to Home
              </Button>
            </div>
          ) : (
            /* ── Form ── */
            <>
              {/* Cohort banner */}
              {cohort && (
                <div
                  className="mb-8 rounded-2xl p-6"
                  style={{ background: "linear-gradient(135deg,#0D1F45 0%,#1E5FAF 100%)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                    Fellowship Application
                  </p>
                  <h1 className="mt-1 [font-family:var(--font-space-grotesk)] text-xl font-bold text-white">
                    {cohort.name}
                  </h1>
                  <p className="mt-0.5 text-sm text-blue-200">{cohort.program.name}</p>
                  {cohort.externalApplicationFee != null && (
                    <p className="mt-3 text-sm text-blue-100">
                      Application fee:{" "}
                      <span className="font-semibold text-white">
                        ₦{Number(cohort.externalApplicationFee).toLocaleString("en-NG")}
                      </span>{" "}
                      — payable after submission
                    </p>
                  )}
                </div>
              )}

              {!cohortId || (!loadingCohort && !cohort) ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-slate-500">No cohort selected or cohort not found.</p>
                  <Button
                    onClick={() => router.push("/#fellowship")}
                    variant="outline"
                    className="mt-4 rounded-xl"
                  >
                    View Open Cohorts
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={onSubmit}
                  className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
                >
                  <div>
                    <h2 className="[font-family:var(--font-space-grotesk)] text-lg font-bold text-slate-900">
                      Your Details
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      We'll create a KAT account for you automatically — no sign-up needed.
                    </p>
                  </div>

                  {/* Name row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">First name</Label>
                      <Input
                        placeholder="Ada"
                        className="h-11 rounded-xl border-slate-200"
                        {...form.register("firstName")}
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-xs text-rose-500">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">Last name</Label>
                      <Input
                        placeholder="Okonkwo"
                        className="h-11 rounded-xl border-slate-200"
                        {...form.register("lastName")}
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-xs text-rose-500">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Email + Phone */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">Email address</Label>
                      <Input
                        type="email"
                        placeholder="ada@example.com"
                        className="h-11 rounded-xl border-slate-200"
                        {...form.register("email")}
                      />
                      {form.formState.errors.email && (
                        <p className="text-xs text-rose-500">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">
                        Phone number <span className="font-normal text-slate-400">(optional)</span>
                      </Label>
                      <Input
                        type="tel"
                        placeholder="+234 800 000 0000"
                        className="h-11 rounded-xl border-slate-200"
                        {...form.register("phone")}
                      />
                      {form.formState.errors.phone && (
                        <p className="text-xs text-rose-500">{form.formState.errors.phone.message}</p>
                      )}
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  <div>
                    <h2 className="[font-family:var(--font-space-grotesk)] text-lg font-bold text-slate-900">
                      Your Application
                    </h2>
                  </div>

                  {/* Motivation */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Why do you want to be a KAT Fellow?{" "}
                      <span className="font-normal text-slate-400">(50–3000 chars)</span>
                    </Label>
                    <Textarea
                      placeholder="Tell us about your passion for teaching, your background, and what you'll bring to the programme…"
                      rows={6}
                      className="rounded-xl border-slate-200 text-sm resize-none"
                      {...form.register("motivation")}
                    />
                    {form.formState.errors.motivation && (
                      <p className="text-xs text-rose-500">{form.formState.errors.motivation.message}</p>
                    )}
                  </div>

                  {/* Experience */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">
                      Relevant experience{" "}
                      <span className="font-normal text-slate-400">(optional, up to 2000 chars)</span>
                    </Label>
                    <Textarea
                      placeholder="Previous teaching, mentoring, or tech experience…"
                      rows={4}
                      className="rounded-xl border-slate-200 text-sm resize-none"
                      {...form.register("experience")}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting}
                    className="h-11 w-full rounded-xl bg-[#0D1F45] text-sm font-semibold hover:bg-[#132B5E]"
                  >
                    {form.formState.isSubmitting ? (
                      <><Loader2 className="mr-2 size-4 animate-spin" />Submitting…</>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>

                  <p className="text-center text-xs text-slate-400">
                    Already have an account?{" "}
                    <Link href="/login?redirect=/dashboard/fellows/apply" className="text-[#1E5FAF] hover:underline">
                      Sign in and apply there
                    </Link>
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export default function FellowshipApplyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    }>
      <FellowshipApplyContent />
    </Suspense>
  );
}
