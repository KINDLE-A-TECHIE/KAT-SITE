import type { Packet } from "../types";

/**
 * Packet helpers, ported from the origin CS4G Netsim (`js/ui.js`, `js/devicescripts.js`).
 *
 * The origin defines `packetFields` (the layers/fields a packet may carry) and `copyPacket`
 * (a field-filtered clone). Device scripts also use `JSON.parse(JSON.stringify(pkt))` for a full
 * deep clone; `jsonClone` reproduces that exactly (drops `undefined`, breaks references).
 */

export type PacketLayer = "network" | "transport" | "application";

export const PACKET_FIELDS: ReadonlyArray<{ layer: PacketLayer; fields: readonly string[] }> = [
  { layer: "network", fields: ["srcip", "dstip"] },
  { layer: "transport", fields: ["proto", "ttl"] },
  { layer: "application", fields: ["type", "key"] },
];

/** The origin's `JSON.parse(JSON.stringify(x))` deep clone: drops undefined, no shared refs. */
export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The origin `copyPacket`: a clone restricted to the known layers/fields. Used by `broadcast`. */
export function copyPacket(packet: Packet): Packet {
  const out: Record<string, Record<string, unknown>> = {};
  for (const { layer, fields } of PACKET_FIELDS) {
    const src = packet[layer] as Record<string, unknown> | undefined;
    if (src) {
      const dst: Record<string, unknown> = {};
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(src, field)) dst[field] = src[field];
      }
      out[layer] = dst;
    }
  }
  return out as Packet;
}

// Rule shapes the ported scripts read out of a device's `rules`.
export type RouteRule = { dstip: string; portNum: number };
export type FirewallRule = { srcip: string };
export type NatTable = Record<string, { portNum: number; dstip: string }>;
