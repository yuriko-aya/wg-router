#!/bin/sh
set -eu

cd /app

node scripts/prepare-prisma.mjs
npx prisma generate
node scripts/run-migrate.mjs

exec gosu nextjs "$@"
