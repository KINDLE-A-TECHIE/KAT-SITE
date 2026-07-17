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
  // Send anything to Tamara (any packet arriving satisfies the trigger).
  level01: [{ from: "Toni", payload: { network: { srcip: "Toni", dstip: "Tamara" } } }],
  // A packet from Chinagorom to Amaka.
  level02: [{ from: "Chinagorom", payload: { network: { srcip: "Chinagorom", dstip: "Amaka" } } }],
  // Ping Search Server; its `ping` script echoes back. Trigger wants 5 replies.
  level03: [
    {
      from: "Chinagorom",
      payload: { network: { srcip: "Chinagorom", dstip: "Search Server" }, transport: { proto: "ICMP" } },
      repeat: 6,
    },
  ],
  // Amaka routes a packet to Toni across the router mesh.
  level04: [{ from: "Amaka", payload: { network: { srcip: "Amaka", dstip: "Toni" } } }],
  // Chinagorom pings Search Server through the home NAT modem; the reply comes back mapped to Chinagorom.
  level05: [
    {
      from: "Chinagorom",
      payload: { network: { srcip: "Chinagorom", dstip: "Search Server" }, transport: { proto: "ICMP" } },
    },
  ],
  // Spoof Toni as the source of a packet to Amaka (both the router and Amaka see it).
  spoofs01: [{ from: "Chinagorom", payload: { network: { srcip: "Toni", dstip: "Amaka" } } }],
  // Poison the switch (teach it Ife is on Chinagorom's port), then reflect Search Server->Ife back.
  spoofs02: [
    { from: "Chinagorom", payload: { network: { srcip: "Ife", dstip: "Amaka" } } },
    { from: "Chinagorom", payload: { network: { srcip: "Search Server", dstip: "Ife" } } },
  ],
  // Flood Search Server (capacity 1).
  dos01: [{ from: "Chinagorom", payload: { network: { srcip: "Chinagorom", dstip: "Search Server" } }, repeat: 45 }],
  // Chinagorom is firewalled; the zombies are not. Flood from the zombies (capacity 3, behind firewall).
  dos02: [
    { from: "Zombie 1", payload: { network: { srcip: "Zombie 1", dstip: "Search Server" } }, repeat: 20 },
    { from: "Zombie 2", payload: { network: { srcip: "Zombie 2", dstip: "Search Server" } }, repeat: 20 },
    { from: "Zombie 3", payload: { network: { srcip: "Zombie 3", dstip: "Search Server" } }, repeat: 20 },
  ],
  // Smurf: a broadcast spoofed as Search Server makes every host reply to Search Server (3x amplification).
  dos03: [
    {
      from: "Chinagorom",
      payload: { network: { srcip: "Search Server", dstip: "Broadcast" }, transport: { proto: "ICMP" } },
      repeat: 45,
    },
  ],
  // MITM: Zainab feeds Chinagorom a fake key (Chinagorom then leaks a message Zainab can read), and delivers the
  // real-key message to Amaka.
  attacks01: [
    {
      from: "Zainab",
      payload: {
        network: { srcip: "Amaka", dstip: "Chinagorom" },
        transport: { proto: "encryption" },
        application: { type: "keyresponse", key: "31337" },
      },
    },
    {
      from: "Zainab",
      payload: {
        network: { srcip: "Chinagorom", dstip: "Amaka" },
        transport: { proto: "encryption" },
        application: { type: "message", key: "123456" },
      },
    },
  ],
  // Censorship evasion: reach the blocked site by sending via the proxy.
  attacks02: [{ from: "Chinagorom", payload: { network: { srcip: "Chinagorom", dstip: "Proxy" } } }],
  // Traceroute: address an ICMP packet to each router along the path.
  attacks03: [
    {
      from: "Chinagorom",
      payload: { network: { srcip: "Chinagorom", dstip: "Waterloo" }, transport: { proto: "ICMP" } },
    },
    {
      from: "Chinagorom",
      payload: { network: { srcip: "Chinagorom", dstip: "Toronto" }, transport: { proto: "ICMP" } },
    },
    {
      from: "Chinagorom",
      payload: { network: { srcip: "Chinagorom", dstip: "New York" }, transport: { proto: "ICMP" } },
    },
    {
      from: "Chinagorom",
      payload: { network: { srcip: "Chinagorom", dstip: "Mountain View" }, transport: { proto: "ICMP" } },
    },
  ],
  // Ask DNS for the address, then connect to it.
  dns01: [
    {
      from: "Chinagorom",
      payload: {
        network: { srcip: "Chinagorom", dstip: "DNS" },
        application: { type: "dns_query", key: "katlearning" },
      },
    },
    { from: "Chinagorom", payload: { network: { srcip: "Chinagorom", dstip: "10.0.0.5" } } },
  ],
  // Send an HTTP request; the web server's response comes back to you.
  http01: [
    {
      from: "Amaka",
      payload: {
        network: { srcip: "Amaka", dstip: "katlearning.ng" },
        application: { type: "http_request" },
      },
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

  it("covers all 15 shipped levels", () => {
    expect(Object.keys(SOLUTIONS).length).toBe(15);
  });

  it.each(Object.keys(SOLUTIONS))("%s is NOT won by an empty solution", (key) => {
    // Every level must REQUIRE player action: its scripted timeline alone (or nothing at all) must
    // not satisfy its triggers. This is the pair to "intended solution wins", together they catch a
    // mis-authored trigger that a timeline packet accidentally completes (the original level01 link
    // bug was exactly this class of mistake).
    expect(runLevel(getLevel(key)!, []).won).toBe(false);
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
      ports: ["Chinagorom", "Amaka", "Ife", "Search Server"],
      rules: [],
    };
    const sends: { port: number; dstip?: string }[] = [];
    const api: ScriptApi = {
      sendPacket: (_from, port, pkt) => sends.push({ port, dstip: pkt.network?.dstip }),
      getPortRecipient: () => null,
    };
    const sw = DEVICE_SCRIPTS.switch;

    // A packet spoofing Ife as the source, arriving on Chinagorom's port (0), to unknown dst Amaka.
    sw(dev as unknown as ScriptDevice, { network: { srcip: "Ife", dstip: "Amaka" } }, 0, api);
    // Amaka is unknown -> flood to every port except the incoming one (0).
    expect(sends.map((s) => s.port)).toEqual([1, 2, 3]);
    // ...and it learned that Ife lives on port 0.
    expect(dev.rules).toContainEqual({ dstip: "Ife", portNum: 0 });

    // Now a packet to Ife: the switch sends it ONLY to the learned port 0 (back to Chinagorom = steal).
    sends.length = 0;
    sw(dev as unknown as ScriptDevice, { network: { srcip: "Search Server", dstip: "Ife" } }, 0, api);
    expect(sends).toEqual([{ port: 0, dstip: "Ife" }]);
  });
});
