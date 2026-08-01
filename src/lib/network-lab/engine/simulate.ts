import type { Level, Packet, PlayerPacket } from "../types";
import { getDefaultRecipient, getPortRecipient, getRemotePort } from "./links";
import { jsonClone } from "./packet";
import { DEVICE_SCRIPTS, type ScriptDevice } from "./scripts";
import { buildDevices, buildTriggers, decayFloods, evaluateArrival } from "./state";

/**
 * The batch (headless) engine, used by the tests. A discrete-event port of the origin's Phaser loop:
 * a packet dispatched at time T "arrives" at T + TWEEN_MS, and on arrival the origin's `donePacket`
 * runs (evaluate triggers, then fire the recipient's script). It shares device/trigger state and
 * arrival evaluation with the live UI controller (see `state.ts` and `live.ts`), so a level that
 * wins here wins in the browser.
 *
 * Timing constants come from the origin (3000ms tween, timeline at `at * 3`) except the launch
 * cadence: see `LAUNCH_STEP_MS`.
 */

export const TWEEN_MS = 3000;
// Gap between repeat launches. The origin scheduled these on the Phaser game timer, which is scaled
// by slowMotion/gamespeed, so the EFFECTIVE arrival cadence is not the raw value and cannot be
// reproduced headlessly. What matters is the flood arithmetic (120/capacity, in state.ts): a burst
// only fills when arrivals are closer than 120/capacity, and the smallest threshold is 40ms
// (capacity 3). We pick a cadence just under that so one burst can fill any target, which is plainly
// what the origin intends. This is a harness constant, not part of the ported meter math.
export const LAUNCH_STEP_MS = 30;
export const TIMELINE_SCALE = 3;
const UPDATE_MS = 20;
const MAX_STEPS = 2_000_000;
const DEFAULT_MAX_TIME = 200_000;

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

/** Run a level to completion with the given player launchers. Returns whether every trigger completed. */
export function runLevel(
  level: Level,
  playerPackets: PlayerPacket[],
  opts: { maxTime?: number } = {},
): SimResult {
  const maxTime = opts.maxTime ?? DEFAULT_MAX_TIME;

  const devices = buildDevices(level);
  const triggers = buildTriggers(level);
  const hasFlood = triggers.some((t) => t.trigger.type === "flood");

  const queue = new EventQueue();
  let seq = 0;
  let now = 0;
  let won = false;

  const dispatch = (from: string, dst: string | null, payload: Packet, at: number): void => {
    if (dst === null) return;
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

  for (const ev of level.timeline) {
    dispatch(ev.from, getDefaultRecipient(level, ev.from), ev.payload, ev.at * TIMELINE_SCALE);
  }
  playerPackets.forEach((pkt, index) => {
    const dst = getDefaultRecipient(level, pkt.from);
    const base = index * LAUNCH_STEP_MS;
    const repeat = pkt.repeat && pkt.repeat > 1 ? pkt.repeat : 1;
    for (let i = 0; i < repeat; i++) dispatch(pkt.from, dst, pkt.payload, base + i * LAUNCH_STEP_MS);
  });

  if (hasFlood) {
    for (let t = 0; t <= maxTime; t += UPDATE_MS) queue.push({ kind: "update", time: t, seq: seq++ });
  }

  let steps = 0;
  for (; steps < MAX_STEPS; steps++) {
    const ev = queue.pop();
    if (ev === undefined || ev.time > maxTime || won) break;
    now = ev.time;

    if (ev.kind === "update") {
      decayFloods(triggers, devices, now);
      continue;
    }

    if (evaluateArrival(triggers, devices, { dst: ev.dst, payload: ev.payload }, now)) won = true;

    const dev = devices[ev.dst];
    if (dev !== undefined && dev.script !== undefined) {
      DEVICE_SCRIPTS[dev.script](dev as unknown as ScriptDevice, ev.payload, ev.portNum, api);
    }
  }

  return { won, steps, time: now };
}
