import type { Level, Packet, PlayerPacket, Trigger } from "../types";
import { getDefaultRecipient, getPortRecipient, getRemotePort } from "./links";
import { jsonClone, type PacketLayer } from "./packet";
import { DEVICE_SCRIPTS, type ScriptDevice } from "./scripts";

/**
 * The headless engine. A discrete-event port of the origin's Phaser loop: a packet dispatched at
 * time T "arrives" at T + TWEEN_MS (the 3s travel), and on arrival the origin's `donePacket` runs,
 * evaluate every trigger, then fire the recipient's device script (which may dispatch more packets).
 * The flood meter is driven by arrival timing plus a periodic `update` decay, exactly as the origin.
 *
 * Timing constants come from the origin: a 3000ms tween, a 100ms gap between repeat launches, and
 * timeline events at `at * 3`. The decay tick interval is a modelling choice (the origin ran it every
 * animation frame); it only matters during idle gaps, and the ported meter ARITHMETIC below is what
 * the tests pin.
 */

const TWEEN_MS = 3000;
// Gap between repeat launches. The origin scheduled these 100ms apart on the game timer, but the
// timer is scaled by Phaser's slowMotion/gamespeed, so the EFFECTIVE arrival cadence is not 100ms
// and cannot be reproduced headlessly. What matters is the flood arithmetic (120/capacity, ported
// exactly in satisfiesTrigger): a burst only fills when arrivals are closer than 120/capacity, and
// the smallest threshold is 40ms (capacity 3). We pick a cadence just under that so a single burst
// can fill any flood target, which is plainly what the origin intends. This is a harness constant,
// not part of the ported meter math.
const LAUNCH_STEP_MS = 30;
const TIMELINE_SCALE = 3;
const UPDATE_MS = 20;
const MAX_STEPS = 2_000_000;
const DEFAULT_MAX_TIME = 200_000;

/** A device at runtime: its JSON fields plus the wired neighbours and the lazily-added flood state. */
export type DeviceRuntime = {
  id: string;
  ports: (string | null)[];
  capacity?: number;
  script?: keyof typeof DEVICE_SCRIPTS;
  rules?: unknown;
  floodCounter?: number;
  floodLast?: number;
};

type TriggerState = { trigger: Trigger; times: number | undefined; completed: boolean };

/**
 * `satisfiesTrigger`, ported verbatim from `phaser.inc.php`. For a packet trigger, matches the
 * destination and (if given) every payload field, case-insensitive and trimmed. For a flood trigger,
 * advances the device's flood meter and returns whether it has reached the cap (30).
 *
 * `noup` is the decay path the origin calls from `update()` every frame; `now` replaces the global
 * `game.time.events.ms` so the arithmetic is pure and directly testable.
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
      for (const layer of Object.keys(tPayload) as PacketLayer[]) {
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

  // flood
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

type SimEvent =
  | { kind: "arrive"; time: number; seq: number; dst: string; payload: Packet; portNum: number }
  | { kind: "update"; time: number; seq: number };

/** A tiny binary min-heap keyed by (time, seq) so events fire in a stable time order. */
class EventQueue {
  private items: SimEvent[] = [];
  get size(): number {
    return this.items.length;
  }
  private less(a: SimEvent, b: SimEvent): boolean {
    return a.time !== b.time ? a.time < b.time : a.seq < b.seq;
  }
  push(ev: SimEvent): void {
    const items = this.items;
    items.push(ev);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(items[i], items[parent])) {
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      } else break;
    }
  }
  pop(): SimEvent | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < items.length && this.less(items[l], items[smallest])) smallest = l;
        if (r < items.length && this.less(items[r], items[smallest])) smallest = r;
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }
}

export type SimResult = { won: boolean; steps: number; time: number };

/**
 * Run a level to completion (or until the event queue drains / limits are hit) with the given
 * player launchers. Returns whether every trigger completed.
 */
export function runLevel(
  level: Level,
  playerPackets: PlayerPacket[],
  opts: { maxTime?: number } = {},
): SimResult {
  const maxTime = opts.maxTime ?? DEFAULT_MAX_TIME;

  // Build runtime devices (deep-cloned so scripts can mutate rules) and wire their ports from links.
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

  const triggers: TriggerState[] = level.triggers.map((t) => ({
    trigger: t,
    times: t.type === "packet" ? t.times : undefined,
    completed: false,
  }));
  const hasFlood = triggers.some((t) => t.trigger.type === "flood");

  const queue = new EventQueue();
  let seq = 0;
  let now = 0;
  let won = false;

  const dispatch = (from: string, dst: string | null, payload: Packet, at: number): void => {
    if (dst === null) return; // no link: the packet has nowhere to go, as in the origin
    queue.push({
      kind: "arrive",
      time: at + TWEEN_MS,
      seq: seq++,
      dst,
      payload: jsonClone(payload),
      portNum: getRemotePort(level, from, dst) ?? 0,
    });
  };

  const api = {
    sendPacket: (fromId: string, portNum: number, packet: Packet): void => {
      dispatch(fromId, getPortRecipient(level, fromId, portNum), packet, now);
    },
    getPortRecipient: (fromId: string, portNum: number): string | null =>
      getPortRecipient(level, fromId, portNum),
  };

  // Seed the timeline (scripted traffic) and the player launchers.
  for (const ev of level.timeline) {
    dispatch(ev.from, getDefaultRecipient(level, ev.from), ev.payload, ev.at * TIMELINE_SCALE);
  }
  playerPackets.forEach((pkt, index) => {
    const dst = getDefaultRecipient(level, pkt.from);
    const base = index * LAUNCH_STEP_MS;
    const repeat = pkt.repeat && pkt.repeat > 1 ? pkt.repeat : 1;
    for (let i = 0; i < repeat; i++) {
      dispatch(pkt.from, dst, pkt.payload, base + i * LAUNCH_STEP_MS);
    }
  });

  if (hasFlood) {
    for (let t = 0; t <= maxTime; t += UPDATE_MS) {
      queue.push({ kind: "update", time: t, seq: seq++ });
    }
  }

  let steps = 0;
  for (; steps < MAX_STEPS; steps++) {
    const ev = queue.pop();
    if (ev === undefined || ev.time > maxTime || won) break;
    now = ev.time;

    if (ev.kind === "update") {
      // The origin's per-frame decay: advance every flood meter, ignore the result (win is only
      // checked on arrival, in donePacket below).
      for (const t of triggers) {
        if (t.trigger.type === "flood") {
          satisfiesTrigger({ dst: t.trigger.device }, t.trigger, devices[t.trigger.device], now, true);
        }
      }
      continue;
    }

    // donePacket: evaluate every trigger, then run the recipient's script.
    let youWin = true;
    for (const t of triggers) {
      const matched = satisfiesTrigger(
        { dst: ev.dst, payload: ev.payload },
        t.trigger,
        devices[t.trigger.device],
        now,
        false,
      );
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
    if (youWin) won = true;

    const dev = devices[ev.dst];
    if (dev !== undefined && dev.script !== undefined) {
      const script = DEVICE_SCRIPTS[dev.script];
      script(dev as unknown as ScriptDevice, ev.payload, ev.portNum, api);
    }
  }

  return { won, steps, time: now };
}
