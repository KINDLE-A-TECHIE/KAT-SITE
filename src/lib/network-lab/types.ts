/**
 * Core Network Lab types.
 *
 * These match `levels.json` (the shipped, converted CS4G Netsim levels), NOT just the build guide's
 * outside-written spec. Where the real data carries fields the spec omitted, they are here and
 * commented, so `levels.json` loads under strict TypeScript with no `any` and nothing silently lost.
 */

/** A packet, up to three layers. Students edit these fields and launch from a player device. */
export type Packet = {
  network?: { srcip?: string; dstip?: string };
  transport?: { proto?: string; ttl?: number };
  application?: { type?: string; key?: string };
};

/** The nine ported device behaviours plus the two new web-unit scripts (Phase 4). */
export type DeviceScriptName =
  | "ping"
  | "manualRouter"
  | "modem"
  | "switch"
  | "firewall"
  | "broadcast"
  | "encryption"
  | "tappedRouter"
  | "proxy"
  | "dnsServer" // new (web unit)
  | "webServer"; // new (web unit)

/**
 * A node on the canvas.
 *
 * QUIRK, `player` in the shipped data is inconsistent: some levels use the string `"true"`, others a
 * real boolean. Model both so the JSON type-checks; use `isPlayerDevice()` (see `levels.ts`) rather
 * than a raw truthiness check, since the string `"false"` would never appear but a boolean `false`
 * does.
 */
export type Device = {
  id: string; // its IP or name
  image?: string; // icon key: iphone-1, macbook, monitor, server, imac, router
  x: number; // 0..1 fraction of the canvas width
  y: number; // 0..1 fraction of the canvas height
  ports?: number;
  player?: boolean | "true"; // legacy: string "true" in some levels, boolean in others
  secret?: boolean; // hide the real id during play (inspect shows "secret")
  capacity?: number; // present on flood/DoS targets
  bufferWait?: number; // legacy per-device drain delay, carried from the origin data
  rules?: unknown; // router/NAT/firewall state, shape depends on the script
  script?: DeviceScriptName; // behaviour
  type?: string; // legacy alternate to `script` seen on a few devices (e.g. "ManualRouter")
};

/** An edge connecting two device ports. Routing is port-based. */
export type Link = { src: string; srcport: number; dst: string; dstport: number };

/** A scripted packet the level auto-fires for students to observe. */
export type TimelineEvent = {
  type: "packet";
  at: number; // ms into the run
  from: string;
  payload: Packet;
  times?: number; // repeat count, present on some scripted-traffic events
};

/**
 * A win condition.
 * - `packet`: the named device received a packet; if `payload` is given, its fields must match
 *   (case-insensitive, trimmed); `times` requires N matches.
 * - `flood`: a `capacity` device's flood meter reaches max.
 */
export type Trigger =
  | { type: "packet"; device: string; payload?: Packet; times?: number }
  | { type: "flood"; device: string };

/** A level, declarative JSON. Won when every trigger is completed. */
export type Level = {
  id: number;
  unit: string;
  name?: string;
  devices: Device[];
  links: Link[];
  timeline: TimelineEvent[];
  triggers: Trigger[];
  nextLevel?: number;
};

/** A launcher a student builds and saves (persistence, Phase 3). */
export type PlayerPacket = { from: string; payload: Packet; repeat?: number };
