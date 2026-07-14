"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Scope = "CLASSES_READ" | "PROGRESS_READ" | "RESULTS_READ" | "ROSTER_WRITE" | "EMBED_MINT";

type Key = {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/**
 * Scope copy written for a head teacher, not an engineer, and the two dangerous ones say so.
 * A school will hand a key to an IT contractor without reading anything else on this page.
 */
const SCOPES: Array<{ value: Scope; label: string; danger?: boolean; note: string }> = [
  { value: "CLASSES_READ", label: "Read classes", note: "Class names, terms, sizes." },
  { value: "PROGRESS_READ", label: "Read progress", note: "Lesson progress per pupil. Also allows webhooks." },
  { value: "RESULTS_READ", label: "Read results", note: "Assessment scores." },
  {
    value: "ROSTER_WRITE",
    label: "Write roster",
    danger: true,
    note: "Creates and deactivates pupil accounts.",
  },
  {
    value: "EMBED_MINT",
    label: "Sign pupils in",
    danger: true,
    note: "Can open a lesson window as ANY pupil at your school.",
  },
];

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Scope[]>(["CLASSES_READ", "PROGRESS_READ"]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/school/embed/config");
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not load keys.");
      return;
    }
    setKeys(payload.keys ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const issue = async () => {
    if (selected.length === 0) {
      toast.error("Choose at least one thing this key may do.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/school/embed/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "issue-key", name: name.trim() || "API key", scopes: selected }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not create the key.");
      return;
    }
    setFresh(payload.secret as string);
    setName("");
    await load();
  };

  const revoke = async (id: string) => {
    setBusy(true);
    await fetch("/api/school/embed/config", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId: id }),
    });
    setBusy(false);
    toast.success("Key revoked. It stops working immediately.");
    await load();
  };

  const toggle = (s: Scope) =>
    setSelected((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  if (loading) return <p className="text-sm text-stone-500">Loading…</p>;

  const live = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);

  return (
    <div className="space-y-6">
      {fresh ? (
        <Card className="border-orange-300 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-orange-600" />
              Copy this now. It is shown once
            </CardTitle>
            <CardDescription>
              We store only a hash, so we cannot show it again. Keep it on your <strong>server</strong>
              . Never in a web page, a repository, or an email.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-stone-900 px-3 py-2 font-mono text-xs text-stone-100">
              {fresh}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(fresh);
                toast.success("Copied.");
              }}
              className="gap-1.5"
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFresh(null)}>
              Done
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a key</CardTitle>
          <CardDescription>
            Give each system its own key with only what it needs. Then revoking one does not take
            down the others.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What is this key for? e.g. School MIS sync"
          />

          <div className="space-y-2">
            {SCOPES.map((s) => (
              <label
                key={s.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 p-3 transition hover:border-orange-400 dark:border-stone-700"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(s.value)}
                  onChange={() => toggle(s.value)}
                  className="mt-1 size-4 accent-orange-600"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-stone-900 dark:text-stone-100">
                    {s.label}
                    {s.danger ? (
                      <Badge variant="secondary" className="gap-1 text-amber-700 dark:text-amber-500">
                        <AlertTriangle className="size-3" />
                        Powerful
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">
                    {s.note}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <Button
            onClick={issue}
            disabled={busy}
            className="gap-1.5 bg-orange-600 text-white hover:bg-orange-700"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Create key
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your keys</CardTitle>
          <CardDescription>
            To rotate: create the new key, switch your system over, then revoke the old one. Both
            work until you do.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {live.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">No active keys.</p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {live.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 dark:text-stone-100">{k.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                      <code className="font-mono">{k.prefix}…</code>
                      <span>·</span>
                      <span>
                        {k.lastUsedAt
                          ? `last used ${new Date(k.lastUsedAt).toLocaleDateString("en-GB")}`
                          : "never used"}
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">
                          {SCOPES.find((x) => x.value === s)?.label ?? s}
                        </Badge>
                      ))}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => revoke(k.id)} disabled={busy}>
                    <Trash2 className="size-3.5 text-stone-400" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {revoked.length > 0 ? (
            <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-400 dark:border-stone-800">
              {revoked.length} revoked key{revoked.length === 1 ? "" : "s"} kept for the audit trail.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
