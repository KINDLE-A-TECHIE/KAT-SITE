"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type TrackId, PROGRAM_TRACKS, STAMP_CTA } from "../landing-tokens";

export function TracksSection() {
  const [activeTrack, setActiveTrack] = useState<TrackId>("explorers");

  return (
    <section id="tracks" className="kat-page kat-defer py-16 sm:py-24">
      <div className="max-w-2xl border-l-2 border-[var(--kat-clay)] pl-5">
        <p className="kat-eyebrow">Program tracks</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[var(--kat-ink)] sm:text-[2.5rem]">
          Start where they are. Go as far as they can.
        </h2>
      </div>

      <div className="mt-10 border border-[var(--kat-border)] bg-[var(--kat-raised)] p-5 sm:p-7">
        <Tabs value={activeTrack} onValueChange={(v) => setActiveTrack(v as TrackId)}>
          <TabsList className="mb-6 h-auto w-full flex-wrap justify-start gap-2 rounded-none border-b border-[var(--kat-border)] bg-transparent p-0">
            {PROGRAM_TRACKS.map((track) => (
              <TabsTrigger
                key={track.id}
                value={track.id}
                className="rounded-none border-b-2 border-transparent px-4 py-3 text-left data-[state=active]:border-[var(--kat-clay)] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <span className="block font-display text-sm font-semibold text-[var(--kat-ink)]">
                  {track.label}
                </span>
                <span className="font-mono text-[0.7rem] tracking-wider text-[var(--kat-muted)]">
                  {track.ages}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {PROGRAM_TRACKS.map((track) => (
            <TabsContent key={track.id} value={track.id}>
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <p className="max-w-xl font-body leading-relaxed text-[var(--kat-muted)]">
                    {track.summary}
                  </p>

                  <div className="mt-7 space-y-4">
                    {track.modules.map((mod) => (
                      <div key={mod.title}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-medium text-[var(--kat-ink)]">{mod.title}</span>
                          <span className="font-mono font-bold text-[var(--kat-muted)]">
                            {mod.progress}%
                          </span>
                        </div>
                        <Progress
                          value={mod.progress}
                          className="h-1.5 rounded-none bg-[var(--kat-border)] [&>[data-slot=progress-indicator]]:bg-[var(--kat-clay)]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[var(--kat-border)] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  <p className="kat-eyebrow">Capstone</p>
                  <p className="mt-3 font-body leading-relaxed text-[var(--kat-ink)]">
                    {track.project}
                  </p>

                  <ul className="mt-5 space-y-1.5">
                    {["Mentor support", "Weekly reviews", "Portfolio ready"].map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wider text-[var(--kat-muted)]"
                      >
                        <span className="size-1 rounded-full bg-[var(--kat-pine)]" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Button asChild className={`mt-7 w-full ${STAMP_CTA}`}>
                    <Link href="/register">Enroll my child</Link>
                  </Button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
