import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { getMikrotikConnection } from "./mikrotik-settings";
import { listWireguardPeers } from "./mikrotik";
import {
  formatAllowedAddresses,
  isUnspecifiedAddress,
  normalizeIpKey,
  parseAddressList,
  stripCidr,
} from "./ip";

export interface SyncResultItem {
  name: string;
  publicKey: string;
  allowedAddress: string;
  mikrotikPeerId: string;
}

export interface SyncMissingDbItem {
  id: string;
  name: string;
  publicKey: string;
  allowedAddress: string;
  userEmail: string;
}

export interface MikrotikSyncResult {
  mikrotikTotal: number;
  dbTotal: number;
  matched: number;
  linked: number;
  imported: SyncResultItem[];
  onlyInDb: SyncMissingDbItem[];
}

function parsePeerName(
  comment: string | undefined,
  allowedAddress: string,
  publicKey: string,
): string {
  const pipeComment = comment?.match(/^([^|]+)\|([^|]+)$/)?.[2];
  if (pipeComment) {
    return pipeComment;
  }

  const fromComment = comment?.match(/config:([^\s]+)/)?.[1];
  if (fromComment) {
    return fromComment;
  }

  if (comment?.trim()) {
    return comment.trim().slice(0, 64);
  }

  const ip = stripCidr(parseAddressList(allowedAddress)[0] ?? allowedAddress);
  if (ip && !isUnspecifiedAddress(ip)) {
    return `imported-${normalizeIpKey(ip)}`;
  }

  return `imported-${publicKey.slice(0, 12)}`;
}

async function uniqueName(userId: string, baseName: string): Promise<string> {
  let name = baseName;
  let suffix = 2;

  while (true) {
    const existing = await prisma.config.findFirst({
      where: { userId, name },
    });
    if (!existing) {
      return name;
    }
    name = `${baseName}-${suffix}`;
    suffix += 1;
  }
}

export async function syncMikrotikPeers(adminUserId: string): Promise<MikrotikSyncResult> {
  const admin = await prisma.user.findUnique({ where: { id: adminUserId } });
  if (!admin || admin.role !== Role.ADMIN) {
    throw new Error("Only admins can sync MikroTik peers");
  }

  const mikrotik = await getMikrotikConnection();
  const peers = await listWireguardPeers(mikrotik);

  const dbConfigs = await prisma.config.findMany({
    include: {
      user: { select: { email: true } },
    },
  });

  const dbByPublicKey = new Map(
    dbConfigs.map((config) => [config.publicKey, config]),
  );
  const dbByPeerId = new Map(
    dbConfigs
      .filter((config) => config.mikrotikPeerId)
      .map((config) => [config.mikrotikPeerId!, config]),
  );

  const matchedPeerIds = new Set<string>();
  let matched = 0;
  let linked = 0;
  const imported: SyncResultItem[] = [];

  for (const peer of peers) {
    const existing =
      dbByPublicKey.get(peer.publicKey) ??
      dbByPeerId.get(peer.id);

    if (existing) {
      matched += 1;
      matchedPeerIds.add(peer.id);

      if (!existing.mikrotikPeerId) {
        await prisma.config.update({
          where: { id: existing.id },
          data: { mikrotikPeerId: peer.id },
        });
        linked += 1;
      }

      continue;
    }

    const baseName = parsePeerName(
      peer.comment,
      peer.allowedAddress,
      peer.publicKey,
    );
    const name = await uniqueName(adminUserId, baseName);
    const allowedAddress = formatAllowedAddresses(
      parseAddressList(peer.allowedAddress),
    );

    await prisma.config.create({
      data: {
        userId: adminUserId,
        name,
        publicKey: peer.publicKey,
        privateKeyEncrypted: null,
        allowedAddress,
        mikrotikPeerId: peer.id,
        importedFromMikrotik: true,
      },
    });

    imported.push({
      name,
      publicKey: peer.publicKey,
      allowedAddress,
      mikrotikPeerId: peer.id,
    });
    matchedPeerIds.add(peer.id);
  }

  const onlyInDb = dbConfigs
    .filter(
      (config) =>
        !peers.some(
          (peer) =>
            peer.publicKey === config.publicKey ||
            (config.mikrotikPeerId && peer.id === config.mikrotikPeerId),
        ),
    )
    .map((config) => ({
      id: config.id,
      name: config.name,
      publicKey: config.publicKey,
      allowedAddress: config.allowedAddress,
      userEmail: config.user.email,
    }));

  return {
    mikrotikTotal: peers.length,
    dbTotal: dbConfigs.length,
    matched,
    linked,
    imported,
    onlyInDb,
  };
}
