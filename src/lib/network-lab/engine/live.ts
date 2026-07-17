import type { Level, Packet, PlayerPacket } from "../types";
import { getDefaultRecipient, getPortRecipient, getRemotePort } from "./links";
import { jsonClone } from "./packet";
import { DEVICE_SCRIPTS, type ScriptApi, type ScriptDevice } from "./scripts";
import {
  buildDevices,
  buildTriggers,
  decayFloods,
  evaluateArrival,
  type DeviceRuntime,
  type TriggerState,
} from "./state";
import { LAUNCH_STEP_MS, TIMELINE_SCALE, TWEEN_MS } from "./simulate";

/**
 * The LIVE controller for the browser. Same shared device/trigger state and arrival evaluation as
 * the batch runner, but time is driven by the UI's animation clock instead of an instant event
 * queue: the caller advances a monotonic simulation clock (real time scaled by game speed, frozen
 * while paused), and `step(now)` converts due launches into travelling packets, processes arrivals
 * whose 3s travel has elapsed, and decays the flood meters. `snapshot()` gives the UI everything it
 * needs to render, including each in-flight packet's 0..1 progress along its link.
 */

type Pending = { from: string; dst: string; payload: Packet; at: number };
type InFlight = {
  id: number;
  from: string;
  dst: string;
  payload: Packet;
  portNum: number;
  dispatchAt: number;
  arriveAt: number;
};

export type PacketView = {
  id: number;
  from: string;
  dst: string;
  payload: Packet;
  progress: number;
};
export type FloodView = { device: string; counter: number; capacity: number };
export type TriggerView = { device: string; type: "packet" | "flood"; completed: boolean };
export type LabSnapshot = {
  packets: PacketView[];
  floods: FloodView[];
  triggers: TriggerView[];
  won: boolean;
  time: number;
};

export class LabSimulation {
  readonly level: Level;
  private devices: Record<string, DeviceRuntime> = {};
  private triggers: TriggerState[] = [];
  private pending: Pending[] = [];
  private inflight: InFlight[] = [];
  private seq = 0;
  won = false;
  time = 0;

  constructor(level: Level) {
    this.level = level;
    this.reset();
  }

  /** Rebuild from scratch (the reset button, or a re-mount). */
  reset(): void {
    this.devices = buildDevices(this.level);
    this.triggers = buildTriggers(this.level);
    this.pending = [];
    this.inflight = [];
    this.seq = 0;
    this.won = false;
    this.time = 0;
    for (const ev of this.level.timeline) {
      this.dispatch(ev.from, getDefaultRecipient(this.level, ev.from), ev.payload, ev.at * TIMELINE_SCALE);
    }
  }

  private dispatch(from: string, dst: string | null, payload: Packet, at: number): void {
    if (dst === null) return;
    this.pending.push({ from, dst, payload: jsonClone(payload), at });
  }

  private apiAt(clock: number): ScriptApi {
    return {
      sendPacket: (fromId, portNum, packet) =>
        this.dispatch(fromId, getPortRecipient(this.level, fromId, portNum), packet, clock),
      getPortRecipient: (fromId, portNum) => getPortRecipient(this.level, fromId, portNum),
    };
  }

  /** Queue a player launcher: its packets leave now, `repeat` of them one launch-step apart. */
  launch(pkt: PlayerPacket): void {
    const dst = getDefaultRecipient(this.level, pkt.from);
    const repeat = pkt.repeat && pkt.repeat > 1 ? pkt.repeat : 1;
    for (let i = 0; i < repeat; i++) {
      this.dispatch(pkt.from, dst, pkt.payload, this.time + i * LAUNCH_STEP_MS);
    }
  }

  /** Advance the simulation to absolute sim time `now`. */
  step(now: number): void {
    this.time = now;

    for (;;) {
      // Start travelling any launch whose dispatch time has arrived.
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const p = this.pending[i];
        if (p.at <= now) {
          this.pending.splice(i, 1);
          this.inflight.push({
            id: this.seq++,
            from: p.from,
            dst: p.dst,
            payload: p.payload,
            portNum: getRemotePort(this.level, p.from, p.dst) ?? 0,
            dispatchAt: p.at,
            arriveAt: p.at + TWEEN_MS,
          });
        }
      }

      // Process the earliest packet whose travel has completed.
      let idx = -1;
      let best = Infinity;
      let bestId = Infinity;
      for (let i = 0; i < this.inflight.length; i++) {
        const f = this.inflight[i];
        if (f.arriveAt <= now && (f.arriveAt < best || (f.arriveAt === best && f.id < bestId))) {
          best = f.arriveAt;
          bestId = f.id;
          idx = i;
        }
      }
      if (idx === -1) break;

      const f = this.inflight.splice(idx, 1)[0];
      if (evaluateArrival(this.triggers, this.devices, { dst: f.dst, payload: f.payload }, f.arriveAt)) {
        this.won = true;
      }
      const dev = this.devices[f.dst];
      if (dev !== undefined && dev.script !== undefined) {
        DEVICE_SCRIPTS[dev.script](dev as unknown as ScriptDevice, f.payload, f.portNum, this.apiAt(f.arriveAt));
      }
    }

    decayFloods(this.triggers, this.devices, now);
  }

  snapshot(): LabSnapshot {
    const now = this.time;
    const packets: PacketView[] = this.inflight.map((f) => ({
      id: f.id,
      from: f.from,
      dst: f.dst,
      payload: f.payload,
      progress: Math.min(1, Math.max(0, (now - f.dispatchAt) / TWEEN_MS)),
    }));

    const floods: FloodView[] = [];
    for (const t of this.triggers) {
      if (t.trigger.type === "flood") {
        const dev = this.devices[t.trigger.device];
        floods.push({
          device: t.trigger.device,
          counter: dev?.floodCounter ?? 0,
          capacity: dev?.capacity ?? 1,
        });
      }
    }

    const triggers: TriggerView[] = this.triggers.map((t) => ({
      device: t.trigger.device,
      type: t.trigger.type,
      completed: t.completed,
    }));

    return { packets, floods, triggers, won: this.won, time: now };
  }
}
