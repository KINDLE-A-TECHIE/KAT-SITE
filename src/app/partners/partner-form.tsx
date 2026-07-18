"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { STAMP_CTA } from "@/components/marketing/landing-tokens";

type FormState = "idle" | "loading" | "success" | "error";

const PARTNER_TYPES = [
  { value: "SCHOOL", label: "School / Educational Institution" },
  { value: "CORPORATE", label: "Corporate Organisation" },
  { value: "GOVERNMENT", label: "Government Agency / Ministry" },
  { value: "OTHER", label: "Other" },
];

// NERDC levels, the values the admin inbox and the schools crosswalk expect. The old
// coding_clubs/tech_labs/after_school/hackathons values are now "legacy" in
// partner-inquiries-panel.tsx; a school pilot lead is scoped by the level(s) they teach.
const SCHOOL_PROGRAMS = [
  { value: "primary_1_3", label: "Primary 1–3" },
  { value: "primary_4_6", label: "Primary 4–6" },
  { value: "jss", label: "JSS 1–3" },
  { value: "sss", label: "SSS 1–3" },
];

export function PartnerForm() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [programs, setPrograms] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    organization: "",
    type: "SCHOOL",
    email: "",
    phone: "",
    state: "",
    estimatedStudents: "",
    message: "",
  });

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function toggleProgram(value: string) {
    setPrograms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Omit when blank so the optional Zod field passes (empty string would coerce to 0).
          estimatedStudents: form.estimatedStudents ? Number(form.estimatedStudents) : undefined,
          programs,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Something went wrong");
      }
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle2 className="size-12 text-[var(--kat-pine)]" />
        <h3 className="font-display text-xl font-semibold text-[var(--kat-ink)]">Inquiry received!</h3>
        <p className="max-w-sm font-body text-sm text-[var(--kat-muted)]">
          Thank you for reaching out. Our partnerships team will be in touch within 2 business days.
        </p>
      </div>
    );
  }

  const labelCls = "font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[var(--kat-muted)]";
  const inputCls =
    "w-full rounded-none border border-[var(--kat-border)] bg-[var(--kat-paper)] px-4 py-3 font-body text-sm text-[var(--kat-ink)] outline-none transition placeholder:text-[var(--kat-muted)] focus:border-[var(--kat-clay)] focus:ring-2 focus:ring-[var(--kat-clay)]/15";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelCls}>Your name</label>
          <input
            required
            placeholder="e.g. Amaka Okonkwo"
            className={inputCls}
            value={form.name}
            onChange={set("name")}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Organisation name</label>
          <input
            required
            placeholder="e.g. Lagos State Ministry of Education"
            className={inputCls}
            value={form.organization}
            onChange={set("organization")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Partnership type</label>
        <select required className={inputCls} value={form.type} onChange={set("type")}>
          {PARTNER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {form.type === "SCHOOL" && (
        <>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelCls}>State</label>
            <input
              placeholder="e.g. Lagos"
              className={inputCls}
              value={form.state}
              onChange={set("state")}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Estimated students</label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="e.g. 120"
              className={inputCls}
              value={form.estimatedStudents}
              onChange={set("estimatedStudents")}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className={labelCls}>
            Levels you teach <span className="normal-case tracking-normal">(select all that apply)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SCHOOL_PROGRAMS.map((prog) => {
              const checked = programs.includes(prog.value);
              return (
                <button
                  key={prog.value}
                  type="button"
                  onClick={() => toggleProgram(prog.value)}
                  className={`flex items-center gap-2.5 rounded-none border px-4 py-3 text-left font-body text-sm transition ${
                    checked
                      ? "border-[var(--kat-clay)] bg-[var(--kat-clay)]/[0.07] font-medium text-[var(--kat-clay)]"
                      : "border-[var(--kat-border)] bg-[var(--kat-paper)] text-[var(--kat-ink)] hover:border-[var(--kat-clay)]/50"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border transition ${
                      checked
                        ? "border-[var(--kat-clay)] bg-[var(--kat-clay)]"
                        : "border-[var(--kat-border)] bg-[var(--kat-paper)]"
                    }`}
                  >
                    {checked && (
                      <svg viewBox="0 0 10 8" className="h-2.5 w-2.5">
                        <path d="M1 4l3 3 5-6" stroke="var(--kat-paper)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {prog.label}
                </button>
              );
            })}
          </div>
        </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelCls}>Work email</label>
          <input
            required
            type="email"
            placeholder="you@organisation.com"
            className={inputCls}
            value={form.email}
            onChange={set("email")}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Phone (optional)</label>
          <input
            type="tel"
            placeholder="+234 800 000 0000"
            className={inputCls}
            value={form.phone}
            onChange={set("phone")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelCls}>Tell us about your goals</label>
        <textarea
          required
          rows={4}
          placeholder="Describe what you're hoping to achieve, e.g. number of students, target levels, timeline, and any specific programmes in mind."
          className={`${inputCls} resize-none`}
          value={form.message}
          onChange={set("message")}
        />
      </div>

      {state === "error" && (
        <p className="rounded-none border-l-2 border-[var(--kat-danger)] bg-[var(--kat-danger)]/[0.06] px-4 py-2.5 font-body text-sm text-[var(--kat-danger)]">
          {errorMsg}
        </p>
      )}

      <Button
        type="submit"
        disabled={state === "loading"}
        className={`w-full py-3 ${STAMP_CTA}`}
      >
        {state === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Sending…
          </span>
        ) : (
          "Send partnership inquiry"
        )}
      </Button>
    </form>
  );
}
