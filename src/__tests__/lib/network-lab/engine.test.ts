import { describe, it, expect } from "vitest";
import type { PlayerPacket } from "@/lib/network-lab/types";
import { getLevel } from "@/lib/network-lab/levels";
import {
  DEVICE_SCRIPTS,
  runLevel,
  satisfiesTrigger,
  type DeviceRuntime,
  type ScriptApi,
  type ScriptDevice,
} from "@/lib/network-lab/engine";

/**
 * The engine is a faithful headless port of CS4G Netsim (js/devicescripts.js + phaser.inc.php).
 * Two things must hold, forever:
 *  1. every level is winnable by its intended solution (else we shipped an unwinnable lesson);
 *  2. the flood meter and the switch learning behave exactly as the origin (the subtle bits).
 *
 * The intended solutions below are derived from each level's real devices, links and triggers.
 */

// Each entry is the player launcher(s) that solve the level.
const SOLUTIONS: Record<string, PlayerPacket[]> = {
  // Send anything to Doug (any packet arriving satisfies the trigger).
  level01: [{ from: "Carol", payload: { network: { srcip: "Carol", dstip: "Doug" } } }],
  // A packet from Alice to Bob.
  level02: [{ from: "Alice", payload: { network: { srcip: "Alice", dstip: "Bob" } } }],
  // Ping Google; its `ping` script echoes back. Trigger wants 5 replies.
  level03: [
    {
      from: "Alice",
      payload: { network: { srcip: "Alice", dstip: "Google" }, transport: { proto: "ICMP" } },
      repeat: 6,
    },
  ],
  // Bob routes a packet to Carol across the router mesh.
  level04: [{ from: "Bob", payload: { network: { srcip: "Bob", dstip: "Carol" } } }],
  // Alice pings Google through the home NAT modem; the reply comes back mapped to Alice.
  level05: [
    {
      from: "Alice",
      payload: { network: { srcip: "Alice", dstip: "Google" }, transport: { proto: "ICMP" } },
    },
  ],
  // Spoof Carol as the source of a packet to Bob (both the router and Bob see it).
  spoofs01: [{ from: "Alice", payload: { network: { srcip: "Carol", dstip: "Bob" } } }],
  // Poison the switch (teach it Charlie is on Alice's port), then reflect Google->Charlie back.
  spoofs02: [
    { from: "Alice", payload: { network: { srcip: "Charlie", dstip: "Bob" } } },
    { from: "Alice", payload: { network: { srcip: "Google", dstip: "Charlie" } } },
  ],
  // Flood Google (capacity 1).
  dos01: [{ from: "Alice", payload: { network: { srcip: "Alice", dstip: "Google" } }, repeat: 45 }],
  // Alice is firewalled; the zombies are not. Flood from the zombies (capacity 3, behind firewall).
  dos02: [
    { from: "Zombie 1", payload: { network: { srcip: "Zombie 1", dstip: "Google" } }, repeat: 20 },
    { from: "Zombie 2", payload: { network: { srcip: "Zombie 2", dstip: "Google" } }, repeat: 20 },
    { from: "Zombie 3", payload: { network: { srcip: "Zombie 3", dstip: "Google" } }, repeat: 20 },
  ],
  // Smurf: a broadcast spoofed as Google makes every host reply to Google (3x amplification).
  dos03: [
    {
      from: "Alice",
      payload: { network: { srcip: "Google", dstip: "Broadcast" }, transport: { proto: "ICMP" } },
      repeat: 45,
    },
  ],
  // MITM: Eve feeds Alice a fake key (Alice then leaks a message Eve can read), and delivers the
  // real-key message to Bob.
  attacks01: [
    {
      from: "Eve",
      payload: {
        network: { srcip: "Bob", dstip: "Alice" },
        transport: { proto: "encryption" },
        application: { type: "keyresponse", key: "31337" },
      },
    },
    {
      from: "Eve",
      payload: {
        network: { srcip: "Alice", dstip: "Bob" },
        transport: { proto: "encryption" },
        application: { type: "message", key: "123456" },
      },
    },
  ],
  // Censorship evasion: reach the blocked site by sending via the proxy.
  attacks02: [{ from: "Alice", payload: { network: { srcip: "Alice", dstip: "Proxy" } } }],
  // Traceroute: address an ICMP packet to each router along the path.
  attacks03: [
    {
      from: "Alice",
      payload: { network: { srcip: "Alice", dstip: "Waterloo" }, transport: { proto: "ICMP" } },
    },
    {
      from: "Alice",
      payload: { network: { srcip: "Alice", dstip: "Toronto" }, transport: { proto: "ICMP" } },
    },
    {
      from: "Alice",
      payload: { network: { srcip: "Alice", dstip: "New York" }, transport: { proto: "ICMP" } },
    },
    {
      from: "Alice",
      payload: { network: { srcip: "Alice", dstip: "Mountain View" }, transport: { proto: "ICMP" } },
    },
  ],
};

describe("every level is winnable by its intended solution", () => {
  it.each(Object.keys(SOLUTIONS))("%s reaches 'won'", (key) => {
    const level = getLevel(key);
    expect(level, `level ${key} missing from levels.json`).toBeDefined();
    const result = runLevel(level!, SOLUTIONS[key]);
    expect(result.won, `${key} did not win (steps=${result.steps}, t=${result.time})`).toBe(true);
  });

  it("covers all 13 shipped levels", () => {
    expect(Object.keys(SOLUTIONS).length).toBe(13);
  });

  it("does NOT win on an empty solution (guards against a vacuous pass)", () => {
    // level02 needs a specific packet; with no launcher, its timeline alone must not win it.
    const level = getLevel("level02")!;
    expect(runLevel(level, []).won).toBe(false);
  });
});

describe("flood meter arithmetic matches the origin exactly", () => {
  const trigger = { type: "flood" as const, device: "G" };
  const floodDev = (capacity: number): DeviceRuntime => ({ id: "G", ports: [], capacity });
  const arrive = (dev: DeviceRuntime, now: number) =>
    satisfiesTrigger({ dst: "G" }, trigger, dev, now, false);
  const decay = (dev: DeviceRuntime, now: number) =>
    satisfiesTrigger({ dst: "G" }, trigger, dev, now, true);

  it("fills by 1 per arrival closer than 120/capacity, caps at 30", () => {
    const dev = floodDev(1); // threshold 120ms
    arrive(dev, 3000); // first arrival: delta 3000 > 120 -> drains, clamps to 0
    expect(dev.floodCounter).toBe(0);
    for (let k = 1; k <= 30; k++) {
      const won = arrive(dev, 3000 + 100 * k); // 100ms apart, < 120 -> +1
      expect(dev.floodCounter).toBe(k);
      expect(won).toBe(k === 30);
    }
    arrive(dev, 3000 + 100 * 31); // already at cap
    expect(dev.floodCounter).toBe(30);
  });

  it("drains by floor(delta / threshold) when arrivals are too slow", () => {
    const dev = floodDev(1);
    dev.floodCounter = 20;
    dev.floodLast = 1000;
    arrive(dev, 1000 + 360); // delta 360, floor(360/120) = 3 -> 17
    expect(dev.floodCounter).toBe(17);
  });

  it("treats delta exactly at the threshold as a drain, not a fill", () => {
    const dev = floodDev(1);
    dev.floodCounter = 5;
    dev.floodLast = 0;
    arrive(dev, 120); // delta 120 is NOT < 120 -> drain floor(120/120)=1 -> 4
    expect(dev.floodCounter).toBe(4);
  });

  it("scales the threshold with capacity (2 -> 60ms, 3 -> 40ms)", () => {
    const cap2 = floodDev(2);
    cap2.floodCounter = 0;
    cap2.floodLast = 0;
    arrive(cap2, 50); // 50 < 60 -> fill
    expect(cap2.floodCounter).toBe(1);

    const cap3 = floodDev(3);
    cap3.floodCounter = 0;
    cap3.floodLast = 0;
    arrive(cap3, 40); // 40 is NOT < 40 -> no fill
    expect(cap3.floodCounter).toBe(0);
  });

  it("decays by 1 only after a >200ms idle gap (the update path)", () => {
    const dev = floodDev(1);
    dev.floodCounter = 5;
    dev.floodLast = 1000;
    decay(dev, 1150); // delta 150, not > 200 -> no change
    expect(dev.floodCounter).toBe(5);
    decay(dev, 1250); // delta 250 > 200 -> -1
    expect(dev.floodCounter).toBe(4);
  });
});

describe("switch learning powers the Spoofs 2 steal", () => {
  it("floods an unknown dst, learns src->port, then reflects to the learned port", () => {
    const dev: DeviceRuntime = {
      id: "Hub",
      ports: ["Alice", "Bob", "Charlie", "Google"],
      rules: [],
    };
    const sends: { port: number; dstip?: string }[] = [];
    const api: ScriptApi = {
      sendPacket: (_from, port, pkt) => sends.push({ port, dstip: pkt.network?.dstip }),
      getPortRecipient: () => null,
    };
    const sw = DEVICE_SCRIPTS.switch;

    // A packet spoofing Charlie as the source, arriving on Alice's port (0), to unknown dst Bob.
    sw(dev as unknown as ScriptDevice, { network: { srcip: "Charlie", dstip: "Bob" } }, 0, api);
    // Bob is unknown -> flood to every port except the incoming one (0).
    expect(sends.map((s) => s.port)).toEqual([1, 2, 3]);
    // ...and it learned that Charlie lives on port 0.
    expect(dev.rules).toContainEqual({ dstip: "Charlie", portNum: 0 });

    // Now a packet to Charlie: the switch sends it ONLY to the learned port 0 (back to Alice = steal).
    sends.length = 0;
    sw(dev as unknown as ScriptDevice, { network: { srcip: "Google", dstip: "Charlie" } }, 0, api);
    expect(sends).toEqual([{ port: 0, dstip: "Charlie" }]);
  });
});
