-- WireGuard server settings stored per MikroTik connection (singleton row for now)
ALTER TABLE "MikrotikSettings"
  ADD COLUMN "wgServerPublicKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "wgServerEndpoint" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "wgServerAddress" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "wgClientIpPool" TEXT NOT NULL DEFAULT '';
