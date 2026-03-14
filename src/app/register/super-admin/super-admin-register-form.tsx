"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InvitePreview = {
  id: string;
  email: string;
  expiresAt: string;
  status: "valid";
};

export function SuperAdminRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");

  const validateInvite = async (nextToken: string) => {
    if (!nextToken) {
      setInvite(null);
      return;
    }
    setValidating(true);
    const response = await fetch(`/api/super-admin/invites/accept?token=${encodeURIComponent(nextToken)}`);
    const payload = await response.json();
    setValidating(false);

    if (!response.ok) {
      setInvite(null);
      toast.error(payload?.error ?? "Invalid invite.");
      return;
    }

    setInvite(payload.invite);
    setEmail(payload.invite.email);
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void validateInvite(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !email || !firstName || !lastName || !password) {
      toast.error("Complete all fields.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/super-admin/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        email,
        firstName,
        lastName,
        password,
      }),
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Could not accept invite.");
      return;
    }

    const authResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (authResult?.error) {
      toast.success("Account created. Sign in to continue.");
      router.push("/login");
      return;
    }

    toast.success("Super admin account activated.");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <Card className="overflow-hidden border-slate-200/70 bg-white/95 shadow-xl">
          <div className="h-2 bg-gradient-to-r from-slate-700 via-blue-700 to-cyan-600" />
          <CardHeader>
            <p className="kat-chip w-fit">Super Admin Invite</p>
            <CardTitle className="mt-3 text-2xl">Activate Super Admin Access</CardTitle>
            <p className="text-sm text-slate-600">
              This page works only with a valid invite token.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Invite Token</Label>
                <Input
                  id="token"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Paste invite token"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={validating}
                  onClick={() => void validateInvite(token)}
                >
                  {validating ? "Validating..." : "Validate Token"}
                </Button>
              </div>

              {invite ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Invite valid for <strong>{invite.email}</strong> until{" "}
                  {new Date(invite.expiresAt).toLocaleString()}.
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Validate your token first.
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              <Button disabled={loading || !invite} type="submit" className="w-full">
                {loading ? "Activating..." : "Activate Super Admin"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-slate-600">
              Have an account already?{" "}
              <Link className="font-medium text-blue-700 hover:underline" href="/login">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
