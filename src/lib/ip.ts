const MAX_IPV6_EXPAND = 1022;

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function isIPv4(host: string): boolean {
  return IPV4_RE.test(host);
}

function isIPv6(host: string): boolean {
  if (!host.includes(":")) {
    return false;
  }

  try {
    expandIpv6Address(host);
    return true;
  } catch {
    return false;
  }
}

export type IpVersion = "v4" | "v6";

export interface ClientIpPools {
  v4: string[];
  v6: string[];
}

export function stripCidr(address: string): string {
  if (address.includes(",")) {
    return parseAddressList(address).map(stripCidrSingle).join(",");
  }
  return stripCidrSingle(address);
}

function stripCidrSingle(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) {
    return trimmed;
  }

  const slashIndex = trimmed.lastIndexOf("/");
  if (slashIndex === -1) {
    return trimmed;
  }

  const host = trimmed.slice(0, slashIndex);
  if (isIPv6(host) || isIPv4(host)) {
    return host;
  }

  return host;
}

export function detectIpVersion(address: string): IpVersion | null {
  const host = stripCidr(address);
  if (isIPv4(host)) {
    return "v4";
  }
  if (isIPv6(host)) {
    return "v6";
  }
  return null;
}

export function normalizeIpKey(address: string): string {
  const host = stripCidr(address);
  if (isIPv6(host)) {
    return bigintToIpv6(ipv6ToBigInt(host));
  }
  return host;
}

export function toAllowedAddress(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.includes("/")) {
    return trimmed;
  }

  const version = detectIpVersion(trimmed);
  if (version === "v6") {
    return `${trimmed}/128`;
  }
  return `${trimmed}/32`;
}

export function formatAllowedAddresses(parts: string[]): string {
  return parts
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => toAllowedAddress(stripCidr(part)))
    .join(",");
}

export function parseAddressList(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitCidr(cidr: string): [network: string, prefix: string] {
  const index = cidr.lastIndexOf("/");
  if (index === -1) {
    return [cidr, ""];
  }
  return [cidr.slice(0, index), cidr.slice(index + 1)];
}

export function getClientIpPools(rawPool: string): ClientIpPools {
  const parts = rawPool
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const v4: string[] = [];
  const v6: string[] = [];

  for (const part of parts) {
    if (part.includes("/")) {
      const [network] = splitCidr(part);
      const version = detectIpVersion(network);
      if (version === "v6") {
        v6.push(...expandIpv6Cidr(part));
      } else if (version === "v4") {
        v4.push(...expandIpv4Cidr(part));
      } else {
        throw new Error(`Invalid CIDR in WG_CLIENT_IP_POOL: ${part}`);
      }
      continue;
    }

    const version = detectIpVersion(part);
    if (version === "v6") {
      v6.push(normalizeIpKey(part));
    } else if (version === "v4") {
      v4.push(part);
    } else {
      throw new Error(`Invalid IP in WG_CLIENT_IP_POOL: ${part}`);
    }
  }

  return {
    v4: [...new Set(v4)],
    v6: [...new Set(v6)],
  };
}

/** @deprecated Use getClientIpPools for dual-stack support */
export function getClientIpPool(rawPool: string): string[] {
  const pools = getClientIpPools(rawPool);
  return [...pools.v4, ...pools.v6];
}

function expandIpv4Cidr(cidr: string): string[] {
  const [network, prefixStr] = splitCidr(cidr);
  const prefix = Number(prefixStr);
  if (!network || Number.isNaN(prefix) || prefix < 8 || prefix > 30) {
    throw new Error(`Invalid IPv4 CIDR in WG_CLIENT_IP_POOL: ${cidr}`);
  }

  const octets = network.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
    throw new Error(`Invalid IPv4 network in WG_CLIENT_IP_POOL: ${cidr}`);
  }

  const hostBits = 32 - prefix;
  const totalHosts = 2 ** hostBits;
  const base =
    ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
  const mask = prefix === 0 ? 0 : (~0 << hostBits) >>> 0;
  const networkAddr = (base & mask) >>> 0;

  const result: string[] = [];
  for (let i = 2; i < totalHosts - 1; i++) {
    const ip = (networkAddr + i) >>> 0;
    result.push(
      `${(ip >>> 24) & 255}.${(ip >>> 16) & 255}.${(ip >>> 8) & 255}.${ip & 255}`,
    );
  }

  return result;
}

function expandIpv6Cidr(cidr: string): string[] {
  const [networkPart, prefixStr] = splitCidr(cidr);
  const prefix = Number(prefixStr);
  if (!networkPart || Number.isNaN(prefix) || prefix < 48 || prefix > 128) {
    throw new Error(
      `Invalid IPv6 CIDR in WG_CLIENT_IP_POOL (use /48–/128): ${cidr}`,
    );
  }

  if (!isIPv6(stripCidr(networkPart))) {
    throw new Error(`Invalid IPv6 network in WG_CLIENT_IP_POOL: ${cidr}`);
  }

  const network = ipv6ToBigInt(networkPart) & ipv6Mask(prefix);
  const hostBits = 128 - prefix;

  const result: string[] = [];

  if (hostBits > 16) {
    // Large subnets (/64 etc.): assign sequential host IDs starting at ::2
    for (let i = 2; i < 2 + MAX_IPV6_EXPAND; i++) {
      result.push(bigintToIpv6(network + BigInt(i)));
    }
    return result;
  }

  const totalHosts = 2 ** hostBits;
  for (let i = 2; i < totalHosts - 1; i++) {
    result.push(bigintToIpv6(network + BigInt(i)));
  }

  return result;
}

function ipv6Mask(prefix: number): bigint {
  if (prefix === 0) {
    return 0n;
  }
  return ((1n << 128n) - 1n) << BigInt(128 - prefix);
}

function expandIpv6Address(ip: string): string[] {
  const addr = (ip.split("%")[0] ?? ip).trim().toLowerCase();
  if (!addr.includes(":")) {
    throw new Error(`Invalid IPv6 address: ${ip}`);
  }

  if (addr.includes("::")) {
    const parts = addr.split("::");
    if (parts.length > 2) {
      throw new Error(`Invalid IPv6 address: ${ip}`);
    }

    const [left, right] = parts;
    const leftParts = left ? left.split(":").filter(Boolean) : [];
    const rightParts = right ? right.split(":").filter(Boolean) : [];
    const missing = 8 - leftParts.length - rightParts.length;

    if (missing < 0) {
      throw new Error(`Invalid IPv6 address: ${ip}`);
    }

    return [
      ...leftParts.map((group) => group.padStart(4, "0")),
      ...Array.from({ length: missing }, () => "0000"),
      ...rightParts.map((group) => group.padStart(4, "0")),
    ];
  }

  const groups = addr.split(":").filter(Boolean);
  if (groups.length === 0 || groups.length > 8) {
    throw new Error(`Invalid IPv6 address: ${ip}`);
  }

  if (!groups.every((group) => /^[\da-f]{1,4}$/i.test(group))) {
    throw new Error(`Invalid IPv6 address: ${ip}`);
  }

  if (groups.length === 8) {
    return groups.map((group) => group.padStart(4, "0"));
  }

  // Abbreviated without :: (e.g. 2002:3c12:e002:3c18:2600) — pad trailing zero groups.
  return [
    ...groups.map((group) => group.padStart(4, "0")),
    ...Array.from({ length: 8 - groups.length }, () => "0000"),
  ];
}

function ipv6ToBigInt(ip: string): bigint {
  const groups = expandIpv6Address(stripCidrSingle(ip));
  let value = 0n;
  for (const group of groups) {
    value = (value << 16n) + BigInt(parseInt(group, 16));
  }
  return value;
}

function bigintToIpv6(value: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    groups.push(((value >> BigInt(i * 16)) & 0xffffn).toString(16));
  }
  return compressIpv6(groups.join(":"));
}

function compressIpv6(expanded: string): string {
  const groups = expanded.split(":");
  let bestStart = -1;
  let bestLen = 0;

  for (let i = 0; i < groups.length; i++) {
    if (groups[i] !== "0") {
      continue;
    }
    let j = i;
    while (j < groups.length && groups[j] === "0") {
      j++;
    }
    const len = j - i;
    if (len > bestLen) {
      bestLen = len;
      bestStart = i;
    }
  }

  if (bestLen < 2) {
    return groups.join(":");
  }

  const head = groups.slice(0, bestStart).join(":");
  const tail = groups.slice(bestStart + bestLen).join(":");

  if (bestStart === 0 && bestStart + bestLen === groups.length) {
    return "::";
  }
  if (bestStart === 0) {
    return `::${tail}`;
  }
  if (bestStart + bestLen === groups.length) {
    return `${head}::`;
  }
  return `${head}::${tail}`;
}

export function isUnspecifiedAddress(address: string): boolean {
  const host = stripCidr(address);
  return host === "0.0.0.0" || normalizeIpKey(host) === "::";
}
