import { prisma } from "./prisma";
import { getConfiguredClientIpPools } from "./env";
import {
  normalizeIpKey,
  stripCidr,
  toAllowedAddress,
  type ClientIpPools,
} from "./ip";
import { getMikrotikConnection } from "./mikrotik-settings";
import { listWireguardPeers } from "./mikrotik";

function collectUsedIpKeys(allowedAddress: string): string[] {
  return allowedAddress
    .split(",")
    .map((part) => normalizeIpKey(part.trim()))
    .filter(Boolean);
}

async function loadUsedIpKeys(): Promise<Set<string>> {
  const usedIps = new Set<string>();

  const dbConfigs = await prisma.config.findMany({
    select: { allowedAddress: true },
  });
  for (const config of dbConfigs) {
    for (const ip of collectUsedIpKeys(config.allowedAddress)) {
      usedIps.add(ip);
    }
  }

  try {
    const mikrotik = await getMikrotikConnection();
    const peers = await listWireguardPeers(mikrotik);
    for (const peer of peers) {
      for (const ip of collectUsedIpKeys(peer.allowedAddress)) {
        usedIps.add(ip);
      }
    }
  } catch {
    // If MikroTik is unreachable during allocation, fall back to DB-only tracking.
  }

  return usedIps;
}

function pickAvailable(pool: string[], used: Set<string>): string | undefined {
  for (const ip of pool) {
    if (!used.has(normalizeIpKey(ip))) {
      return ip;
    }
  }
  return undefined;
}

function allocateFromPools(
  pools: ClientIpPools,
  used: Set<string>,
): string {
  const parts: string[] = [];

  if (pools.v4.length > 0) {
    const v4 = pickAvailable(pools.v4, used);
    if (!v4) {
      throw new Error("No available IPv4 addresses in the configured pool");
    }
    parts.push(toAllowedAddress(v4));
  }

  if (pools.v6.length > 0) {
    const v6 = pickAvailable(pools.v6, used);
    if (!v6) {
      throw new Error("No available IPv6 addresses in the configured pool");
    }
    parts.push(toAllowedAddress(v6));
  }

  if (parts.length === 0) {
    throw new Error("WG_CLIENT_IP_POOL has no assignable addresses");
  }

  return parts.join(",");
}

export async function allocateClientIp(): Promise<string> {
  const pools = getConfiguredClientIpPools();
  const used = await loadUsedIpKeys();
  return allocateFromPools(pools, used);
}

export async function releaseClientIp(_address: string): Promise<void> {
  // IPs are freed implicitly when the config row is deleted.
}

export { stripCidr, toAllowedAddress };
