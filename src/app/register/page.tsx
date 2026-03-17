"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Image from "next/image";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserRoleValue } from "@/lib/enums";
import { registerSchema } from "@/lib/validators";
import { SiteFooter } from "@/components/site-footer";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

type RegisterValues = z.infer<typeof registerSchema>;

const roleOptions: { label: string; value: UserRoleValue; description: string }[] = [
  { label: "Student", value: "STUDENT", description: "Join a cohort and start learning" },
  { label: "Parent / Guardian", value: "PARENT", description: "Manage your child's education" },
];

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const selectedRole = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", role: "STUDENT" },
  });

  const form = selectedRole;
  const watchedRole = form.watch("role");

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    // Tell the server which role this new Google user wants
    await fetch("/api/auth/oauth-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: watchedRole }),
    });
    await signIn("google", { callbackUrl: redirectTo });
    // Page will redirect
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    const response = await fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json();
    if (!response.ok) {
      setLoading(false);
      toast.error(payload?.error ?? "Registration failed.");
      return;
    }

    const signedIn = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    setLoading(false);
    if (signedIn?.error) {
      toast.success("Account created. Please sign in.");
      router.push(redirectTo !== "/dashboard" ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login");
      return;
    }

    toast.success("Account created successfully.");
    router.push(redirectTo);
    router.refresh();
  });

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1">
        {/* Left branding panel */}
        <div className="relative hidden lg:flex lg:w-[45%] flex-col justify-between overflow-hidden bg-[#0D1F45] p-10">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-3xl" />
          </div>

          <div className="relative flex items-center gap-3">
            <Image src="/kindle-a-techie.svg" alt="KAT logo" width={40} height={40} className="shrink-0" />
            <span className="[font-family:var(--font-space-grotesk)] text-lg font-semibold text-white">
              KAT Learning
            </span>
          </div>

          <div className="relative space-y-6">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-400">
                Join KAT Learning
              </p>
              <h1 className="[font-family:var(--font-space-grotesk)] text-4xl font-bold leading-tight text-white">
                Start your
                <br />
                <span className="text-blue-400">learning journey</span>
                <br />
                today.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Students get access to world-class curricula, live classes, and mentorship.
                Parents can manage enrollments and track progress from one place.
              </p>
            </div>

            <div className="space-y-3">
              {[
                "Structured cohort-based learning",
                "Live sessions with expert instructors",
                "Real-time progress tracking",
              ].map((point) => (
                <div key={point} className="flex items-center gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <p className="text-sm text-slate-300">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative text-xs text-slate-500">

          </p>
        </div>

        {/* Right form panel */}
        <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-sm"
          >
            {/* Mobile logo */}
            <div className="mb-8 flex items-center gap-2 lg:hidden">
              <Image src="/kindle-a-techie.svg" alt="KAT logo" width={36} height={36} className="shrink-0" />
              <span className="[font-family:var(--font-space-grotesk)] font-semibold text-slate-900">
                KAT Learning
              </span>
            </div>

            <div className="mb-6">
              <h2 className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-slate-900">
                Create your account
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Join as a student or parent / guardian.
              </p>
            </div>

            {/* Role selector */}
            <div className="mb-5 grid grid-cols-2 gap-2">
              {roleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => form.setValue("role", opt.value, { shouldValidate: true })}
                  className={`rounded-xl border p-3 text-left transition-all ${watchedRole === opt.value
                      ? "border-[#1E5FAF] bg-blue-50 ring-1 ring-[#1E5FAF]/30"
                      : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                >
                  <p className={`text-sm font-semibold ${watchedRole === opt.value ? "text-[#1E5FAF]" : "text-slate-800"}`}>
                    {opt.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 leading-snug">{opt.description}</p>
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-sm font-medium text-slate-700">
                    First name
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="firstName"
                      placeholder="Amara"
                      className="h-11 rounded-xl border-slate-200 bg-white pl-9 text-sm shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500/30"
                      {...form.register("firstName")}
                    />
                  </div>
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-rose-500">{form.formState.errors.firstName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-sm font-medium text-slate-700">
                    Last name
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Okafor"
                    className="h-11 rounded-xl border-slate-200 bg-white text-sm shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500/30"
                    {...form.register("lastName")}
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-xs text-rose-500">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

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
                    className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500/30"
                    {...form.register("email")}
                  />
                </div>
                {form.formState.errors.email && (
                  <p className="text-xs text-rose-500">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-10 text-sm shadow-sm placeholder:text-slate-400 focus-visible:ring-blue-500/30"
                    {...form.register("password")}
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
                {form.formState.errors.password && (
                  <p className="text-xs text-rose-500">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button
                disabled={loading}
                type="submit"
                className="h-11 w-full rounded-xl bg-[#1E5FAF] text-sm font-semibold hover:bg-[#1a52a0]"
              >
                {loading ? "Creating account…" : "Create Account"}
              </Button>
            </form>

            {process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true" && (
              <>
                <div className="relative my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs text-slate-400">or</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={googleLoading}
                  onClick={handleGoogleSignIn}
                  className="h-11 w-full rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <GoogleIcon />
                  <span className="ml-2">
                    {googleLoading
                      ? "Redirecting…"
                      : `Continue with Google as ${watchedRole === "PARENT" ? "Parent" : "Student"}`}
                  </span>
                </Button>
              </>
            )}

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[#1E5FAF] hover:underline">
                Sign in
              </Link>
            </p>
          </motion.div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
