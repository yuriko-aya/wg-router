FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# postinstall needs scripts/ and prisma templates — not copied yet
RUN npm ci --ignore-scripts || npm install --ignore-scripts

FROM node:22-bookworm-slim AS prisma-tools
WORKDIR /tools
COPY package.json ./
RUN npm init -y >/dev/null 2>&1 \
  && npm install --ignore-scripts "prisma@$(node -pe "require('./package.json').devDependencies.prisma")"

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:./data/wg-router.db
# Placeholders for Next.js build; override at runtime via --env-file
ENV AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ENV ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
RUN npm run build
RUN mkdir -p data && node scripts/run-migrate.mjs \
  && mkdir -p /sqlite-template \
  && cp data/wg-router.db /sqlite-template/wg-router.db

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates gosu \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/data /app/prisma-tools \
  && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /sqlite-template ./sqlite-template
COPY --from=prisma-tools /tools/node_modules ./prisma-tools/node_modules
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh \
  && chown -R nextjs:nodejs /app/prisma-tools /app/sqlite-template /app/prisma /app/scripts

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/data/wg-router.db
ENV PRISMA_TOOLS_ROOT=/app/prisma-tools

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
