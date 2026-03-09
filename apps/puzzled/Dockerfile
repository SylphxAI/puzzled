FROM oven/bun:alpine AS builder
WORKDIR /app

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

# 2. Install with persistent bun cache — fast even on cache miss
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --ignore-scripts

# 3. Copy full source (only invalidates the build step, not install)
COPY . .

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SYLPHX_APP_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SYLPHX_APP_ID=$NEXT_PUBLIC_SYLPHX_APP_ID

# 4. Build SDK first (tsup, sequential — avoids OOM from parallel entry points)
RUN cd packages/sdk && bun run build

# 5. Build Puzzled (Next.js — imports SDK from packages/sdk/dist, UI from src directly)
RUN cd apps/puzzled && bun run build

FROM node:alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=builder /app/apps/puzzled/public ./public
COPY --from=builder /app/apps/puzzled/.next/standalone ./
COPY --from=builder /app/apps/puzzled/.next/static ./apps/puzzled/.next/static
EXPOSE 3000
CMD ["node", "apps/puzzled/server.js"]
