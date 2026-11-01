# One image, several processes (ADR 0007):
#   api:      bun apps/api/src/index.ts         (default)
#   worker:   bun apps/worker/src/index.ts
#   migrate:  bun scripts/migrate.ts             (run once per release, before the new api/worker start)
FROM oven/bun:1.4 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/ packages/
COPY modules/ modules/
RUN bun install --frozen-lockfile

FROM oven/bun:1.4
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
USER bun
HEALTHCHECK --interval=30s --timeout=3s CMD bun -e "fetch('http://localhost:' + (process.env.PORT ?? 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "apps/api/src/index.ts"]
