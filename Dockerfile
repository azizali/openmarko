# The app's image (ADR 0007). Build from the repository root: docker build .
# One image, several processes:
#   api:      bun apps/api/src/index.ts       (default)
#   worker:   bun apps/worker/src/index.ts
#   migrate:  bun scripts/migrate.ts           (run once per release, before the new api/worker start)
FROM oven/bun:1.4 AS deps
WORKDIR /app
COPY package.json bun.lock ./
# Every workspace, so the frozen lockfile matches. Only this stage; the image below keeps just what the API runs.
COPY apps/ apps/
COPY modules/ modules/
COPY packages/ packages/
RUN bun install --frozen-lockfile

FROM oven/bun:1.4
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json app.config.ts ./
COPY apps/api/ apps/api/
COPY apps/worker/ apps/worker/
COPY modules/ modules/
COPY packages/ packages/
COPY scripts/ scripts/
EXPOSE 3000
USER bun
HEALTHCHECK --interval=30s --timeout=3s CMD bun -e "fetch('http://localhost:' + (process.env.PORT ?? 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "apps/api/src/index.ts"]
