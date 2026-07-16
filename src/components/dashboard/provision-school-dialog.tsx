"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Inquiry = {
  id: string;
  name: string;
  organization: string;
  email: string;
};

/** "Acme Primary School" → "acme-primary-school" */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Splits the contact name into first/last for the "create account" path. */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") || parts[0] || "" };
}

export function ProvisionSchoolDialog({
  inquiry,
  onProvisioned,
}: {
  inquiry: Inquiry;
  onProvisioned: () => void;
}) {
  const initialName = splitName(inquiry.name);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [schoolName, setSchoolName] = useState(inquiry.organization);
  const [slug, setSlug] = useState(slugify(inquiry.organization));
  const [adminMode, setAdminMode] = useState<"existing" | "create">("create");
  const [adminEmail, setAdminEmail] = useState(inquiry.email);
  const [adminFirstName, setAdminFirstName] = useState(initialName.first);
  const [adminLastName, setAdminLastName] = useState(initialName.last);

  const submit = async () => {
    setBusy(true);
    const res = await fetch("/api/super-admin/schools/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inquiryId: inquiry.id,
        schoolName,
        slug,
        adminMode,
        adminEmail, ...(adminMode === "create" ? { adminFirstName, adminLastName } : {}),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      toast.error(payload?.error ?? "Could not provision the school.");
      return;
    }
    toast.success(
      payload?.adminCreated
        ? `${schoolName} provisioned, setup email sent to ${adminEmail}.`
        : `${schoolName} provisioned, ${adminEmail} is now its school admin.`,
    );
    setOpen(false);
    onProvisioned();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-orange-700 text-white hover:bg-orange-800">
          <School className="size-3.5" />
          Provision school
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Provision school</DialogTitle>
          <DialogDescription>
            Creates the school and makes one person its first school admin. This can only be done
            once per inquiry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="schoolName">School name</Label>
            <Input
              id="schoolName"
              value={schoolName}
              onChange={(e) => {
                setSchoolName(e.target.value);
                setSlug(slugify(e.target.value));
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
            <p className="text-xs text-stone-400">Lowercase words separated by hyphens. Must be unique.</p>
          </div>

          {/* Admin mode */}
          <div className="space-y-1.5">
            <Label>First school admin</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["create", "existing"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAdminMode(mode)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    adminMode === mode
                      ? "border-orange-500 bg-orange-50 font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                      : "border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-300"
                  }`}
                >
                  {mode === "create" ? "Create account" : "Invite existing user"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adminEmail">Admin email</Label>
            <Input
              id="adminEmail"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>

          {adminMode === "create" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="adminFirstName">First name</Label>
                <Input
                  id="adminFirstName"
                  value={adminFirstName}
                  onChange={(e) => setAdminFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminLastName">Last name</Label>
                <Input
                  id="adminLastName"
                  value={adminLastName}
                  onChange={(e) => setAdminLastName(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
              The user must already have a KAT account with this email. Their school access applies
              immediately, no sign-out required.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !schoolName.trim() || !slug.trim() || !adminEmail.trim()}
            className="bg-orange-700 text-white hover:bg-orange-800"
          >
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            {busy ? "Provisioning…" : "Provision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
