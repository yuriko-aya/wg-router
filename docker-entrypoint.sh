#!/bin/sh
set -eu

cd /app

# systemd .env often sets HOSTNAME=127.0.0.1; containers must listen on all interfaces.
export HOSTNAME=0.0.0.0
export PRISMA_TOOLS_ROOT=/app/prisma-tools

chown -R nextjs:nodejs /app/data /app/node_modules

gosu nextjs sh -c '
  set -eu
  node scripts/prepare-prisma.mjs
  node scripts/docker-init-db.mjs
'

exec gosu nextjs "$@"
