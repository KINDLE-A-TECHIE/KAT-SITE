import rawLevels from "./levels.json";
import type { Device, Level } from "./types";

/**
 * The shipped levels, loaded typed. `levels.json` holds the 13 converted CS4G Netsim levels, keyed
 * by their string key (`level01`, `spoofs01`, ...). The cast goes through `unknown` because the
 * JSON's inferred literal types (e.g. `player: "true"`) do not structurally line up with `Level`
 * without it; the shape is guarded at runtime by `src/__tests__/lib/network-lab/levels.test.ts`.
 */
export const LEVELS = rawLevels as unknown as Record<string, Level>;

/** All levels as a flat array, in insertion order. */
export function allLevels(): Level[] {
  return Object.values(LEVELS);
}

/** Look a level up by its string key (e.g. "level01"). */
export function getLevel(key: string): Level | undefined {
  return LEVELS[key];
}

/** Look a level up by its numeric `id`. */
export function getLevelById(id: number): Level | undefined {
  return allLevels().find((level) => level.id === id);
}

/**
 * Whether a device is player-controllable. Handles the legacy `player` quirk (string "true" in some
 * levels, boolean in others). A boolean `false` really means not-a-player, so we cannot just check
 * truthiness of the raw value alone, we normalise here in one place.
 */
export function isPlayerDevice(device: Device): boolean {
  return device.player === true || device.player === "true";
}
