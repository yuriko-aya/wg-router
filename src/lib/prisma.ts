import { PrismaClient } from "@prisma/client";

function ensureDatabaseUrl(): string {
  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = "file:./data/wg-router.db";
  }
  return process.env.DATABASE_URL;
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
