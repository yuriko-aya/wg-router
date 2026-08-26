-- CreateTable
CREATE TABLE "MikrotikSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "host" TEXT NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 443,
    "username" TEXT NOT NULL DEFAULT '',
    "passwordEncrypted" TEXT NOT NULL DEFAULT '',
    "useHttps" BOOLEAN NOT NULL DEFAULT true,
    "tlsVerify" BOOLEAN NOT NULL DEFAULT false,
    "wgInterface" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MikrotikSettings_pkey" PRIMARY KEY ("id")
);

-- Seed default row
INSERT INTO "MikrotikSettings" ("id", "host", "port", "username", "passwordEncrypted", "useHttps", "tlsVerify", "wgInterface", "updatedAt")
VALUES ('default', '', 443, '', '', true, false, '', CURRENT_TIMESTAMP);
