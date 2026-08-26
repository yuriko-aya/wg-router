import { encryptPrivateKey, decryptPrivateKey } from "./crypto";
import { prisma } from "./prisma";

export const MIKROTIK_SETTINGS_ID = "default";

export interface MikrotikSettingsView {
  host: string;
  port: number;
  username: string;
  useHttps: boolean;
  tlsVerify: boolean;
  wgInterface: string;
  hasPassword: boolean;
  configured: boolean;
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
}

function isConfigured(record: {
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

function toView(record: {
  host: string;
  port: number;
  username: string;
  passwordEncrypted: string;
  useHttps: boolean;
  tlsVerify: boolean;
  wgInterface: string;
}): MikrotikSettingsView {
  return {
    host: record.host,
    port: record.port,
    username: record.username,
    useHttps: record.useHttps,
    tlsVerify: record.tlsVerify,
    wgInterface: record.wgInterface,
    hasPassword: Boolean(record.passwordEncrypted),
    configured: isConfigured(record),
  };
}

async function bootstrapFromEnvIfEmpty() {
  const existing = await prisma.mikrotikSettings.findUnique({
    where: { id: MIKROTIK_SETTINGS_ID },
  });

  if (!existing || isConfigured(existing)) {
    return existing;
  }

  const host = process.env.MIKROTIK_HOST?.trim();
  const username = process.env.MIKROTIK_USER?.trim();
  const password = process.env.MIKROTIK_PASSWORD;
  const wgInterface = process.env.MIKROTIK_WG_INTERFACE?.trim();

  if (!host || !username || !password || !wgInterface) {
    return existing;
  }

  const useHttps = process.env.MIKROTIK_USE_HTTPS !== "false";
  const tlsVerify = process.env.MIKROTIK_TLS_VERIFY === "true";
  const port = Number(process.env.MIKROTIK_PORT ?? 443);

  return prisma.mikrotikSettings.upsert({
    where: { id: MIKROTIK_SETTINGS_ID },
    create: {
      id: MIKROTIK_SETTINGS_ID,
      host,
      port: Number.isNaN(port) ? 443 : port,
      username,
      passwordEncrypted: encryptPrivateKey(password),
      useHttps,
      tlsVerify,
      wgInterface,
    },
    update: {
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

export async function getMikrotikSettingsView(): Promise<MikrotikSettingsView> {
  const record =
    (await bootstrapFromEnvIfEmpty()) ??
    (await prisma.mikrotikSettings.findUnique({
      where: { id: MIKROTIK_SETTINGS_ID },
    }));

  if (!record) {
    return {
      host: "",
      port: 443,
      username: "",
      useHttps: true,
      tlsVerify: false,
      wgInterface: "",
      hasPassword: false,
      configured: false,
    };
  }

  return toView(record);
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
    },
    update: {
      host,
      port: input.port,
      username,
      passwordEncrypted,
      useHttps: input.useHttps,
      tlsVerify: input.tlsVerify,
      wgInterface,
    },
  });

  return toView(record);
}

export async function resolveMikrotikConnection(
  input?: Partial<SaveMikrotikSettingsInput>,
): Promise<MikrotikConnection> {
  const saved = await bootstrapFromEnvIfEmpty();

  const host = input?.host?.trim() || saved?.host.trim() || "";
  const port = input?.port ?? saved?.port ?? 443;
  const username = input?.username?.trim() || saved?.username.trim() || "";
  const wgInterface = input?.wgInterface?.trim() || saved?.wgInterface.trim() || "";
  const useHttps = input?.useHttps ?? saved?.useHttps ?? true;
  const tlsVerify = input?.tlsVerify ?? saved?.tlsVerify ?? false;

  let password = input?.password ?? "";
  if (!password && saved?.passwordEncrypted) {
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
