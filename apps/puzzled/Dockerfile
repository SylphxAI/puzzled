FROM oven/bun:1.3.6-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# 1. Copy manifest files — bun install layer cached until lockfile changes
COPY package.json bun.lock bunfig.toml turbo.json ./
COPY apps/puzzled/package.json   ./apps/puzzled/
COPY packages/sdk/package.json   ./packages/sdk/
COPY packages/ui/package.json    ./packages/ui/

# 2. Install deps
RUN bun install --ignore-scripts

# 3. Build SDK + UI (cached until package source changes)
COPY packages/sdk ./packages/sdk
COPY packages/ui  ./packages/ui
RUN cd packages/sdk && bun run build

# 4. Copy full source
COPY apps/puzzled ./apps/puzzled

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SYLPHX_APP_ID
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SYLPHX_APP_ID=$NEXT_PUBLIC_SYLPHX_APP_ID \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# 5. Build Puzzled
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
