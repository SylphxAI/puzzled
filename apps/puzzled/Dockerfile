FROM oven/bun:1.4.2-alpine@sha256:d888c0ae6c86d7866ff10c5aafdd9077b36aee6455b33dd270fb93c0dd5cef6f AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# 1. Copy manifest files — bun install layer cached until lockfile changes
COPY package.json bun.lock bunfig.toml turbo.json ./
COPY apps/puzzled/package.json   ./apps/puzzled/
COPY packages/ui/package.json    ./packages/ui/

# 2. Install deps
RUN bun install --ignore-scripts

# 3. Build UI (cached until package source changes)
# packages/ui/tsconfig.json extends tooling/typescript/base.json
COPY tooling/typescript ./tooling/typescript
COPY packages/ui  ./packages/ui
RUN cd packages/ui && bun run build

# 4. Copy full source
COPY apps/puzzled ./apps/puzzled

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 SKIP_ENV_VALIDATION=1

# No NEXT_PUBLIC_* build values: the platform build passes none (cloud#9247).
# Everything the pages need is read on the server at runtime.

# 5. Build Puzzled
RUN cd apps/puzzled && bun run build
# Browser source maps leave the served static directory (the site must never
# serve source); the server uploads them at startup (docs/observability.md).
RUN cd apps/puzzled/.next/static && mkdir -p ../source-maps && find . -name '*.map' -exec sh -c \
      'mkdir -p "../source-maps/$(dirname "$1")" && mv "$1" "../source-maps/$1"' _ {} \; \
    && test -z "$(find . -name '*.map')"

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
USER nextjs

# Nested (monorepo tracing root) and flattened standalone layouts.
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/public ./apps/puzzled/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/.next/static ./apps/puzzled/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/.next/source-maps ./apps/puzzled/.next/source-maps
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/.next/source-maps ./.next/source-maps
COPY --chown=nextjs:nodejs apps/puzzled/start-web.cjs ./start-web.cjs
EXPOSE 3000
# start-web.cjs binds HOSTNAME=0.0.0.0 and honors Knative PORT.
CMD ["node", "start-web.cjs"]
