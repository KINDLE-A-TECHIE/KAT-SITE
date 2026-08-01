import type { DeviceScriptName, Level, Packet, Trigger } from "../types";
import { jsonClone } from "./packet";

/**
 * Shared simulation state and the ported `satisfiesTrigger`.
 *
 * Both the batch runner (`simulate.ts`, used by tests) and the live controller (`live.ts`, used by
 * the UI) build the same device/trigger state and evaluate arrivals the same way, they only differ
 * in how they schedule time (instant discrete events vs a real-time animation clock). Keeping the
 * shared parts here is what stops the two from drifting: a level that wins under test must win in
 * the browser.
 */

/** A device at runtime: its JSON fields plus wired neighbours and lazily-added flood state. */
export type DeviceRuntime = {
  id: string;
  ports: (string | null)[];
  capacity?: number;
  script?: DeviceScriptName;
  rules?: unknown;
  floodCounter?: number;
  floodLast?: number;
};

export type TriggerState = { trigger: Trigger; times: number | undefined; completed: boolean };

export function buildDevices(level: Level): Record<string, DeviceRuntime> {
  const devices: Record<string, DeviceRuntime> = {};
  for (const d of level.devices) {
    const dev = jsonClone(d) as unknown as DeviceRuntime;
    dev.ports = [];
    devices[d.id] = dev;
  }
  for (const link of level.links) {
    devices[link.src].ports[link.srcport] = link.dst;
    devices[link.dst].ports[link.dstport] = link.src;
  }
  return devices;
}

export function buildTriggers(level: Level): TriggerState[] {
  return level.triggers.map((t) => ({
    trigger: t,
    times: t.type === "packet" ? t.times : undefined,
    completed: false,
  }));
}

type PacketLayerKey = "network" | "transport" | "application";

/**
 * `satisfiesTrigger`, ported verbatim from `phaser.inc.php`. Packet triggers match the destination
 * and every given payload field (case-insensitive, trimmed). Flood triggers advance the device's
 * meter and report whether it has hit the cap (30). `now` replaces the origin's global clock so the
 * arithmetic is pure and directly testable; `noup` is the per-frame decay path from `update()`.
 */
export function satisfiesTrigger(
  arrival: { dst: string; payload?: Packet },
  trigger: Trigger,
  device: DeviceRuntime | undefined,
  now: number,
  noup: boolean,
): boolean {
  if (arrival.dst !== trigger.device) return false;

  if (trigger.type === "packet") {
    if (trigger.payload === undefined && trigger.times === undefined) return true;
    if (arrival.payload === undefined) return false;

    const tPayload = trigger.payload;
    if (tPayload !== undefined) {
      for (const layer of Object.keys(tPayload) as PacketLayerKey[]) {
        const pLayer = arrival.payload[layer] as Record<string, unknown> | undefined;
        const tLayer = tPayload[layer] as Record<string, unknown> | undefined;
        if (pLayer === undefined || tLayer === undefined) return false;
        for (const field of Object.keys(tLayer)) {
          const pv = pLayer[field];
          if (pv === undefined) return false;
          if (String(pv).trim().toLowerCase() !== String(tLayer[field]).trim().toLowerCase()) {
            return false;
          }
        }
      }
    }
    return true;
  }

  if (device === undefined) return false;
  if (device.floodCounter === undefined) {
    device.floodCounter = 0;
    device.floodLast = 0;
  }
  const capacity = device.capacity ?? 1;
  const threshold = 120 / capacity;
  const delta = now - (device.floodLast ?? 0);

  if (noup && device.floodCounter > 0) {
    if (delta > 200) {
      device.floodCounter--;
      device.floodLast = now;
    }
  } else if (delta < threshold) {
    device.floodCounter++;
    if (device.floodCounter > 30) device.floodCounter = 30;
  } else {
    device.floodCounter -= Math.floor(delta / threshold);
    if (device.floodCounter < 0) device.floodCounter = 0;
  }

  if (!noup) device.floodLast = now;
  return device.floodCounter === 30;
}

/**
 * The origin's `donePacket` trigger loop: evaluate every trigger against this arrival, advance
 * per-trigger `times`, and report whether the whole level is now won. Mutates trigger state.
 */
export function evaluateArrival(
  triggers: TriggerState[],
  devices: Record<string, DeviceRuntime>,
  arrival: { dst: string; payload?: Packet },
  now: number,
): boolean {
  let youWin = true;
  for (const t of triggers) {
    const matched = satisfiesTrigger(arrival, t.trigger, devices[t.trigger.device], now, false);
    if (matched) {
      if (t.trigger.type === "packet" && t.times !== undefined) {
        t.times--;
        if (t.times <= 0) t.completed = true;
      } else {
        t.completed = true;
      }
    }
    if (!t.completed) youWin = false;
  }
  return youWin;
}

/** The origin's per-frame `update()`: decay every flood meter. Result is ignored (win is on arrival). */
export function decayFloods(
  triggers: TriggerState[],
  devices: Record<string, DeviceRuntime>,
  now: number,
): void {
  for (const t of triggers) {
    if (t.trigger.type === "flood") {
      satisfiesTrigger({ dst: t.trigger.device }, t.trigger, devices[t.trigger.device], now, true);
    }
  }
}
