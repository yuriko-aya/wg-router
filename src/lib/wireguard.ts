import { x25519 } from "@noble/curves/ed25519";
import type { WireGuardServerSettings } from "./mikrotik-settings";
import { formatAllowedAddresses, parseAddressList, stripCidr } from "./ip";

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
  const dns = parseAddressList(server.serverAddress)
    .map((part) => stripCidr(part))
    .join(", ");

  return [
    "[Interface]",
    `PrivateKey = ${input.privateKey}`,
    `Address = ${address}`,
    `DNS = ${dns}`,
    "",
    "[Peer]",
    `PublicKey = ${server.publicKey}`,
    `Endpoint = ${server.endpoint}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    "PersistentKeepalive = 25",
    "",
  ].join("\n");
}

