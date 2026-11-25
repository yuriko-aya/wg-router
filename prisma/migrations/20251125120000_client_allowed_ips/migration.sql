-- AlterTable
ALTER TABLE "MikrotikSettings" ADD COLUMN "wgClientAllowedIps" TEXT NOT NULL DEFAULT '0.0.0.0/0, ::/0';