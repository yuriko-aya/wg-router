#!/bin/sh
set -eu

cd /app

node scripts/prepare-prisma.mjs
node scripts/prisma-cli.mjs generate
node scripts/run-migrate.mjs

exec gosu nextjs "$@"
