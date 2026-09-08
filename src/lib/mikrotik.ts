import { Agent } from "undici";
import type { MikrotikConnection } from "./mikrotik-settings";
import { formatAllowedAddresses, parseAddressList, stripCidr, toAllowedAddress, isUsableWireGuardAddress } from "./ip";

export class MikrotikError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "MikrotikError";
  }

  userMessage(): string {
    if (!this.body) {
      return this.message;
    }

    try {
      const parsed = JSON.parse(this.body) as {
        message?: string;
        detail?: string;
      };
      const parts = [this.message, parsed.message, parsed.detail].filter(Boolean);
      return parts.join(": ");
    } catch {
      return `${this.message}: ${this.body}`;
    }
  }
}

interface MikrotikPeer {
  ".id": string;
  interface?: string;
  "public-key"?: string;
  "allowed-address"?: string;
  comment?: string;
}

export interface MikrotikPeerRecord {
  id: string;
  publicKey: string;
  allowedAddress: string;
  comment?: string;
  interface?: string;
}

function mapPeer(peer: MikrotikPeer): MikrotikPeerRecord | null {
  const publicKey = peer["public-key"]?.trim();
  if (!publicKey) {
    return null;
  }

  const allowedRaw = peer["allowed-address"]?.trim() ?? "";
  const allowedAddress = allowedRaw
    ? formatAllowedAddresses(parseAddressList(allowedRaw))
    : "0.0.0.0/32";

  return {
    id: peer[".id"],
    publicKey,
    allowedAddress,
    comment: peer.comment,
    interface: peer.interface,
  };
}

export interface MikrotikTestResult {
  ok: true;
  version?: string;
  boardName?: string;
  platform?: string;
}

function getBaseUrl(config: MikrotikConnection): string {
  const protocol = config.useHttps ? "https" : "http";
  return `${protocol}://${config.host}:${config.port}/rest`;
}

function getAuthHeader(config: MikrotikConnection): string {
  const token = Buffer.from(`${config.username}:${config.password}`).toString(
    "base64",
  );
  return `Basic ${token}`;
}

const insecureDispatchers = new Map<boolean, Agent>();

function getFetchInit(
  config: MikrotikConnection,
  init: RequestInit = {},
): RequestInit {
  if (config.tlsVerify) {
    return init;
  }

  let dispatcher = insecureDispatchers.get(true);
  if (!dispatcher) {
    dispatcher = new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });
    insecureDispatchers.set(true, dispatcher);
  }

  return {
    ...init,
    // @ts-expect-error undici dispatcher extension used by Node fetch
    dispatcher,
  };
}

async function mikrotikFetch(
  config: MikrotikConnection,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${getBaseUrl(config)}${path}`;

  return fetch(
    url,
    getFetchInit(config, {
      ...init,
      headers: {
        Authorization: getAuthHeader(config),
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    }),
  );
}

export async function testMikrotikConnection(
  config: MikrotikConnection,
): Promise<MikrotikTestResult> {
  const response = await mikrotikFetch(config, "/system/resource");

  if (!response.ok) {
    const body = await response.text();
    throw new MikrotikError(
      `Connection failed (${response.status})`,
      response.status,
      body,
    );
  }

  const resource = (await response.json()) as {
    version?: string;
    "board-name"?: string;
    platform?: string;
  };

  return {
    ok: true,
    version: resource.version,
    boardName: resource["board-name"],
    platform: resource.platform,
  };
}

export async function createWireguardPeer(
  config: MikrotikConnection,
  input: {
    publicKey: string;
    allowedAddress: string;
    comment: string;
  },
): Promise<string> {
  const comment =
    input.comment.length > 64 ? input.comment.slice(0, 64) : input.comment;

  const payload = JSON.stringify({
    interface: config.wgInterface,
    "public-key": input.publicKey,
    "allowed-address": input.allowedAddress,
    comment,
  });

  let response = await mikrotikFetch(config, "/interface/wireguard/peers", {
    method: "PUT",
    body: payload,
  });

  if (response.status === 405 || response.status === 406) {
    response = await mikrotikFetch(config, "/interface/wireguard/peers", {
      method: "POST",
      body: payload,
    });
  }

  const text = await response.text();
  if (!response.ok) {
    throw new MikrotikError(
      `Failed to create WireGuard peer (${response.status})`,
      response.status,
      text,
    );
  }

  let peerId: string | undefined;
  try {
    const data = JSON.parse(text) as MikrotikPeer | MikrotikPeer[];
    const peer = Array.isArray(data) ? data[0] : data;
    peerId = peer?.[".id"];
  } catch {
    // RouterOS may return empty body on success.
  }

  if (!peerId) {
    peerId = await findPeerIdByPublicKey(config, input.publicKey);
  }

  if (!peerId) {
    throw new MikrotikError("Peer created but ID was not returned", 500, text);
  }

  return peerId;
}

export async function deleteWireguardPeer(
  config: MikrotikConnection,
  peerId: string,
): Promise<void> {
  const response = await mikrotikFetch(
    config,
    `/interface/wireguard/peers/${encodeURIComponent(peerId)}`,
    { method: "DELETE" },
  );

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new MikrotikError(
      `Failed to delete WireGuard peer (${response.status})`,
      response.status,
      text,
    );
  }
}

async function findPeerIdByPublicKey(
  config: MikrotikConnection,
  publicKey: string,
): Promise<string | undefined> {
  const query = new URLSearchParams({
    interface: config.wgInterface,
    "public-key": publicKey,
  });
  const response = await mikrotikFetch(
    config,
    `/interface/wireguard/peers?${query}`,
  );

  if (!response.ok) {
    return undefined;
  }

  const peers = (await response.json()) as MikrotikPeer[];
  return peers[0]?.[".id"];
}

export async function listWireguardPeers(
  config: MikrotikConnection,
): Promise<MikrotikPeerRecord[]> {
  const query = new URLSearchParams({
    interface: config.wgInterface,
  });
  const response = await mikrotikFetch(
    config,
    `/interface/wireguard/peers?${query.toString()}`,
  );

  if (!response.ok) {
    const body = await response.text();
    throw new MikrotikError(
      `Failed to list WireGuard peers (${response.status})`,
      response.status,
      body,
    );
  }

  const peers = (await response.json()) as MikrotikPeer[];
  return peers
    .map(mapPeer)
    .filter((peer): peer is MikrotikPeerRecord => peer !== null)
    .filter(
      (peer) =>
        !peer.interface || peer.interface === config.wgInterface,
    );
}

interface MikrotikWireguardInterface {
  ".id": string;
  name?: string;
  "public-key"?: string;
  "listen-port"?: string | number;
}

interface MikrotikIpAddress {
  address?: string;
  network?: string;
  interface?: string;
}

export interface WireGuardServerFetchResult {
  publicKey: string;
  listenPort: number;
  endpoint: string;
  serverAddress: string;
  clientIpPool: string;
}

function poolFromAddressEntry(entry: MikrotikIpAddress): string | null {
  const address = entry.address?.trim();
  if (!address || !address.includes("/")) {
    return null;
  }

  if (!isUsableWireGuardAddress(address)) {
    return null;
  }

  const slashIndex = address.lastIndexOf("/");
  const prefix = address.slice(slashIndex + 1);
  const network = entry.network?.trim();
  if (network && isUsableWireGuardAddress(`${network}/${prefix}`)) {
    return `${network}/${prefix}`;
  }

  return isUsableWireGuardAddress(address) ? address : null;
}

function serverAddressFromEntry(entry: MikrotikIpAddress): string | null {
  const address = entry.address?.trim();
  if (!address || !isUsableWireGuardAddress(address)) {
    return null;
  }

  const host = stripCidr(address);
  if (!host) {
    return null;
  }

  return toAllowedAddress(host);
}

async function listInterfaceAddresses(
  config: MikrotikConnection,
  iface: string,
): Promise<MikrotikIpAddress[]> {
  const query = new URLSearchParams({ interface: iface });
  const rows: MikrotikIpAddress[] = [];

  const ipResponse = await mikrotikFetch(
    config,
    `/ip/address?${query.toString()}`,
  );
  if (!ipResponse.ok) {
    const body = await ipResponse.text();
    throw new MikrotikError(
      `Failed to read interface addresses (${ipResponse.status})`,
      ipResponse.status,
      body,
    );
  }

  rows.push(...((await ipResponse.json()) as MikrotikIpAddress[]));

  const ipv6Response = await mikrotikFetch(
    config,
    `/ipv6/address?${query.toString()}`,
  );
  if (ipv6Response.ok) {
    rows.push(...((await ipv6Response.json()) as MikrotikIpAddress[]));
  } else if (ipv6Response.status !== 404 && ipv6Response.status !== 400) {
    const body = await ipv6Response.text();
    throw new MikrotikError(
      `Failed to read IPv6 interface addresses (${ipv6Response.status})`,
      ipv6Response.status,
      body,
    );
  }

  return rows;
}

export async function fetchWireGuardServerInfo(
  config: MikrotikConnection,
  endpointHost?: string,
): Promise<WireGuardServerFetchResult> {
  const wgQuery = new URLSearchParams({ name: config.wgInterface });
  const wgResponse = await mikrotikFetch(
    config,
    `/interface/wireguard?${wgQuery.toString()}`,
  );

  if (!wgResponse.ok) {
    const body = await wgResponse.text();
    throw new MikrotikError(
      `Failed to read WireGuard interface (${wgResponse.status})`,
      wgResponse.status,
      body,
    );
  }

  const wgRows = (await wgResponse.json()) as MikrotikWireguardInterface[];
  const wg = wgRows.find((row) => row.name === config.wgInterface) ?? wgRows[0];
  const publicKey = wg?.["public-key"]?.trim();
  const listenPort = Number(wg?.["listen-port"] ?? 51820);

  if (!publicKey) {
    throw new MikrotikError(
      `WireGuard interface "${config.wgInterface}" has no public key`,
      404,
    );
  }

  const addrRows = await listInterfaceAddresses(config, config.wgInterface);
  const serverAddresses = addrRows
    .map(serverAddressFromEntry)
    .filter((value): value is string => Boolean(value));
  const clientPools = addrRows
    .map(poolFromAddressEntry)
    .filter((value): value is string => Boolean(value));

  if (serverAddresses.length === 0) {
    throw new MikrotikError(
      `No usable addresses found for interface "${config.wgInterface}" on /ip/address or /ipv6/address (link-local addresses are ignored)`,
      404,
    );
  }

  if (clientPools.length === 0) {
    throw new MikrotikError(
      `No usable client IP pools found on interface "${config.wgInterface}" (link-local IPv6 fe80::/10 and similar are ignored)`,
      404,
    );
  }

  const host = endpointHost?.trim() || config.host;
  const endpoint = `${host}:${Number.isNaN(listenPort) ? 51820 : listenPort}`;

  return {
    publicKey,
    listenPort: Number.isNaN(listenPort) ? 51820 : listenPort,
    endpoint,
    serverAddress: [...new Set(serverAddresses)].join(","),
    clientIpPool: [...new Set(clientPools)].join(","),
  };
}
