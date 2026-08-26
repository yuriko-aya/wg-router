import { x25519 } from "@noble/curves/ed25519";
import { getEnv } from "./env";
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

export function buildClientConfig(input: ClientConfigInput): string {
  const env = getEnv();
  const address = formatAllowedAddresses(parseAddressList(input.allowedAddress));
  const dns = parseAddressList(env.WG_SERVER_ADDRESS)
    .map((part) => stripCidr(part))
    .join(", ");

  return [
    "[Interface]",
    `PrivateKey = ${input.privateKey}`,
    `Address = ${address}`,
    `DNS = ${dns}`,
    "",
    "[Peer]",
    `PublicKey = ${env.WG_SERVER_PUBLIC_KEY}`,
    `Endpoint = ${env.WG_SERVER_ENDPOINT}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    "PersistentKeepalive = 25",
    "",
  ].join("\n");
}

