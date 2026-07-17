import type { Level } from "../types";

/**
 * Port-based link resolution, ported verbatim from the origin (`phaser.inc.php`).
 *
 * `getDefaultRecipient` is the first-link fallback used when a device (or a player/timeline launch)
 * sends without choosing a port. `getPortRecipient` resolves the neighbour on a specific port.
 * `getRemotePort` is the neighbour-side port a packet arrives on; the origin comments that it must
 * be called only by the animator, never a device script, we keep that boundary (scripts never see it).
 */

export function getDefaultRecipient(level: Level, from: string): string | null {
  for (const link of level.links) {
    if (link.src === from) return link.dst;
    if (link.dst === from) return link.src;
  }
  return null;
}

export function getPortRecipient(level: Level, from: string, portNum: number): string | null {
  for (const link of level.links) {
    if (link.src === from && link.srcport === portNum) return link.dst;
    if (link.dst === from && link.dstport === portNum) return link.src;
  }
  return null;
}

/** The port on `dst` that faces `src`. Used only to stamp an arriving packet's port. */
export function getRemotePort(level: Level, src: string, dst: string): number | undefined {
  for (const link of level.links) {
    if (link.src === src && link.dst === dst) return link.dstport;
    if (link.src === dst && link.dst === src) return link.srcport;
  }
  return undefined;
}
