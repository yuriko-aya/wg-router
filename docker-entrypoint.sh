#!/bin/sh
set -eu

cd /app

# systemd .env often sets HOSTNAME=127.0.0.1; containers must listen on all interfaces.
export HOSTNAME=0.0.0.0

chown -R nextjs:nodejs /app/data /app/node_modules /app/prisma

gosu nextjs sh -c '
  set -eu
  node scripts/prepare-prisma.mjs
  node scripts/prisma-cli.mjs generate
  node scripts/run-migrate.mjs
'

exec gosu nextjs "$@"
