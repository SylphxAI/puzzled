FROM oven/bun:alpine AS builder
WORKDIR /app

# Copy all source first
COPY . .

# Single bun install for proper workspace resolution (all packages get their node_modules)
RUN bun install --ignore-scripts
# Fix missing peer dependency in @sylphx/sdk that Turbopack requires
RUN bun add use-sync-external-store --exact 2>/dev/null || true

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# Build args for env vars needed at build time (NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SYLPHX_APP_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SYLPHX_APP_ID=$NEXT_PUBLIC_SYLPHX_APP_ID

RUN ./node_modules/.bin/turbo run build --filter=@sylphx/puzzled

FROM node:alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=builder /app/apps/puzzled/public ./public
COPY --from=builder /app/apps/puzzled/.next/standalone ./
COPY --from=builder /app/apps/puzzled/.next/static ./apps/puzzled/.next/static
EXPOSE 3000
CMD ["node", "apps/puzzled/server.js"]
