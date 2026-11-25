import { x25519 } from "@noble/curves/ed25519";
import type { WireGuardServerSettings } from "./mikrotik-settings";
import {
  formatAllowedAddresses,
  normalizePeerAllowedIps,
  parseAddressList,
  stripCidr,
} from "./ip";

export { getConfigFilename } from "./config-filename";

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export interface WireGuardKeyPair {
  privateKey: string;
  publicKey: string;
}

export function generateKeyPair(): WireGuardKeyPair {
  const privateKeyBytes = x25519.utils.randomSecretKey();
  const publicKeyBytes = x25519.getPublicKey(privateKeyBytes);
  return {
    privateKey: bytesToBase64(privateKeyBytes),
    publicKey: bytesToBase64(publicKeyBytes),
  };
}

export interface ClientConfigInput {
  name: string;
  privateKey: string;
  allowedAddress: string;
}

export function buildClientConfig(
  input: ClientConfigInput,
  server: WireGuardServerSettings,
): string {
  const address = formatAllowedAddresses(parseAddressList(input.allowedAddress));
  const dnsParts = parseAddressList(server.serverAddress)
    .map((part) => stripCidr(part))
    .filter(Boolean);
  const peerAllowedIps = normalizePeerAllowedIps(server.clientAllowedIps);

  const lines = [
    "[Interface]",
    `PrivateKey = ${input.privateKey}`,
    `Address = ${address}`,
  ];
  if (dnsParts.length > 0) {
    lines.push(`DNS = ${dnsParts.join(", ")}`);
  }
  lines.push(
    "",
    "[Peer]",
    `PublicKey = ${server.publicKey}`,
    `Endpoint = ${server.endpoint}`,
    `AllowedIPs = ${peerAllowedIps}`,
    "PersistentKeepalive = 25",
    "",
  );

  return lines.join("\n");
}

