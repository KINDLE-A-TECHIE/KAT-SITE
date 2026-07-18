"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SchoolClass = { id: string; name: string; term: string };

type ImportSummary = {
  created: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
  seats: { used: number; limit: number };
};

const TEMPLATE = "name,guardian email\nAda Obi,ada.parent@example.com\nChidi Okafor,\n";

export function RosterImportPanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadClasses = useCallback(async () => {
    const res = await fetch("/api/school/classes");
    const payload = await res.json().catch(() => ({}));
    if (res.ok) setClasses(payload.classes ?? []);
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "roster-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    if (!classId) {
      toast.error("Choose a class first.");
      return;
    }
    setBusy(true);
    setSummary(null);

    // Read the file in the browser and POST its TEXT. The roster never becomes a
    // URL or an upload, no child's name leaves the request body.
    const csv = await file.text();

    const res = await fetch("/api/school/roster/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolClassId: classId, csv }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";

    if (!res.ok) {
      toast.error(payload?.error ?? "Could not import the roster.");
      return;
    }

    setSummary(payload as ImportSummary);
    toast.success(
      `${payload.created} student${payload.created === 1 ? "" : "s"} added` +
        (payload.skipped ? `, ${payload.skipped} already on the roster` : ""),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Roster import</CardTitle>
        <CardDescription>
          Upload a CSV of student names (guardian email optional). Re-importing the same file is
          safe. Students already on the roster are skipped.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId} disabled={classes.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={classes.length === 0 ? "Create a class first" : "Choose a class"} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · Term {c.term}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>CSV file</Label>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
              <Button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy || !classId}
                className="flex-1 gap-1.5 bg-orange-700 text-white hover:bg-orange-800"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {busy ? "Importing…" : "Choose CSV"}
              </Button>
              <Button type="button" variant="outline" onClick={downloadTemplate} title="Download template">
                <Download className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Summary */}
        {summary ? (
          <div className="space-y-3 rounded-xl border border-stone-200 p-4 dark:border-stone-700">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="size-4" /> {summary.created} created
              </span>
              <span className="text-stone-500 dark:text-stone-400">{summary.skipped} skipped</span>
              {summary.errors.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
                  <AlertCircle className="size-4" /> {summary.errors.length} error
                  {summary.errors.length === 1 ? "" : "s"}
                </span>
              ) : null}
              <span className="ml-auto text-xs text-stone-400">
                Seats: {summary.seats.used} / {summary.seats.limit}
              </span>
            </div>

            {summary.errors.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {summary.errors.map((e) => (
                  <li key={e.row} className="flex gap-2 text-stone-600 dark:text-stone-300">
                    <span className="shrink-0 font-mono text-stone-400">Row {e.row}</span>
                    <span>{e.reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
