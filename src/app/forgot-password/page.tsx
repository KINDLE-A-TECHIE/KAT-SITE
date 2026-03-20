"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/site-footer";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

          {sent ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-500" />
              <h2 className="[font-family:var(--font-space-grotesk)] text-xl font-bold text-slate-900">
                Check your inbox
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                If <strong>{email}</strong> is registered, you&apos;ll receive a password reset link
                within a few minutes.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E5FAF] hover:underline"
              >
                <ArrowLeft className="size-3.5" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900">
                  Forgot your password?
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500/30"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-xl bg-[#1E5FAF] text-sm font-semibold hover:bg-[#1a52a0]"
                >
                  {loading ? "Sending…" : "Send Reset Link"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Remember your password?{" "}
                <Link href="/login" className="font-semibold text-[#1E5FAF] hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </main>
      <SiteFooter />
    </div>
  );
}
