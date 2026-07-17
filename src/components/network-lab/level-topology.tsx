"use client";

import {
  Laptop,
  Monitor,
  Router,
  Server,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { Device, Level } from "@/lib/network-lab/types";
import { isPlayerDevice } from "@/lib/network-lab/levels";

/**
 * Phase 0 static render of a level's topology: devices as labelled icons at their x/y fractions,
 * links as lines between them. No animation, no engine, no interaction yet. Warm palette only.
 *
 * Coordinates are 0..1 fractions of the canvas. Devices are absolutely positioned by percentage;
 * links are drawn in an SVG overlay whose viewBox is 0..100 with `preserveAspectRatio="none"`, so
 * the two layers stay aligned as the container scales. `vectorEffect="non-scaling-stroke"` keeps the
 * line weight constant regardless of that non-uniform scaling.
 */

const ICONS: Record<string, LucideIcon> = {
  "iphone-1": Smartphone,
  macbook: Laptop,
  imac: Monitor,
  monitor: Monitor,
  server: Server,
  router: Router,
};

function iconFor(device: Device): LucideIcon {
  return (device.image && ICONS[device.image]) || Monitor;
}

export function LevelTopology({ level }: { level: Level }) {
  const byId = new Map(level.devices.map((d) => [d.id, d]));

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900">
      {/* Links layer */}
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
              strokeOpacity={0.3}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {/* Devices layer */}
      {level.devices.map((device) => {
        const Icon = iconFor(device);
        const isPlayer = isPlayerDevice(device);
        return (
          <div
            key={device.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${device.x * 100}%`, top: `${device.y * 100}%` }}
          >
            <div
              className={
                "flex size-11 items-center justify-center rounded-lg border bg-white shadow-sm dark:bg-stone-800 " +
                (isPlayer
                  ? "border-[var(--kat-clay)] ring-2 ring-[var(--kat-clay)]/30"
                  : "border-stone-200 dark:border-stone-700")
              }
              title={device.secret ? "secret device" : device.id}
            >
              <Icon
                className={"size-5 " + (isPlayer ? "text-[var(--kat-clay)]" : "text-stone-500 dark:text-stone-400")}
                aria-hidden="true"
              />
            </div>
            <span className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-800/80 dark:text-stone-300">
              {device.id}
            </span>
          </div>
        );
      })}
    </div>
  );
}
