import { prisma } from "./prisma";
import { encryptPrivateKey, decryptPrivateKey } from "./crypto";
import { generateKeyPair, buildClientConfig } from "./wireguard";
import { createWireguardPeer, deleteWireguardPeer } from "./mikrotik";
import { getMikrotikConnection } from "./mikrotik-settings";
import { allocateClientIp } from "./ip-pool";
import { getEnv } from "./env";
import { Role } from "@prisma/client";

export interface ConfigView {
  id: string;
  name: string;
  allowedAddress: string;
  publicKey: string;
  importedFromMikrotik: boolean;
  hasPrivateKey: boolean;
  createdAt: Date;
}

export function toConfigView(config: {
  id: string;
  name: string;
  allowedAddress: string;
  publicKey: string;
  privateKeyEncrypted?: string | null;
  importedFromMikrotik?: boolean;
  createdAt: Date;
}): ConfigView {
  return {
    id: config.id,
    name: config.name,
    allowedAddress: config.allowedAddress,
    publicKey: config.publicKey,
    importedFromMikrotik: config.importedFromMikrotik ?? false,
    hasPrivateKey: Boolean(config.privateKeyEncrypted),
    createdAt: config.createdAt,
  };
}

export async function listUserConfigs(userId: string): Promise<ConfigView[]> {
  const configs = await prisma.config.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return configs.map(toConfigView);
}

export async function createUserConfig(userId: string, name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Config name is required");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== Role.ADMIN) {
    const maxConfigs = getEnv().MAX_CONFIGS_PER_USER;
    const count = await prisma.config.count({ where: { userId } });
    if (count >= maxConfigs) {
      throw new Error(`You can only have up to ${maxConfigs} configs`);
    }
  }

  const mikrotik = await getMikrotikConnection();
  const keys = generateKeyPair();
  const allowedAddress = await allocateClientIp();
  const comment = `${user.email}|${trimmedName}`.slice(0, 64);

  const mikrotikPeerId = await createWireguardPeer(mikrotik, {
    publicKey: keys.publicKey,
    allowedAddress,
    comment,
  });

  try {
    const config = await prisma.config.create({
      data: {
        userId,
        name: trimmedName,
        publicKey: keys.publicKey,
        privateKeyEncrypted: encryptPrivateKey(keys.privateKey),
        allowedAddress,
        mikrotikPeerId,
      },
    });

    const privateKey = keys.privateKey;
    const confText = buildClientConfig({
      name: trimmedName,
      privateKey,
      allowedAddress,
    });

    return {
      config: toConfigView(config),
      confText,
    };
  } catch (error) {
    await deleteWireguardPeer(mikrotik, mikrotikPeerId).catch(() => undefined);
    throw error;
  }
}

export async function deleteUserConfig(userId: string, configId: string) {
  const config = await prisma.config.findFirst({
    where: { id: configId, userId },
  });

  if (!config) {
    throw new Error("Config not found");
  }

  if (config.mikrotikPeerId) {
    const mikrotik = await getMikrotikConnection();
    await deleteWireguardPeer(mikrotik, config.mikrotikPeerId);
  }

  await prisma.config.delete({ where: { id: config.id } });
}

export async function getConfigDownload(userId: string, configId: string) {
  const config = await prisma.config.findFirst({
    where: { id: configId, userId },
  });

  if (!config) {
    throw new Error("Config not found");
  }

  if (!config.privateKeyEncrypted) {
    throw new Error(
      "This config was imported from MikroTik and has no private key available",
    );
  }

  const privateKey = decryptPrivateKey(config.privateKeyEncrypted);
  const confText = buildClientConfig({
    name: config.name,
    privateKey,
    allowedAddress: config.allowedAddress,
  });

  return { confText, name: config.name };
}

export async function deleteConfigById(configId: string) {
  const config = await prisma.config.findUnique({ where: { id: configId } });
  if (!config) {
    throw new Error("Config not found");
  }

  if (config.mikrotikPeerId) {
    const mikrotik = await getMikrotikConnection();
    await deleteWireguardPeer(mikrotik, config.mikrotikPeerId);
  }

  await prisma.config.delete({ where: { id: configId } });
}
