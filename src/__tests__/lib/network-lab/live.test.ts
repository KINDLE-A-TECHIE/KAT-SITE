import { describe, it, expect } from "vitest";
import type { PlayerPacket } from "@/lib/network-lab/types";
import { getLevel } from "@/lib/network-lab/levels";
import { LabSimulation } from "@/lib/network-lab/engine";

/**
 * The live controller drives the SAME shared state as the batch runner, but on an animation clock.
 * This proves the two agree: a level winnable in the headless test is winnable when stepped like the
 * UI steps it (advance a sim clock, launch, let packets travel their 3s). If these ever diverge, a
 * level that passes CI would be unwinnable in the browser.
 */

/** Step the sim clock forward in small increments until it wins or a time budget is exhausted. */
function playToWin(sim: LabSimulation, launchers: PlayerPacket[], budgetMs = 30_000): boolean {
  for (const pkt of launchers) sim.launch(pkt);
  for (let t = 0; t <= budgetMs && !sim.won; t += 50) sim.step(t);
  return sim.won;
}

describe("live simulation reaches 'won' like the batch engine", () => {
  it("solves a simple delivery (level01)", () => {
    const sim = new LabSimulation(getLevel("level01")!);
    expect(
      playToWin(sim, [{ from: "Carol", payload: { network: { srcip: "Carol", dstip: "Doug" } } }]),
    ).toBe(true);
  });

  it("solves a multi-hop NAT round-trip (level05)", () => {
    const sim = new LabSimulation(getLevel("level05")!);
    expect(
      playToWin(sim, [
        {
          from: "Alice",
          payload: { network: { srcip: "Alice", dstip: "Google" }, transport: { proto: "ICMP" } },
        },
      ]),
    ).toBe(true);
  });

  it("fills a flood target over time (dos01)", () => {
    const sim = new LabSimulation(getLevel("dos01")!);
    expect(
      playToWin(sim, [
        { from: "Alice", payload: { network: { srcip: "Alice", dstip: "Google" } }, repeat: 45 },
      ]),
    ).toBe(true);
  });

  it("does not win before anything is launched", () => {
    const sim = new LabSimulation(getLevel("level01")!);
    for (let t = 0; t <= 10_000; t += 50) sim.step(t);
    expect(sim.won).toBe(false);
  });
});
