import { z } from "zod";

function emptyToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function envFlag(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

const envSchema = z
  .object({
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().url().optional(),
    AUTH_SSO_ONLY: z.preprocess(envFlag, z.boolean().default(false)),
    GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    GOOGLE_CLIENT_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(1).optional(),
    ),
    DATABASE_URL: z.string().min(1).optional(),
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
  )
  .refine(
    (data) =>
      !data.AUTH_SSO_ONLY ||
      Boolean(data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET),
    {
      message: "AUTH_SSO_ONLY requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
      path: ["AUTH_SSO_ONLY"],
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

export function isSsoOnlyAuth(): boolean {
  return getEnv().AUTH_SSO_ONLY;
}

export function isEmailAuthEnabled(): boolean {
  return !isSsoOnlyAuth();
}

export { getClientIpPool, getClientIpPools, stripCidr, toAllowedAddress } from "./ip";
