"use client";

import { Laptop, Monitor, Router, Server, Smartphone, type LucideIcon } from "lucide-react";
import type { PacketView } from "@/lib/network-lab/engine";
import { isPlayerDevice } from "@/lib/network-lab/levels";
import type { Device, Level } from "@/lib/network-lab/types";

/**
 * The playable canvas: devices as labelled icons at their x/y fractions, links as lines, and live
 * packets as dots travelling along their link. Presentational only, all state and timing come from
 * the LabSimulation above it. Warm palette, no blue.
 *
 * A `secret` device never reveals its id (on the canvas or in the label): the flag exists so a level
 * can hide who a machine really is, so we honour it here as the origin did in its info panel.
 * Under reduced motion, a packet is drawn as a static dot at the midpoint of its link rather than
 * gliding.
 */

const ICONS: Record<string, LucideIcon> = {
  "iphone-1": Smartphone,
  macbook: Laptop,
  imac: Monitor,
  monitor: Monitor,
  server: Server,
  router: Router,
};

const iconFor = (device: Device): LucideIcon => (device.image && ICONS[device.image]) || Monitor;
const labelFor = (device: Device): string => (device.secret ? "secret" : device.id);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function LabCanvas({
  level,
  packets,
  reducedMotion,
  selectedDeviceId,
  selectedPacketId,
  onDeviceClick,
  onPacketClick,
}: {
  level: Level;
  packets: PacketView[];
  reducedMotion: boolean;
  selectedDeviceId: string | null;
  selectedPacketId: number | null;
  onDeviceClick: (id: string) => void;
  onPacketClick: (id: number) => void;
}) {
  const byId = new Map(level.devices.map((d) => [d.id, d]));

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900">
      {/* Links */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {level.links.map((link, i) => {
          const src = byId.get(link.src);
          const dst = byId.get(link.dst);
          if (!src || !dst) return null;
          return (
            <line
              key={i}
              x1={src.x * 100}
              y1={src.y * 100}
              x2={dst.x * 100}
              y2={dst.y * 100}
              stroke="var(--kat-clay)"
              strokeOpacity={0.28}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {/* Live packets */}
      {packets.map((pkt) => {
        const src = byId.get(pkt.from);
        const dst = byId.get(pkt.dst);
        if (!src || !dst) return null;
        const t = reducedMotion ? 0.5 : pkt.progress;
        const selected = pkt.id === selectedPacketId;
        return (
          <button
            key={pkt.id}
            type="button"
            onClick={() => onPacketClick(pkt.id)}
            aria-label="Inspect packet"
            className={
              "absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--kat-clay)] shadow " +
              (selected ? "ring-2 ring-[var(--kat-sun)] ring-offset-1" : "")
            }
            style={{ left: `${lerp(src.x, dst.x, t) * 100}%`, top: `${lerp(src.y, dst.y, t) * 100}%` }}
          />
        );
      })}

      {/* Devices */}
      {level.devices.map((device) => {
        const Icon = iconFor(device);
        const isPlayer = isPlayerDevice(device);
        const selected = device.id === selectedDeviceId;
        return (
          <button
            key={device.id}
            type="button"
            onClick={() => onDeviceClick(device.id)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 focus:outline-none"
            style={{ left: `${device.x * 100}%`, top: `${device.y * 100}%` }}
            aria-label={`Inspect ${labelFor(device)}`}
          >
            <span
              className={
                "flex size-11 items-center justify-center rounded-lg border bg-white shadow-sm transition dark:bg-stone-800 " +
                (isPlayer
                  ? "border-[var(--kat-clay)] ring-2 ring-[var(--kat-clay)]/30 "
                  : "border-stone-200 dark:border-stone-700 ") +
                (selected ? "outline outline-2 outline-offset-1 outline-[var(--kat-sun)]" : "")
              }
            >
              <Icon
                className={
                  "size-5 " + (isPlayer ? "text-[var(--kat-clay)]" : "text-stone-500 dark:text-stone-400")
                }
                aria-hidden="true"
              />
            </span>
            <span className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-800/80 dark:text-stone-300">
              {labelFor(device)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
