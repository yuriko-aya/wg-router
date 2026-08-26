import { z } from "zod";
import { getClientIpPool, getClientIpPools } from "./ip";

const envSchema = z.object({
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(16),
  ADMIN_EMAILS: z.string().default(""),
  WG_SERVER_PUBLIC_KEY: z.string().min(1),
  WG_SERVER_ENDPOINT: z.string().min(1),
  WG_SERVER_ADDRESS: z.string().min(1),
  WG_CLIENT_IP_POOL: z.string().min(1),
  MAX_CONFIGS_PER_USER: z.coerce.number().int().positive().default(3),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  return parsed.data;
}

let cached: ReturnType<typeof loadEnv> | null = null;

export function getEnv() {
  if (!cached) {
    cached = loadEnv();
  }
  return cached;
}

export function getAdminEmails(): Set<string> {
  const raw = getEnv().ADMIN_EMAILS;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function getConfiguredClientIpPools() {
  return getClientIpPools(getEnv().WG_CLIENT_IP_POOL);
}

export { getClientIpPool, getClientIpPools, stripCidr, toAllowedAddress } from "./ip";
