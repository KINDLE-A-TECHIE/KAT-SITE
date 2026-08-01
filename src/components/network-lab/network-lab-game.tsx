"use client";

import { useEffect, useRef, useState } from "react";
import { FastForward, Pause, Play, RotateCcw, Trophy } from "lucide-react";
import { LabSimulation, type LabSnapshot } from "@/lib/network-lab/engine";
import type { Level, Packet, PlayerPacket } from "@/lib/network-lab/types";
import { LabCanvas } from "./lab-canvas";
import { PacketEditor, type PacketDraft } from "./packet-editor";

/**
 * The playable Network Lab, a thin React shell over the headless engine (LabSimulation). A
 * requestAnimationFrame loop advances a simulation clock (real time scaled by game speed, frozen
 * while paused), steps the engine, and publishes a snapshot into state to render. All simulation
 * logic lives in the engine; this component only renders state and dispatches actions. Warm palette,
 * no blue, responsive down to a 380px viewport (the side panel stacks under the canvas), and honours
 * prefers-reduced-motion.
 */

const SPEED_FACTOR = { normal: 1, fast: 3 } as const;
type Speed = keyof typeof SPEED_FACTOR;

const chip =
  "flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:border-[var(--kat-clay)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kat-clay)] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200";
const chipActive = "border-[var(--kat-clay)] bg-[var(--kat-clay)] text-white hover:bg-[var(--kat-clay-deep)]";

/** The view of a freshly-built level, computed from the level alone (no engine access at render). */
function initialSnapshot(level: Level): LabSnapshot {
  return {
    packets: [],
    floods: level.triggers
      .filter((t) => t.type === "flood")
      .map((t) => ({
        device: t.device,
        counter: 0,
        capacity: level.devices.find((d) => d.id === t.device)?.capacity ?? 1,
      })),
    triggers: level.triggers.map((t) => ({ device: t.device, type: t.type, completed: false })),
    won: false,
    time: 0,
  };
}

export function NetworkLabGame({
  level,
  onWin,
  initialDraft,
  onDraftChange,
}: {
  level: Level;
  onWin?: () => void;
  initialDraft?: PacketDraft | null;
  onDraftChange?: (draft: PacketDraft) => void;
}) {
  const simRef = useRef<LabSimulation | null>(null);
  if (simRef.current === null) simRef.current = new LabSimulation(level);

  const [snap, setSnap] = useState<LabSnapshot>(() => initialSnapshot(level));
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedPacketId, setSelectedPacketId] = useState<number | null>(null);

  const simTimeRef = useRef(0);
  const lastRealRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const onWinRef = useRef(onWin);
  const wonFiredRef = useRef(false);

  // Mirror the latest paused/speed/onWin into refs the rAF loop reads, without re-subscribing it.
  useEffect(() => {
    pausedRef.current = paused;
    speedRef.current = speed;
    onWinRef.current = onWin;
  }, [paused, speed, onWin]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const sim = simRef.current!;
    let raf = 0;
    const loop = (t: number) => {
      const last = lastRealRef.current;
      lastRealRef.current = t;
      if (last !== null && !pausedRef.current && !sim.won) {
        simTimeRef.current += (t - last) * SPEED_FACTOR[speedRef.current];
        sim.step(simTimeRef.current);
        setSnap(sim.snapshot());
        if (sim.won && !wonFiredRef.current) {
          wonFiredRef.current = true;
          onWinRef.current?.();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const reset = () => {
    const sim = simRef.current!;
    sim.reset();
    simTimeRef.current = 0;
    lastRealRef.current = null;
    wonFiredRef.current = false;
    setSelectedDeviceId(null);
    setSelectedPacketId(null);
    setPaused(false);
    setSnap(sim.snapshot());
  };

  const onLaunch = (pkt: PlayerPacket) => {
    const sim = simRef.current!;
    sim.launch(pkt);
    setSnap(sim.snapshot());
    if (paused) setPaused(false);
  };

  const selectedDevice = selectedDeviceId
    ? level.devices.find((d) => d.id === selectedDeviceId)
    : undefined;
  const selectedPacket =
    selectedPacketId !== null ? snap.packets.find((p) => p.id === selectedPacketId) : undefined;
  const done = snap.triggers.filter((t) => t.completed).length;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {/* Canvas + controls */}
      <div className="min-w-0 md:flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" className={chip} onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {paused ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            className={`${chip} ${speed === "fast" ? chipActive : ""}`}
            onClick={() => setSpeed((s) => (s === "fast" ? "normal" : "fast"))}
            aria-pressed={speed === "fast"}
          >
            <FastForward className="size-4" />
            Fast
          </button>
          <button type="button" className={chip} onClick={reset}>
            <RotateCcw className="size-4" />
            Reset
          </button>
          <span className="ml-auto font-mono text-xs text-stone-500">
            {done}/{snap.triggers.length} goals
          </span>
        </div>

        <div className="relative">
          <LabCanvas
            level={level}
            packets={snap.packets}
            reducedMotion={reducedMotion}
            selectedDeviceId={selectedDeviceId}
            selectedPacketId={selectedPacketId}
            onDeviceClick={(id) => {
              setSelectedDeviceId(id);
              setSelectedPacketId(null);
            }}
            onPacketClick={(id) => {
              setSelectedPacketId(id);
              setSelectedDeviceId(null);
            }}
          />

          {snap.won && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[var(--kat-ink)]/70 p-4">
              <div className="max-w-xs rounded-2xl border border-[var(--kat-clay)] bg-[var(--kat-paper)] p-6 text-center shadow-lg">
                <Trophy className="mx-auto size-8 text-[var(--kat-clay)]" aria-hidden="true" />
                <p className="mt-3 font-semibold text-[var(--kat-ink)]">Level complete</p>
                <p className="mt-1 text-sm text-stone-600">Every objective was met.</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 rounded-lg bg-[var(--kat-clay)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--kat-clay-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kat-clay)] focus-visible:ring-offset-1"
                >
                  Play again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Objectives + flood meters */}
        <div className="mt-3 space-y-2" role="group" aria-label="Objectives">
          {/* Announced to screen readers as goals complete and on win (the dots/strike-through are
              visual only). Polite so it does not interrupt, and it changes text each time so it fires. */}
          <p className="sr-only" role="status" aria-live="polite">
            {snap.won
              ? "Level complete. Every objective met."
              : `${done} of ${snap.triggers.length} objectives complete.`}
          </p>
          {snap.triggers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className={
                  "size-2.5 rounded-full " +
                  (t.completed ? "bg-[var(--kat-pine)]" : "bg-stone-300 dark:bg-stone-600")
                }
                aria-hidden="true"
              />
              <span
                className={t.completed ? "text-stone-500 line-through" : "text-stone-700 dark:text-stone-300"}
              >
                {t.type === "flood" ? "Overwhelm" : "Deliver to"} {t.device}
                <span className="sr-only">{t.completed ? ", completed" : ", not yet completed"}</span>
              </span>
            </div>
          ))}
          {snap.floods.map((f) => (
            <div key={f.device} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-stone-500">{f.device}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                <span
                  className="block h-full rounded-full bg-[var(--kat-clay)] transition-[width]"
                  style={{ width: `${Math.round((f.counter / 30) * 100)}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      <div className="space-y-4 md:w-72 md:shrink-0">
        <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <h3 className="mb-3 font-semibold text-stone-800 dark:text-stone-100">Build a packet</h3>
          <PacketEditor
            level={level}
            disabled={snap.won}
            onLaunch={onLaunch}
            initialDraft={initialDraft}
            onDraftChange={onDraftChange}
          />
        </section>

        <section className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <h3 className="mb-2 font-semibold text-stone-800 dark:text-stone-100">Inspect</h3>
          {selectedDevice ? (
            <DeviceInfo device={selectedDevice} />
          ) : selectedPacket ? (
            <PacketInfo payload={selectedPacket.payload} />
          ) : (
            <p className="text-sm text-stone-500">Pause, then click a device or a packet to inspect it.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function DeviceInfo({ device }: { device: Level["devices"][number] }) {
  const rows: [string, string][] = [["IP address", device.secret ? "secret" : device.id]];
  if (device.capacity !== undefined) rows.push(["Role", "flood target"]);
  else if (device.script) rows.push(["Role", "network device"]);
  return <InfoTable rows={rows} />;
}

function PacketInfo({ payload }: { payload: Packet }) {
  const rows: [string, string][] = [];
  for (const layer of ["network", "transport", "application"] as const) {
    const l = payload[layer] as Record<string, unknown> | undefined;
    if (l) {
      for (const [k, v] of Object.entries(l)) rows.push([`${layer}.${k}`, String(v)]);
    }
  }
  if (rows.length === 0) return <p className="text-sm text-stone-500">Empty packet.</p>;
  return <InfoTable rows={rows} />;
}

function InfoTable({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-stone-500">{k}</dt>
          <dd className="font-mono text-stone-800 dark:text-stone-200">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
