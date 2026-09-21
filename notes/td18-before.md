# TD-18 before-map (base fd9f061f4ea032cec188582a2ba1653cec106deb, origin/main)

All shapes and line numbers measured on the fetched base. Paths relative to apps/puzzled unless noted.

## The three shapes of one fact (premium entitlement)

1. **Server render-time (the authority):** `lib/billing/server.ts:31` `hasPremiumAccess`
   -> `lib/identity/index.ts:224` `isPremium` -> `evaluateCommerceEntitlement`
   (`/v1/sylphx.commerce.v1.EntitlementService/EvaluateEntitlement`, `enabled`,
   fail-closed). Pages call it and pass booleans as props.
2. **Browser state (the second authority):** `lib/identity/react.tsx:357` `useBilling`
   self-fetches `/api/identity/billing` on mount (:365) -> route
   `app/api/identity/billing/route.ts` -> `getBilling` -> a *second*
   EvaluateEntitlement; the result becomes client state `isPremium`
   (:353, :371) rendered at :911 (`BillingSection`). The client never talks to
   Commerce directly, but it holds an independently resolved copy that goes
   stale on its own clock (refetch = remount).
3. **A boolean handed between server modules:** `lib/api/server.ts:214-217`
   `getServerPersonalDailyResults({ isPremium: boolean })` -> `loadDailyCompletionMap`.
   Callers (home :108-113, stats :101-106) pass the fact as a bare boolean.

## Consumers of the client field (browser side)

| # | Consumer | file:line | What it does with it | Verdict |
|---|----------|-----------|----------------------|---------|
| C1 | `BillingSection` | lib/identity/react.tsx:906-913 | renders 'Premium' / 'Free Plan' | render-only; **unused in the app** (definition only) |
| C2 | `PricingContent` | app/[locale]/(main)/pricing/pricing-client.tsx:65 | current-plan detection (:166), CTA label (:251), disabled state | render + one client-side UX gate (cannot re-buy current plan); real checkout is a server call (route :POST -> createCheckout) |
| C3 | `SubscriptionSettingsContent` | app/[locale]/(main)/settings/subscription/subscription-client.tsx:25 | only `openPortal` | action only; no entitlement read |
| C4 | `SessionReplayInner` | features/monitoring/components/session-replay-provider.tsx:49,62,109 | `getAdjustedSampleRate({isPremium})` (premium -> 25% sampling) + `markConversion('premium_user')` on mount | **behaviour** (the only browser behaviour driven by the fact) |

`useSafeBilling` (react.tsx:415) is a pass-through alias of C1's hook; no other readers.

## Server consumers (already the authority; props, not state)

- pages: home page.tsx:98-100, games/page.tsx:67-70, games/[slug]/page.tsx:152
  (`canAccessGame`), stats/page.tsx:87-90, settings/page.tsx:75-77,
  profile/page.tsx:68, archive/page.tsx:83 (`resolveArchiveAccess`).
- features (fed by those props): catalog.ts:72 `locked`, home-play-state.ts:74
  `locked`, daily-completion.ts:23 (read targets), archive-access.ts:23
  `open|locked`.
- `getServerPersonalDailyResults` (lib/api/server.ts:217) - shape 3 above.

No client-side *access* gate exists: play/serve/submit gates live in Connect and
in the page renders (game-play-area.tsx is a server component; its doc: "Entitlement
was resolved by the page; this component only renders"). The defect is therefore:
the chrome (C1-C4) can disagree with the render-time verdict, because it resolves
the fact again on its own schedule.

## Mismatch cases today

- Entitlement revoked in Commerce after a page load: server render says free,
  browser state (or the route's newer answer) can still say premium -> chrome
  renders 'Premium' / current-plan / 25% replay sampling for a free viewer until
  the next mount/refetch.
- The reverse (fresh purchase): chrome shows Free Plan until the client refetch
  resolves, even though the request that rendered the page already resolved premium.

## Convergence plan

- One server-resolved snapshot: `getServerBilling` in lib/billing/server.ts
  (React `cache()` -> one EvaluateEntitlement per request), `hasPremiumAccess`
  derives from it, `getServerPersonalDailyResults` resolves it internally
  (shape 3 deleted).
- Threaded to the client as data: `[locale]/layout.tsx` resolves it (bounded by
  the presentation deadline, fail-closed null) -> `PlatformProvider`/`SylphxProvider`
  `billing` prop -> `BillingContext`.
- `useBilling` becomes derive-only (no fetch, no client evaluation); C1-C4 keep
  their render contracts and now read the server value. The `/api/identity/billing`
  route stays as a server-authoritative read; nothing in the browser calls it.

## Proof harness

- Suite: `env -u NODE_ENV bun run test` (unit lane: `bun test src tests '.test.ts'`; CI runs `test:unit`).
- New: `src/lib/identity/react.test.ts` (hook + chrome contract),
  `src/features/monitoring/components/session-replay-provider.billing.test.ts`
  (the C4 behaviour reads the server value), `src/lib/billing/server.test.ts`
  (fail-closed authority read + gate re-evaluation).
- Mutation: make the client surfaces read a mounted client store again (the
  removed fetch) -> the new tests must red; restore -> green. Raw in notes/td18-mutation.md.
