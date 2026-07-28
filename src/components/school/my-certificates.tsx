"use client";

import { useEffect, useState } from "react";
import { Award, ExternalLink } from "lucide-react";

type MyCertificate = {
  credentialId: string;
  programTitle: string;
  moduleTitle: string;
  sessionLabel: string;
  termNumber: number;
  highlightLessons: string[];
  issuedAt: string;
};

/**
 * A pupil's own school certificates, shown at the top of their learning area. Renders nothing until at
 * least one is earned, so it never adds empty chrome. Each links out to the shareable, printable
 * verification page.
 */
export function MyCertificates() {
  const [certificates, setCertificates] = useState<MyCertificate[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/school/certificates/mine");
      if (res.ok) {
        const data = (await res.json()) as { certificates: MyCertificate[] };
        setCertificates(data.certificates);
      }
    })();
  }, []);

  if (certificates.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-stone-900 dark:text-stone-100">
        <Award className="size-5 text-kat-clay" />
        Your certificates
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {certificates.map((c) => {
          const highlights = Array.isArray(c.highlightLessons)
            ? c.highlightLessons.filter((x): x is string => typeof x === "string")
            : [];
          return (
            <a
              key={c.credentialId}
              href={`/certificate/${c.credentialId}`}
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-amber-200 bg-amber-50/60 p-4 transition hover:border-amber-300 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-800 dark:text-stone-100">
                    {c.programTitle}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Term {c.termNumber} · {c.sessionLabel}
                  </p>
                </div>
                <ExternalLink className="size-4 shrink-0 text-amber-500 transition group-hover:text-amber-600" />
              </div>
              {highlights.length > 0 ? (
                <p className="mt-2 line-clamp-2 text-xs text-stone-600 dark:text-stone-300">
                  {highlights.join(" · ")}
                </p>
              ) : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}
