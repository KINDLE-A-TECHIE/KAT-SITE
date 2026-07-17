"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { isPlayerDevice } from "@/lib/network-lab/levels";
import type { Level, Packet, PlayerPacket } from "@/lib/network-lab/types";

/**
 * Build and launch a packet, the origin's editor panel, rebuilt as a controlled form. The "from"
 * dropdown lists only player-controllable devices. Empty fields are omitted from the payload (as the
 * origin did), so a student sends exactly the headers they filled in. `repeat` drives flood levels.
 */

const field =
  "w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kat-clay)] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100";
const legend = "font-mono text-[0.65rem] uppercase tracking-[0.14em] text-stone-500";

export function PacketEditor({
  level,
  disabled,
  onLaunch,
}: {
  level: Level;
  disabled: boolean;
  onLaunch: (pkt: PlayerPacket) => void;
}) {
  const players = level.devices.filter(isPlayerDevice).map((d) => d.id);
  const [from, setFrom] = useState(players[0] ?? "");
  const [srcip, setSrcip] = useState("");
  const [dstip, setDstip] = useState("");
  const [proto, setProto] = useState("");
  const [ttl, setTtl] = useState("");
  const [type, setType] = useState("");
  const [key, setKey] = useState("");
  const [repeat, setRepeat] = useState("1");

  const buildPacket = (): PlayerPacket => {
    const payload: Packet = {};
    const network: { srcip?: string; dstip?: string } = {};
    if (srcip.trim()) network.srcip = srcip.trim();
    if (dstip.trim()) network.dstip = dstip.trim();
    if (Object.keys(network).length > 0) payload.network = network;

    const transport: { proto?: string; ttl?: number } = {};
    if (proto.trim()) transport.proto = proto.trim();
    const ttlNum = Number(ttl.trim());
    if (ttl.trim() && !Number.isNaN(ttlNum)) transport.ttl = ttlNum;
    if (Object.keys(transport).length > 0) payload.transport = transport;

    const application: { type?: string; key?: string } = {};
    if (type.trim()) application.type = type.trim();
    if (key.trim()) application.key = key.trim();
    if (Object.keys(application).length > 0) payload.application = application;

    const times = Math.max(1, Math.floor(Number(repeat) || 1));
    return { from, payload, repeat: times > 1 ? times : undefined };
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (from) onLaunch(buildPacket());
      }}
      className="space-y-3"
    >
      <div>
        <label className={legend} htmlFor="nl-from">
          Sent from
        </label>
        <select id="nl-from" value={from} onChange={(e) => setFrom(e.target.value)} className={field}>
          {players.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-1.5">
        <legend className={legend}>network</legend>
        <input className={field} placeholder="srcip" value={srcip} onChange={(e) => setSrcip(e.target.value)} />
        <input className={field} placeholder="dstip" value={dstip} onChange={(e) => setDstip(e.target.value)} />
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className={legend}>transport</legend>
        <input className={field} placeholder="proto" value={proto} onChange={(e) => setProto(e.target.value)} />
        <input className={field} placeholder="ttl" inputMode="numeric" value={ttl} onChange={(e) => setTtl(e.target.value)} />
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className={legend}>application</legend>
        <input className={field} placeholder="type" value={type} onChange={(e) => setType(e.target.value)} />
        <input className={field} placeholder="key" value={key} onChange={(e) => setKey(e.target.value)} />
      </fieldset>

      <div className="flex items-end gap-2">
        <div className="w-20">
          <label className={legend} htmlFor="nl-repeat">
            repeat
          </label>
          <input
            id="nl-repeat"
            className={field}
            inputMode="numeric"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !from}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--kat-clay)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--kat-clay-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kat-clay)] focus-visible:ring-offset-1 disabled:opacity-50"
        >
          <Send className="size-4" aria-hidden="true" />
          Launch
        </button>
      </div>
    </form>
  );
}
