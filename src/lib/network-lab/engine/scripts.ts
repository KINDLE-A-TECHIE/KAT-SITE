import type { DeviceScriptName, Packet } from "../types";
import {
  copyPacket,
  jsonClone,
  type FirewallRule,
  type NatTable,
  type RouteRule,
} from "./packet";

/**
 * The nine device behaviours, ported verbatim from the origin `js/devicescripts.js`.
 *
 * Each is a pure function of (device, packet, portNum, api). The ONLY side-effect channel is
 * `api.sendPacket`; `api.getPortRecipient` is a pure query (broadcast needs it). Scripts never touch
 * `getRemotePort` or any animation state, exactly as the origin guarded. Device working state
 * (learned switch tables, the modem NAT table) lives on `device.rules`, mutated in place as the
 * origin did.
 */

/** A device as a script sees it: its id, its wired neighbours by port, and its mutable rules. */
export type ScriptDevice = {
  id: string;
  ports: (string | null)[];
  rules?: unknown;
};

export type ScriptApi = {
  sendPacket: (fromId: string, portNum: number, packet: Packet) => void;
  getPortRecipient: (fromId: string, portNum: number) => string | null;
};

export type DeviceScript = (
  device: ScriptDevice,
  packet: Packet,
  portNum: number,
  api: ScriptApi,
) => void;

const manualRouter: DeviceScript = (device, packet, portNum, api) => {
  const newpkt = jsonClone(packet);

  if (packet.transport?.proto === "ICMP" && packet.transport.ttl !== undefined) {
    if (packet.transport.ttl > 0) {
      newpkt.transport!.ttl!--;
    } else {
      newpkt.network = newpkt.network ?? {};
      newpkt.network.srcip = device.id;
      newpkt.network.dstip = packet.network?.srcip;
      newpkt.transport!.proto = "ICMP_ERROR";
      api.sendPacket(device.id, portNum, newpkt);
      return;
    }
  }

  if (packet.network?.dstip === device.id && packet.transport?.proto === "ICMP") {
    newpkt.network!.srcip = device.id;
    newpkt.network!.dstip = packet.network.srcip;
    api.sendPacket(device.id, portNum, newpkt);
    return;
  }

  const rules = (device.rules as RouteRule[] | undefined) ?? [];
  for (const rule of rules) {
    if (rule.dstip === packet.network?.dstip) {
      api.sendPacket(device.id, rule.portNum, newpkt);
    }
  }
};

// The proxy device for the censorship level: hardcoded ids, exactly as the origin.
const proxy: DeviceScript = (device, packet, portNum, api) => {
  const newpkt = jsonClone(packet);
  if (packet.network?.dstip === "Proxy") {
    newpkt.network = newpkt.network ?? {};
    newpkt.network.dstip = "Blocked Site";
  }
  api.sendPacket(device.id, portNum === 0 ? 1 : 0, newpkt);
};

const ping: DeviceScript = (device, packet, _portNum, api) => {
  if (packet.transport?.proto !== undefined) {
    const proto = packet.transport.proto.trim().toLowerCase();
    if (proto === "icmp" || proto === "example") {
      api.sendPacket(device.id, 0, {
        network: { srcip: packet.network?.dstip, dstip: packet.network?.srcip },
        transport: { proto: packet.transport.proto },
      });
    }
  }
};

// NAT. `rules` is a table keyed by proto (the origin's known TODO); it is initialised lazily.
const modem: DeviceScript = (device, packet, portNum, api) => {
  if (!Object.prototype.hasOwnProperty.call(device, "rules")) device.rules = {};
  const rules = device.rules as NatTable;
  const newpkt = jsonClone(packet);

  if (packet.network?.dstip === device.id) {
    const proto = packet.transport?.proto;
    if (proto !== undefined && Object.prototype.hasOwnProperty.call(rules, proto)) {
      newpkt.network = newpkt.network ?? {};
      newpkt.network.dstip = rules[proto].dstip;
      api.sendPacket(device.id, rules[proto].portNum, newpkt);
    }
  } else {
    if (packet.transport?.proto !== undefined) {
      rules[packet.transport.proto] = { portNum, dstip: packet.network?.srcip ?? "" };
    }
    newpkt.network = newpkt.network ?? {};
    newpkt.network.srcip = device.id;
    api.sendPacket(device.id, 0, newpkt);
  }
};

// Learns src->port over time; floods when the dst is unknown. The learning order is what powers
// the Spoofs 2 steal, so it is ported exactly: forward first, then learn from this packet.
const switchScript: DeviceScript = (device, packet, portNum, api) => {
  const rules = device.rules as RouteRule[];

  let found = false;
  for (let i = 0; i < rules.length && !found; i++) {
    if (rules[i].dstip === packet.network?.dstip) {
      api.sendPacket(device.id, rules[i].portNum, packet);
      found = true;
    }
  }
  if (!found) {
    for (let i = 0; i < device.ports.length; i++) {
      if (i !== portNum) api.sendPacket(device.id, i, packet);
    }
  }

  found = false;
  for (let i = 0; i < rules.length && !found; i++) {
    if (rules[i].dstip === packet.network?.srcip) {
      rules[i].portNum = portNum;
      found = true;
    }
  }
  if (!found) {
    rules[rules.length] = { dstip: packet.network?.srcip ?? "", portNum };
  }
};

const firewall: DeviceScript = (device, packet, _portNum, api) => {
  const rules = device.rules as FirewallRule[];
  if (rules.find((rule) => rule.srcip === packet.network?.srcip) === undefined) {
    api.sendPacket(device.id, 0, packet);
  }
};

const broadcast: DeviceScript = (device, packet, portNum, api) => {
  const rules = device.rules as RouteRule[];
  const rule = rules.find((r) => r.dstip === packet.network?.dstip);
  if (rule !== undefined) {
    api.sendPacket(device.id, rule.portNum, packet);
  } else if (packet.network?.dstip === "Broadcast") {
    for (let i = 0; i < device.ports.length; i++) {
      if (i !== portNum && api.getPortRecipient(device.id, i) !== "Google") {
        const newPacket = copyPacket(packet);
        newPacket.network = newPacket.network ?? {};
        newPacket.network.dstip = api.getPortRecipient(device.id, i) ?? undefined;
        api.sendPacket(device.id, i, newPacket);
      }
    }
  }
};

// Key-exchange model Eve subverts. Note the hardcoded real key "123456".
const encryption: DeviceScript = (device, packet, portNum, api) => {
  if (packet.transport?.proto === "encryption" && packet.application?.type !== undefined) {
    const type = packet.application.type;
    if (type === "keyrequest") {
      api.sendPacket(device.id, portNum, {
        network: { srcip: packet.network?.dstip, dstip: packet.network?.srcip },
        transport: { proto: "encryption" },
        application: { type: "keyresponse", key: "123456" },
      });
    } else if (type === "keyresponse") {
      api.sendPacket(device.id, portNum, {
        network: { srcip: packet.network?.dstip, dstip: packet.network?.srcip },
        transport: { proto: "encryption" },
        application: { type: "message", key: packet.application.key },
      });
    }
  }
};

// Eve's router: port 0 is the tap. Traffic from the tap is delivered; everything else is mirrored
// to the tap. This is the man-in-the-middle in Attacks 1.
const tappedRouter: DeviceScript = (device, packet, portNum, api) => {
  const rules = device.rules as RouteRule[];
  for (const rule of rules) {
    if (rule.dstip === packet.network?.dstip) {
      if (portNum === 0) api.sendPacket(device.id, rule.portNum, packet);
      else api.sendPacket(device.id, 0, packet);
    }
  }
};

export const DEVICE_SCRIPTS: Record<DeviceScriptName, DeviceScript> = {
  ping,
  manualRouter,
  modem,
  switch: switchScript,
  firewall,
  broadcast,
  encryption,
  tappedRouter,
  proxy,
  // Phase 4 will implement these; declared so the map is total over DeviceScriptName.
  dnsServer: () => {},
  webServer: () => {},
};
