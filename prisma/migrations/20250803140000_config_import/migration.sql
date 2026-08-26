-- AlterTable
ALTER TABLE "Config" ALTER COLUMN "privateKeyEncrypted" DROP NOT NULL;
ALTER TABLE "Config" ADD COLUMN "importedFromMikrotik" BOOLEAN NOT NULL DEFAULT false;
