FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS builder
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
# The brand home: globals.css imports brand/tokens.css.
COPY brand ./brand
# Package the one-shot checkout verifier in the ordinary web image build.
COPY scripts/checkout-journey.ts scripts/money-merchant.ts ./scripts/
COPY config/commercial/catalogue.json ./config/commercial/catalogue.json
RUN bun build ./scripts/checkout-journey.ts --target=node --external=playwright --outfile=/app/checkout-journey.mjs
RUN cd apps/puzzled && bun -e 'const fs = require("node:fs"); const path = require("node:path"); const {createRequire} = require("node:module"); const resolve = createRequire(require.resolve("playwright/package.json")); const target = "/app/checkout-deps/node_modules"; fs.mkdirSync(target, { recursive: true }); for (const name of ["playwright", "playwright-core"]) fs.cpSync(path.dirname(resolve.resolve(name + "/package.json")), target + "/" + name, { recursive: true, dereference: true });'

ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 SKIP_ENV_VALIDATION=1

# Only production supplies this public, non-secret CDN locator.
ARG NEXT_PUBLIC_PUZZLED_ASSET_PREFIX

# 5. Build Puzzled
RUN cd apps/puzzled && bun run build
# Browser source maps leave the served static directory (the site must never
# serve source); the server uploads them at startup (docs/observability.md).
RUN cd apps/puzzled/.next/static && mkdir -p ../source-maps && find . -name '*.map' -exec sh -c \
      'mkdir -p "../source-maps/$(dirname "$1")" && mv "$1" "../source-maps/$1"' _ {} \; \
    && test -z "$(find . -name '*.map')"
# The publisher reads its credential from this BuildKit mount, never an image layer. Missing production secret,
# any failed upload or anonymous byte mismatch fails the image build.
RUN --mount=type=secret,id=public_assets,required=false \
    cd apps/puzzled && bun public-assets.cjs /run/secrets/public_assets

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

# The browser is launched only by an explicit one-shot Job.
RUN apk add --no-cache chromium
ENV PUZZLED_CHECKOUT_CHROMIUM_PATH=/usr/bin/chromium-browser

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
COPY --chown=nextjs:nodejs apps/puzzled/shared-home-*.cjs ./
COPY --chown=nextjs:nodejs apps/puzzled/public-assets.cjs ./
# Preview descriptors cannot admit public HTML. Production's verified receipt
# and standalone config travel together after publication.
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/.next/required-server-files.json ./apps/puzzled/.next/required-server-files.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/puzzled/.next/public-assets.json ./apps/puzzled/.next/public-assets.json
COPY --from=builder --chown=nextjs:nodejs /app/checkout-journey.mjs ./checkout-journey.mjs
COPY --from=builder --chown=nextjs:nodejs /app/checkout-deps/node_modules ./node_modules
EXPOSE 3000
# start-web.cjs binds HOSTNAME=0.0.0.0 and honors Knative PORT.
CMD ["node", "start-web.cjs"]
