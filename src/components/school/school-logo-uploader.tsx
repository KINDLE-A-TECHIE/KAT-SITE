"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The school's logo, its "profile picture". Deliberately simple: one image, upload / replace / remove.
 *
 * The raw file is POSTed to /api/school/logo; the server compresses it (sharp) so a big picture is
 * shrunk under the 5 MB ceiling rather than rejected, and stored in R2.
 */
export function SchoolLogoUploader({
  initialLogoUrl,
  schoolName,
}: {
  initialLogoUrl: string | null;
  schoolName: string;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/school/logo", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const payload = (await res.json().catch(() => ({}))) as { logoUrl?: string | null; error?: string };
      if (!res.ok) {
        toast.error(payload.error ?? "Could not upload the logo.");
        return;
      }
      // Cache-bust so the shell/preview pick up the replacement immediately.
      setLogoUrl(payload.logoUrl ? `${payload.logoUrl}?v=${Date.now()}` : null);
      toast.success("Logo updated.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onRemove = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/school/logo", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not remove the logo.");
        return;
      }
      setLogoUrl(null);
      toast.success("Logo removed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kat-card flex flex-col items-start gap-5 sm:flex-row sm:items-center">
      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-800">
        {logoUrl ? (
          // A logo may be any shape; contain it so nothing is cropped. Plain img: R2 is an external
          // host and the file is already compressed, so the Next optimizer adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`${schoolName} logo`} className="size-full object-contain" />
        ) : (
          <Building2 className="size-8 text-stone-300 dark:text-stone-600" />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="gap-1.5 bg-orange-700 text-white hover:bg-orange-800"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
          {logoUrl ? (
            <Button variant="outline" onClick={() => void onRemove()} disabled={busy} className="gap-1.5">
              <Trash2 className="size-4" />
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          PNG, JPG, WebP or GIF. Bigger images are compressed automatically; the stored logo stays
          under 5 MB.
        </p>
      </div>
    </div>
  );
}
