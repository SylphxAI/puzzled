FROM oven/bun:1.3.6-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# 1. Copy manifest files first — bun install layer cached until lockfile changes
COPY package.json bun.lock bunfig.toml turbo.json ./
COPY apps/sylphx/package.json         ./apps/sylphx/
COPY apps/puzzled/package.json        ./apps/puzzled/
COPY apps/trivia/package.json         ./apps/trivia/
COPY apps/storage-worker/package.json ./apps/storage-worker/
COPY packages/sdk/package.json        ./packages/sdk/
COPY packages/ui/package.json         ./packages/ui/
COPY packages/sylphx-cli/package.json ./packages/sylphx-cli/
COPY packages/sylphx-runner/package.json ./packages/sylphx-runner/
COPY packages/create-sylphx-app/package.json ./packages/create-sylphx-app/

# 2. Install deps
RUN bun install --ignore-scripts

# 3. Copy SDK + UI source, then build (layer cached by Kaniko until SDK code changes)
COPY packages/sdk ./packages/sdk
COPY packages/ui  ./packages/ui
RUN cd packages/sdk && bun run build

# 4. Copy full source (only invalidates the build step, not install)
COPY . .

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SYLPHX_APP_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SYLPHX_APP_ID=$NEXT_PUBLIC_SYLPHX_APP_ID

# 5. Build Puzzled (Next.js — SDK already in dist/, UI imported from src directly)
RUN cd apps/puzzled && bun run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/.next/static ./apps/puzzled/.next/static
EXPOSE 3000
CMD ["node", "apps/puzzled/server.js"]
