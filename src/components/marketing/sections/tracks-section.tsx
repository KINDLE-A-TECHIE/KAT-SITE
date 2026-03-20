"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type TrackId, PROGRAM_TRACKS } from "../landing-tokens";

export function TracksSection() {
  const [activeTrack, setActiveTrack] = useState<TrackId>("explorers");
  const selectedTrack = useMemo(
    () => PROGRAM_TRACKS.find((t) => t.id === activeTrack) ?? PROGRAM_TRACKS[0],
    [activeTrack],
  );

  return (
    <section id="tracks" className="kat-page kat-defer py-16 sm:py-20">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--kat-primary-blue)]">
          Program Tracks
        </p>
        <h2 className="mt-2 [font-family:var(--font-space-grotesk)] text-3xl font-bold text-[var(--kat-text-primary)] sm:text-4xl">
          Pick your child&apos;s track. Watch them grow.
        </h2>
        <p className="mt-2 text-[var(--kat-text-secondary)]">
          Age-matched tracks from 8 to 19. Start where they are. Go as far as they can.
        </p>
      </div>

      <div className="rounded-3xl border border-[var(--kat-border)] bg-white p-5 shadow-[0_16px_60px_-24px_rgba(19,43,94,0.12)] sm:p-7">
        <Tabs value={activeTrack} onValueChange={(v) => setActiveTrack(v as TrackId)}>
          <TabsList className="mb-5 h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-[#EAF4FF] p-2">
            {PROGRAM_TRACKS.map((track) => (
              <TabsTrigger
                key={track.id}
                value={track.id}
                className="rounded-xl border border-transparent px-4 py-2.5 text-left data-[state=active]:border-blue-200 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <span className="block text-sm font-semibold">{track.label}</span>
                <span className="text-[11px] text-[var(--kat-text-secondary)]">{track.ages}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {PROGRAM_TRACKS.map((track) => (
            <TabsContent key={track.id} value={track.id}>
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <Card className="rounded-2xl border-[var(--kat-border)] py-5 shadow-sm">
                  <CardHeader className="px-5 pb-3">
                    <CardTitle className="[font-family:var(--font-space-grotesk)] text-xl text-[var(--kat-text-primary)]">
                      {track.label}
                    </CardTitle>
                    <CardDescription className="text-[var(--kat-text-secondary)]">{track.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 px-5">
                    {track.modules.map((mod) => (
                      <div key={mod.title}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-medium text-[var(--kat-text-secondary)]">{mod.title}</span>
                          <span className="font-bold text-[var(--kat-text-primary)]">{mod.progress}%</span>
                        </div>
                        <Progress
                          value={mod.progress}
                          className="h-2 bg-blue-100 [&>[data-slot=progress-indicator]]:bg-[var(--kat-primary-blue)]"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-[var(--kat-border)] bg-[#F8FBFF] py-5 shadow-sm">
                  <CardHeader className="px-5 pb-3">
                    <CardTitle className="[font-family:var(--font-space-grotesk)] text-lg text-[var(--kat-text-primary)]">
                      Capstone Project
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-5">
                    <p className="text-sm leading-relaxed text-[var(--kat-text-secondary)]">{track.project}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-0 bg-green-100 text-green-700 hover:bg-green-100">Mentor Support</Badge>
                      <Badge className="border-0 bg-amber-100 text-amber-700 hover:bg-amber-100">Weekly Reviews</Badge>
                      <Badge className="border-0 bg-blue-100 text-[var(--kat-primary-blue)] hover:bg-blue-100">Portfolio Ready</Badge>
                    </div>
                    <Button
                      asChild
                      className="w-full rounded-xl text-white"
                      style={{ background: "var(--kat-gradient)" }}
                    >
                      <Link href="/register">Enroll My Child</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <p className="mt-3 text-xs text-[var(--kat-text-secondary)]">
          Viewing:{" "}
          <span className="font-semibold text-[var(--kat-text-primary)]">{selectedTrack.label}</span>
        </p>
      </div>
    </section>
  );
}
