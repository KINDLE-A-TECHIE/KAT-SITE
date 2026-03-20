"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/site-footer";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertCircle className="mx-auto mb-3 size-10 text-rose-400" />
        <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900">
          Invalid link
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This password reset link is missing or malformed.
        </p>
        <Link
          href="/forgot-password"
          className="mt-4 inline-block text-sm font-semibold text-[#1E5FAF] hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not reset password. The link may have expired.");
        return;
      }
      setDone(true);
      toast.success("Password reset! Redirecting to sign in…");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-500" />
        <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900">
          Password updated!
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Your password has been reset. Redirecting you to sign in…
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900">
          Set a new password
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-slate-700">
            New password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-10 text-sm shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500/30"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-sm font-medium text-slate-700">
            Confirm new password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500/30"
              required
            />
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-rose-500">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-[#1E5FAF] text-sm font-semibold hover:bg-[#1a52a0]"
        >
          {loading ? "Resetting…" : "Reset Password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Remember your password?{" "}
        <Link href="/login" className="font-semibold text-[#1E5FAF] hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <div className="mb-8 flex items-center gap-2">
            <Image src="/kindle-a-techie.svg" alt="KAT logo" width={36} height={36} className="shrink-0" />
            <span className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-900">
              KAT Learning
            </span>
          </div>

          <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-100" />}>
            <ResetPasswordForm />
          </Suspense>
        </motion.div>
      </main>
      <SiteFooter />
    </div>
  );
}
