import { getClientIpPools } from "./ip";
import { encryptPrivateKey, decryptPrivateKey } from "./crypto";
import { prisma } from "./prisma";

export const MIKROTIK_SETTINGS_ID = "default";

export interface WireGuardServerSettings {
  publicKey: string;
  endpoint: string;
  serverAddress: string;
  clientIpPool: string;
}

export interface MikrotikSettingsView {
  host: string;
  port: number;
  username: string;
  useHttps: boolean;
  tlsVerify: boolean;
  wgInterface: string;
  wgServerPublicKey: string;
  wgServerEndpoint: string;
  wgServerAddress: string;
  wgClientIpPool: string;
  hasPassword: boolean;
  configured: boolean;
  wireGuardConfigured: boolean;
}

export interface MikrotikConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  useHttps: boolean;
  tlsVerify: boolean;
  wgInterface: string;
}

export interface SaveMikrotikSettingsInput {
  host: string;
  port: number;
  username: string;
  password?: string;
  useHttps: boolean;
  tlsVerify: boolean;
  wgInterface: string;
  wgServerPublicKey?: string;
  wgServerEndpoint?: string;
  wgServerAddress?: string;
  wgClientIpPool?: string;
}

type MikrotikSettingsRecord = {
  host: string;
  port: number;
  username: string;
  passwordEncrypted: string;
  useHttps: boolean;
  tlsVerify: boolean;
  wgInterface: string;
  wgServerPublicKey: string;
  wgServerEndpoint: string;
  wgServerAddress: string;
  wgClientIpPool: string;
};

function isConnectionConfigured(record: {
  host: string;
  username: string;
  passwordEncrypted: string;
  wgInterface: string;
}): boolean {
  return Boolean(
    record.host.trim() &&
      record.username.trim() &&
      record.passwordEncrypted &&
      record.wgInterface.trim(),
  );
}

export function isWireGuardConfigured(record: {
  wgServerPublicKey: string;
  wgServerEndpoint: string;
  wgServerAddress: string;
  wgClientIpPool: string;
}): boolean {
  return Boolean(
    record.wgServerPublicKey.trim() &&
      record.wgServerEndpoint.trim() &&
      record.wgServerAddress.trim() &&
      record.wgClientIpPool.trim(),
  );
}

function validateWireGuardSettings(input: {
  wgServerPublicKey: string;
  wgServerEndpoint: string;
  wgServerAddress: string;
  wgClientIpPool: string;
}) {
  const publicKey = input.wgServerPublicKey.trim();
  const endpoint = input.wgServerEndpoint.trim();
  const serverAddress = input.wgServerAddress.trim();
  const clientIpPool = input.wgClientIpPool.trim();

  const anySet = Boolean(publicKey || endpoint || serverAddress || clientIpPool);
  const allSet = Boolean(publicKey && endpoint && serverAddress && clientIpPool);

  if (anySet && !allSet) {
    throw new Error(
      "WireGuard server settings require public key, endpoint, server address, and client IP pool",
    );
  }

  if (allSet) {
    getClientIpPools(clientIpPool);
  }

  return {
    wgServerPublicKey: publicKey,
    wgServerEndpoint: endpoint,
    wgServerAddress: serverAddress,
    wgClientIpPool: clientIpPool,
  };
}

function toView(record: MikrotikSettingsRecord): MikrotikSettingsView {
  const connectionConfigured = isConnectionConfigured(record);
  const wireGuardConfigured = isWireGuardConfigured(record);

  return {
    host: record.host,
    port: record.port,
    username: record.username,
    useHttps: record.useHttps,
    tlsVerify: record.tlsVerify,
    wgInterface: record.wgInterface,
    wgServerPublicKey: record.wgServerPublicKey,
    wgServerEndpoint: record.wgServerEndpoint,
    wgServerAddress: record.wgServerAddress,
    wgClientIpPool: record.wgClientIpPool,
    hasPassword: Boolean(record.passwordEncrypted),
    configured: connectionConfigured && wireGuardConfigured,
    wireGuardConfigured,
  };
}

async function bootstrapFromEnvIfEmpty() {
  let existing = await prisma.mikrotikSettings.findUnique({
    where: { id: MIKROTIK_SETTINGS_ID },
  });

  if (!existing) {
    existing = await prisma.mikrotikSettings.create({
      data: { id: MIKROTIK_SETTINGS_ID },
    });
  }

  if (!isConnectionConfigured(existing)) {
    const host = process.env.MIKROTIK_HOST?.trim();
    const username = process.env.MIKROTIK_USER?.trim();
    const password = process.env.MIKROTIK_PASSWORD;
    const wgInterface = process.env.MIKROTIK_WG_INTERFACE?.trim();

    if (host && username && password && wgInterface) {
      const useHttps = process.env.MIKROTIK_USE_HTTPS !== "false";
      const tlsVerify = process.env.MIKROTIK_TLS_VERIFY === "true";
      const port = Number(process.env.MIKROTIK_PORT ?? 443);

      existing = await prisma.mikrotikSettings.update({
        where: { id: MIKROTIK_SETTINGS_ID },
        data: {
          host,
          port: Number.isNaN(port) ? 443 : port,
          username,
          passwordEncrypted: encryptPrivateKey(password),
          useHttps,
          tlsVerify,
          wgInterface,
        },
      });
    }
  }

  if (!isWireGuardConfigured(existing)) {
    const publicKey = process.env.WG_SERVER_PUBLIC_KEY?.trim();
    const endpoint = process.env.WG_SERVER_ENDPOINT?.trim();
    const serverAddress = process.env.WG_SERVER_ADDRESS?.trim();
    const clientIpPool = process.env.WG_CLIENT_IP_POOL?.trim();

    if (publicKey && endpoint && serverAddress && clientIpPool) {
      existing = await prisma.mikrotikSettings.update({
        where: { id: MIKROTIK_SETTINGS_ID },
        data: {
          wgServerPublicKey: publicKey,
          wgServerEndpoint: endpoint,
          wgServerAddress: serverAddress,
          wgClientIpPool: clientIpPool,
        },
      });
    }
  }

  return existing;
}

export async function getMikrotikSettingsView(): Promise<MikrotikSettingsView> {
  const record = await bootstrapFromEnvIfEmpty();
  return toView(record);
}

export async function getWireGuardSettings(): Promise<WireGuardServerSettings> {
  const record = await bootstrapFromEnvIfEmpty();

  if (!isWireGuardConfigured(record)) {
    throw new Error(
      "WireGuard server settings are not configured. Set them in Admin → MikroTik connection.",
    );
  }

  return {
    publicKey: record.wgServerPublicKey.trim(),
    endpoint: record.wgServerEndpoint.trim(),
    serverAddress: record.wgServerAddress.trim(),
    clientIpPool: record.wgClientIpPool.trim(),
  };
}

export async function saveMikrotikSettings(
  input: SaveMikrotikSettingsInput,
): Promise<MikrotikSettingsView> {
  const host = input.host.trim();
  const username = input.username.trim();
  const wgInterface = input.wgInterface.trim();

  if (!host) throw new Error("Host is required");
  if (!username) throw new Error("Username is required");
  if (!wgInterface) throw new Error("WireGuard interface is required");
  if (input.port < 1 || input.port > 65535) {
    throw new Error("Port must be between 1 and 65535");
  }

  const existing = await prisma.mikrotikSettings.findUnique({
    where: { id: MIKROTIK_SETTINGS_ID },
  });

  let passwordEncrypted = existing?.passwordEncrypted ?? "";
  if (input.password) {
    passwordEncrypted = encryptPrivateKey(input.password);
  } else if (!passwordEncrypted) {
    throw new Error("Password is required");
  }

  const wireGuard = validateWireGuardSettings({
    wgServerPublicKey: input.wgServerPublicKey ?? existing?.wgServerPublicKey ?? "",
    wgServerEndpoint: input.wgServerEndpoint ?? existing?.wgServerEndpoint ?? "",
    wgServerAddress: input.wgServerAddress ?? existing?.wgServerAddress ?? "",
    wgClientIpPool: input.wgClientIpPool ?? existing?.wgClientIpPool ?? "",
  });

  const record = await prisma.mikrotikSettings.upsert({
    where: { id: MIKROTIK_SETTINGS_ID },
    create: {
      id: MIKROTIK_SETTINGS_ID,
      host,
      port: input.port,
      username,
      passwordEncrypted,
      useHttps: input.useHttps,
      tlsVerify: input.tlsVerify,
      wgInterface,
      ...wireGuard,
    },
    update: {
      host,
      port: input.port,
      username,
      passwordEncrypted,
      useHttps: input.useHttps,
      tlsVerify: input.tlsVerify,
      wgInterface,
      ...wireGuard,
    },
  });

  return toView(record);
}

export async function resolveMikrotikConnection(
  input?: Partial<SaveMikrotikSettingsInput>,
): Promise<MikrotikConnection> {
  const saved = await bootstrapFromEnvIfEmpty();

  const host = input?.host?.trim() || saved.host.trim() || "";
  const port = input?.port ?? saved.port ?? 443;
  const username = input?.username?.trim() || saved.username.trim() || "";
  const wgInterface = input?.wgInterface?.trim() || saved.wgInterface.trim() || "";
  const useHttps = input?.useHttps ?? saved.useHttps ?? true;
  const tlsVerify = input?.tlsVerify ?? saved.tlsVerify ?? false;

  let password = input?.password ?? "";
  if (!password && saved.passwordEncrypted) {
    password = decryptPrivateKey(saved.passwordEncrypted);
  }

  if (!host || !username || !password || !wgInterface) {
    throw new Error("MikroTik connection is not configured");
  }

  return {
    host,
    port,
    username,
    password,
    useHttps,
    tlsVerify,
    wgInterface,
  };
}

export async function getMikrotikConnection(): Promise<MikrotikConnection> {
  return resolveMikrotikConnection();
}
