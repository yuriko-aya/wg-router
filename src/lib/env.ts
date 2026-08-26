import { z } from "zod";

function emptyToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

const envSchema = z
  .object({
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    GOOGLE_CLIENT_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(1).optional(),
    ),
    DATABASE_URL: z.string().min(1),
    ENCRYPTION_KEY: z.string().min(16),
    ADMIN_EMAILS: z.string().default(""),
    MAX_CONFIGS_PER_USER: z.coerce.number().int().positive().default(3),
  })
  .refine(
    (data) =>
      Boolean(data.GOOGLE_CLIENT_ID) === Boolean(data.GOOGLE_CLIENT_SECRET),
    {
      message:
        "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set or both omitted",
      path: ["GOOGLE_CLIENT_ID"],
    },
  );

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

export function isGoogleAuthConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export { getClientIpPool, getClientIpPools, stripCidr, toAllowedAddress } from "./ip";
