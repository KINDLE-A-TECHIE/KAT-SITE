"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Key = { id: string; prefix: string; createdAt: string };
type Origin = { id: string; origin: string };

export function EmbedSettingsPanel({ embedHost }: { embedHost: string }) {
  const [keys, setKeys] = useState<Key[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [slug, setSlug] = useState("");
  const [newOrigin, setNewOrigin] = useState("");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/school/embed/config");
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "Could not load embed settings.");
      return;
    }
    setKeys(payload.keys ?? []);
    setOrigins(payload.origins ?? []);
    setSlug(payload.slug ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: unknown) => {
    setBusy(true);
    const res = await fetch("/api/school/embed/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(payload?.error ?? "That did not work.");
      return null;
    }
    await load();
    return payload;
  };

  const remove = async (body: unknown) => {
    setBusy(true);
    await fetch("/api/school/embed/config", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    await load();
  };

  const issueKey = async () => {
    const payload = await post({ action: "issue-key" });
    if (payload?.secret) setFreshSecret(payload.secret as string);
  };

  const addOrigin = async () => {
    if (!newOrigin.trim()) return;
    const payload = await post({ action: "add-origin", origin: newOrigin.trim() });
    if (payload) setNewOrigin("");
  };

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied.");
  };

  const snippet = `<!-- Your server mints the token. NEVER put your API key on the page. -->
<iframe
  src="https://${embedHost}/embed/${slug || "your-school"}#t=LAUNCH_TOKEN"
  style="width:100%;height:720px;border:0"
  referrerpolicy="no-referrer"
></iframe>`;

  const mintExample = `# On YOUR server, for the pupil you want to sign in.
# "ref" is the student_id from the roster CSV you uploaded.
curl -X POST https://${embedHost}/api/school/embed/token \\
  -H "Authorization: Bearer $KAT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"ref":"STU-0417"}'
# -> { "token": "..", "expiresIn": 60 }
# Put that token in the iframe URL after the "#".`;

  if (loading) return <p className="text-sm text-stone-500">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* The secret, shown exactly once. */}
      {freshSecret ? (
        <Card className="border-orange-300 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-orange-600" />
              Copy your key now. It is shown once
            </CardTitle>
            <CardDescription>
              We store only a hash of it, so we cannot show it to you again. Keep it on your{" "}
              <strong>server</strong>. Anyone who has it can sign in as any pupil at your school, so
              it must never appear in a web page, a repository, or an email.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-stone-900 px-3 py-2 font-mono text-xs text-stone-100">
              {freshSecret}
            </code>
            <Button variant="outline" size="sm" onClick={() => copy(freshSecret)} className="gap-1.5">
              <Copy className="size-3.5" />
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFreshSecret(null)}>
              Done
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Origins, the framing allow-list. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where your lessons may be embedded</CardTitle>
          <CardDescription>
            Only these exact addresses may put KAT in a frame. We do not accept wildcards on purpose:{" "}
            <code className="font-mono text-xs">https://*.yourschool.edu.ng</code> would let any
            subdomain you have forgotten about frame a pupil&apos;s signed-in session.
            {origins.length === 0 ? (
              <span className="mt-1 flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-500">
                <AlertTriangle className="size-3.5" />
                Until you add one, the embed will not load anywhere.
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newOrigin}
              onChange={(e) => setNewOrigin(e.target.value)}
              placeholder="https://portal.yourschool.edu.ng"
              className="font-mono text-sm"
            />
            <Button onClick={addOrigin} disabled={busy} className="gap-1.5 bg-orange-600 text-white hover:bg-orange-700">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add
            </Button>
          </div>

          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {origins.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                <code className="font-mono text-xs text-stone-700 dark:text-stone-300">{o.origin}</code>
                <Button size="sm" variant="ghost" onClick={() => remove({ originId: o.id })}>
                  <Trash2 className="size-3.5 text-stone-400" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Keys. */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Server key</CardTitle>
            <CardDescription>
              Your server uses this to ask us for a one-minute sign-in link for a pupil.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={issueKey} disabled={busy} className="gap-1.5">
            <KeyRound className="size-4" />
            New key
          </Button>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">No key yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 py-2">
                  <code className="font-mono text-xs text-stone-700 dark:text-stone-300">
                    {k.prefix}…
                  </code>
                  <Button size="sm" variant="ghost" onClick={() => remove({ keyId: k.id })}>
                    <Trash2 className="size-3.5 text-stone-400" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* The snippet. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">The snippet</CardTitle>
          <CardDescription>
            Two parts, and the order matters. Your server asks us for a token; your page puts that
            token in the frame. The token lasts <strong>one minute</strong> and works{" "}
            <strong>once</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Snippet label="1. On your server" code={mintExample} onCopy={copy} />
          <Snippet label="2. On your page" code={snippet} onCopy={copy} />
        </CardContent>
      </Card>
    </div>
  );
}

function Snippet({
  label,
  code,
  onCopy,
}: {
  label: string;
  code: string;
  onCopy: (t: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
        <Button size="sm" variant="ghost" onClick={() => onCopy(code)} className="h-7 gap-1.5 text-xs">
          <Copy className="size-3" />
          Copy
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-stone-900 p-3 font-mono text-xs leading-relaxed text-stone-100">
        {code}
      </pre>
    </div>
  );
}
