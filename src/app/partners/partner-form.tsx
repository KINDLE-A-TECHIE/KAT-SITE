"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

type FormState = "idle" | "loading" | "success" | "error";

const PARTNER_TYPES = [
  { value: "SCHOOL", label: "School / Educational Institution" },
  { value: "CORPORATE", label: "Corporate Organisation" },
  { value: "GOVERNMENT", label: "Government Agency / Ministry" },
  { value: "OTHER", label: "Other" },
];

export function PartnerForm() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    organization: "",
    type: "SCHOOL",
    email: "",
    phone: "",
    message: "",
  });

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        <CheckCircle2 className="size-12 text-emerald-500" />
        <h3 className="text-xl font-semibold text-slate-900">Inquiry received!</h3>
        <p className="max-w-sm text-sm text-slate-500">
          Thank you for reaching out. Our partnerships team will be in touch within 2 business days.
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--kat-primary-blue)] focus:ring-2 focus:ring-[var(--kat-primary-blue)]/10 transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Your Name</label>
          <input
            required
            placeholder="e.g. Amaka Okonkwo"
            className={inputCls}
            value={form.name}
            onChange={set("name")}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Organisation Name</label>
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
        <label className="text-xs font-medium text-slate-600">Partnership Type</label>
        <select required className={inputCls} value={form.type} onChange={set("type")}>
          {PARTNER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Work Email</label>
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
          <label className="text-xs font-medium text-slate-600">Phone (optional)</label>
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
        <label className="text-xs font-medium text-slate-600">Tell us about your goals</label>
        <textarea
          required
          rows={4}
          placeholder="Describe what you're hoping to achieve through this partnership — e.g. number of students, target age range, timeline, any specific programmes in mind."
          className={`${inputCls} resize-none`}
          value={form.message}
          onChange={set("message")}
        />
      </div>

      {state === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{errorMsg}</p>
      )}

      <Button
        type="submit"
        disabled={state === "loading"}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white"
        style={{ background: "var(--kat-gradient)" }}
      >
        {state === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Sending…
          </span>
        ) : (
          "Send Partnership Inquiry"
        )}
      </Button>
    </form>
  );
}
