# Architecture Decision Records (ADR)

This document records key architectural decisions for the Sylphx SDK.

---

## ADR-001: Minimal Entry Points Architecture

**Date:** 2025-01-20

**Status:** Accepted

### Context

The SDK originally had 17+ separate entry points:
- `/`, `/config`, `/auth`, `/ai`, `/analytics`, `/billing`, `/storage`, `/notifications`, `/jobs`, `/flags`, `/webhooks`, `/email`, `/consent`, `/referrals`, `/react`, `/nextjs`, `/server`

This was based on a misunderstanding that multiple entry points are required for tree-shaking.

### Decision

Consolidate to **4 entry points only**:

| Entry Point | Purpose | Why Separate |
|-------------|---------|--------------|
| `/` (main) | All pure functions | N/A - main entry |
| `/react` | React hooks & components | Requires React peer dependency, has `'use client'` directive |
| `/server` | Server-side utilities | Requires `jose` (Node.js JWT library) |
| `/nextjs` | Next.js integration | Requires `next/headers`, `next/server` |

### Rationale

**Tree-shaking does NOT require multiple entry points.**

Modern bundlers (Vite, esbuild, webpack 5, Rollup) can tree-shake unused exports from a single entry point when:
1. Package has `"sideEffects": false` in package.json
2. Functions are pure (no side effects on import)
3. No module-level state initialization

**Multiple entry points ARE required when:**
1. **Different peer dependencies** - `/react` needs React, main entry doesn't
2. **Different runtime environments** - `/server` needs Node.js APIs
3. **Framework-specific code** - `/nextjs` needs Next.js imports
4. **Directive boundaries** - `/react` needs `'use client'` at module top

### Consequences

**Positive:**
- Simpler mental model for SDK users
- Fewer files to maintain
- Clearer separation: "use /react if you need React, /server if you need server-side"
- Still fully tree-shakeable

**Negative:**
- Users cannot import from `@sylphx/sdk/analytics` anymore (must use `@sylphx/sdk`)
- Slightly larger TypeScript type surface in main entry

### Migration

```typescript
// Before (unnecessary granularity)
import { track } from '@sylphx/sdk/analytics'
import { signIn } from '@sylphx/sdk/auth'
import { createConfig } from '@sylphx/sdk/config'

// After (simpler, equally tree-shakeable)
import { track, signIn, createConfig } from '@sylphx/sdk'
```

---

## ADR-002: Pure Function Design Pattern

**Date:** 2025-01-20

**Status:** Accepted

### Context

SDKs can be designed with different patterns:
1. **Class-based**: `new SylphxClient(config).analytics.track(...)`
2. **Method-based**: `createClient(config).track(...)`
3. **Pure function**: `track(config, ...)`

### Decision

Use **pure functions** as the primary API pattern:

```typescript
// Config is explicit, passed to every function
const config = createConfig({ appId: 'my-app', appSecret: '...' })

// Pure functions - no hidden state
await track(config, { event: 'purchase', properties: { amount: 99 } })
await signIn(config, { email, password })

// Immutable config updates
const authenticatedConfig = withToken(config, accessToken)
await getProfile(authenticatedConfig)
```

### Rationale

**Compared to industry standards:**

| SDK | Pattern | Tree-shakeable | Testable | Server-safe |
|-----|---------|---------------|----------|-------------|
| Firebase | Pure functions | ✅ | ✅ | ✅ |
| Clerk | Methods on client | ⚠️ | ⚠️ | ✅ |
| Vercel | Methods on client | ⚠️ | ⚠️ | ✅ |
| **Sylphx** | Pure functions | ✅ | ✅ | ✅ |

**Firebase example (what we follow):**
```typescript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
const auth = getAuth(app)
await signInWithEmailAndPassword(auth, email, password)
```

**Our equivalent:**
```typescript
import { createConfig, signIn } from '@sylphx/sdk'
const config = createConfig({ appId, appSecret })
await signIn(config, { email, password })
```

**Benefits:**
1. **Testable** - Easy to mock, no hidden state
2. **Composable** - Functions can be combined freely
3. **Server-safe** - No React dependencies in core
4. **Tree-shakeable** - Each function is independent
5. **Explicit dependencies** - Config is always visible

### Consequences

**Positive:**
- Maximum flexibility for advanced users
- Works identically on client, server, edge
- Easy to test without mocking internals

**Negative:**
- Slightly more verbose (must pass config each time)
- React users might prefer hooks (we provide those in /react)

---

## ADR-003: React Integration as Convenience Layer

**Date:** 2025-01-20

**Status:** Accepted

### Context

Pure functions are optimal for tree-shaking and server use, but React developers expect hooks and context.

### Decision

Provide React integration as a **convenience layer** on top of pure functions:

```
┌─────────────────────────────────────────────┐
│           @sylphx/sdk/react                 │
│  ┌─────────────────────────────────────┐   │
│  │  SylphxProvider (manages config)    │   │
│  │  useUser(), useBilling(), etc.      │   │
│  │  <SignIn />, <UserButton />, etc.   │   │
│  └─────────────────────────────────────┘   │
│                    │                        │
│                    │ calls                  │
│                    ▼                        │
│  ┌─────────────────────────────────────┐   │
│  │     @sylphx/sdk (pure functions)    │   │
│  │  track(), signIn(), getPlans(), etc.│   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**React hooks internally use pure functions:**
```typescript
// Inside useAnalytics hook
export function useAnalytics() {
  const { config } = useSylphxConfig()

  return {
    track: (event, props) => track(config, { event, properties: props }),
    page: (name, props) => page(config, { name, properties: props }),
  }
}
```

### Rationale

1. React developers get familiar DX (hooks, context, components)
2. Non-React users get pure functions without React dependency
3. Advanced users can bypass React layer entirely
4. Single source of truth for business logic (pure functions)

### Consequences

**Positive:**
- Best of both worlds: convenience AND flexibility
- React layer is thin, easy to maintain
- Easy to add other framework integrations (Vue, Svelte) later

**Negative:**
- Two ways to do things might confuse some users
- Need to document when to use which

---

## ADR-004: Configuration Architecture - Inline Defaults + Auto-Discovery + Console Override

**Date:** 2025-01-21

**Status:** Accepted

### Context

The SDK initially implemented a "Code First" configuration pattern where developers define configs in separate files:

```typescript
// OLD APPROACH (REJECTED)
// engagement.config.ts
export const engagementConfig = createEngagementConfig({
  streaks: [defineStreak({ id: 'daily', name: 'Daily', frequency: 'daily' })],
  achievements: [defineAchievement({ id: 'first-win', ... })],
})

// app.tsx
<SylphxProvider engagement={engagementConfig}>
```

This pattern required:
1. Separate config files with builder functions
2. Provider props to pass configs
3. Sync logic to push configs to platform on mount
4. Type-safe wrappers around base functions

After analyzing industry standards and user feedback, we determined this adds unnecessary complexity.

### Decision

Replace Code First config files with **Inline Defaults + Auto-Discovery + Console Override**:

```typescript
// NEW APPROACH (ACCEPTED)
// Just call the function with inline defaults - no config file needed
await unlockAchievement(config, userId, 'first-win', {
  // Inline defaults - auto-discovered if achievement doesn't exist
  name: 'First Win',
  description: 'Win your first game',
  tier: 'bronze',
  points: 100,
})

// Console can override these values without code changes
```

### Service Categories

| Category | Services | Configuration Pattern |
|----------|----------|----------------------|
| **Pure API** | Auth, AI, Storage, Push, Jobs | No config - just API calls |
| **Console First** | Feature Flags, Billing, Webhooks, Email Templates, In-App Messages | Configure in Console, consume in code |
| **Auto-Discovery + Override** | Analytics, Consent, Engagement, Referrals | Inline defaults → Auto-discover → Console override |

### Pattern Details

**Auto-Discovery + Console Override (Category C):**

1. **Code provides inline defaults at call time**
   - Defaults embedded in function calls
   - No separate config files
   - Works immediately without Console setup

2. **Platform auto-discovers entities**
   - When code calls API with unknown entity, platform creates it
   - Uses inline defaults as initial values
   - No manual registration required

3. **Console can override**
   - Change values without code deployment
   - Override takes precedence over code defaults
   - Marketing/product teams can adjust independently

**Example - Consent:**
```typescript
// Old (Code First - REMOVED)
const consentConfig = createConsentConfig({
  purposes: [defineConsentPurpose({ id: 'analytics', ... })]
})
<SylphxProvider consent={consentConfig}>

// New (Inline Defaults - ADOPTED)
if (await hasConsent(config, 'analytics', {
  name: 'Analytics Cookies',
  description: 'Help us understand site usage',
  required: false,
})) {
  track('pageview')
}
```

**Example - Engagement:**
```typescript
// Old (Code First - REMOVED)
const engagementConfig = createEngagementConfig({
  achievements: [defineAchievement({ id: 'first-win', ... })]
})

// New (Inline Defaults - ADOPTED)
await unlockAchievement(config, userId, 'first-win', {
  name: 'First Win',
  description: 'Win your first game',
  tier: 'bronze',
})
```

### Rationale

**Why NOT Code First config files:**

1. **Unnecessary indirection** - Why define in file A to use in file B?
2. **Sync complexity** - Requires Provider props and mount effects
3. **Deploy dependency** - Config changes require code deployment
4. **Against industry patterns**:
   - Analytics (PostHog, Mixpanel, Amplitude): Schema-less, auto-discover
   - Consent (OneTrust, Cookiebot): Console-first management
   - Engagement (Badgeville): Event-driven, not pre-defined

**Why Inline Defaults + Auto-Discovery:**

1. **Zero setup** - Works immediately, no Console setup required
2. **Code documents intent** - Defaults are visible in code
3. **Flexible override** - Marketing can adjust without engineers
4. **Progressive disclosure** - Simple case is simple, advanced is possible
5. **Firebase pattern** - Matches Remote Config model

### Files Removed

The following Code First files are deleted:

```
packages/sdk/src/lib/engagement/config.ts    # defineStreak, defineLeaderboard, etc.
packages/sdk/src/lib/consent/config.ts       # defineConsentPurpose, createConsentConfig
packages/sdk/src/lib/flags/config.ts         # defineBooleanFlag, createFlagsConfig
packages/sdk/src/lib/flags/typed-flags.ts    # createTypedFlags
packages/sdk/src/lib/analytics/events.ts     # defineEvent, createAnalyticsSchema
packages/sdk/src/lib/analytics/typed-tracker.ts  # createTypedTracker
```

### Provider Changes

Removed props:
- `engagement?: EngagementConfig` - No longer needed
- `consent?: ConsentConfig` - No longer needed

Removed effects:
- Engagement config sync on mount
- Consent config sync on mount

### Consequences

**Positive:**
- Simpler SDK surface area
- No config files to maintain
- Faster onboarding (no Provider config required)
- Marketing/product teams can adjust without deploys
- Matches industry standard patterns

**Negative:**
- Less compile-time type safety for entity names
- Users must provide defaults inline (slightly more verbose)
- Existing users using Code First must migrate

### Migration

```typescript
// Before: Code First
import { createEngagementConfig, defineAchievement } from '@sylphx/sdk'

const config = createEngagementConfig({
  achievements: [
    defineAchievement({
      id: 'first-win',
      name: 'First Win',
      description: 'Win your first game',
      tier: 'bronze',
    })
  ]
})

<SylphxProvider engagement={config}>
// ... later
await unlockAchievement(sylphxConfig, userId, 'first-win')

// After: Inline Defaults
<SylphxProvider>  // No engagement prop needed
// ... later
await unlockAchievement(sylphxConfig, userId, 'first-win', {
  name: 'First Win',
  description: 'Win your first game',
  tier: 'bronze',
})
```

---

## ADR-005: Config Type Naming Convention

**Date:** 2026-02-03

**Status:** Accepted

### Context

The SDK had multiple config types with overlapping names causing confusion:
- `SylphxConfig` defined in both `/config.ts` and `/react/hooks.ts` (different shapes)
- `RestClientConfig` defined in both `/rest-client.ts` and `/react/rest-client.ts` (different purposes)

### Decision

Establish clear naming conventions for configuration types:

| Type | Purpose | Location |
|------|---------|----------|
| `SylphxConfig` | Pure functions (secretKey, platformUrl, accessToken) | `config.ts` |
| `SylphxConfigInput` | Input to `createConfig()` (optional fields) | `config.ts` |
| `SylphxClientConfig` | React hook return value (appId, platformUrl) | `react/hooks.ts` |
| `SylphxProviderProps` | React provider component props | `react/provider.tsx` |
| `SylphxMiddlewareConfig` | Next.js middleware options | `nextjs/middleware.ts` |
| `RestClientConfig` | Server-side REST client (secretKey) | `rest-client.ts` |
| `AuthenticatedRestClientConfig` | Client-side REST client (tokenManager) | `react/rest-client.ts` |

### Naming Conventions

1. **`XConfig`** — Service or feature configuration (readonly, frozen)
2. **`XConfigInput`** — Input with optional fields (before validation)
3. **`XClientConfig`** — Client-side specific config (subset of full config)
4. **`XProviderProps`** — React provider component props
5. **`XMiddlewareConfig`** — Middleware/edge configuration

### Rationale

Clear naming prevents:
- Type shadowing (same name, different interface)
- Import confusion (which file to import from)
- Runtime errors from using wrong config type

### Consequences

**Positive:**
- Clear import paths for each config type
- TypeScript catches wrong config usage
- Self-documenting code

**Negative:**
- More types to learn
- Migration needed for existing code using old names

---

## ADR-006: Type Naming Conventions

**Date:** 2026-02-03

**Status:** Accepted

### Context

The SDK has many types across different modules. Consistent naming helps developers understand what a type represents without reading documentation.

### Decision

Establish standard naming conventions for type suffixes:

| Suffix | Purpose | Example |
|--------|---------|---------|
| `Input` | Function parameters (required fields) | `SignInInput`, `TrackInput` |
| `Result` | SDK function return values | `SignInResult`, `TokenResult` |
| `Response` | Raw API response payloads | `TokenResponse`, `ChatCompletionResponse` |
| `Options` | Optional function parameters | `FileUploadOptions`, `SignedUrlOptions` |
| `Config` | Runtime configuration objects | `SylphxConfig`, `AnalyticsConfig` |
| `Props` | React component props | `SylphxProviderProps`, `SignInProps` |

### Additional Conventions

**Sdk* Prefix (internal types):**
Types prefixed with `Sdk` (e.g., `SdkUserProfile`) are SDK internal representations with JavaScript `Date` objects. API types use ISO strings, SDK transforms to `Date` for convenience.

**Type Location:**
- Domain types → their module (auth.ts, analytics.ts)
- Shared types → types.ts
- React-specific → react/services-context.ts or react/hooks.ts

### Rationale

- Consistent naming reduces cognitive load
- Suffix indicates how the type is used
- Matches patterns in industry SDKs (Stripe, Clerk, Firebase)

### Consequences

**Positive:**
- Self-documenting type names
- Easier to find the right type
- Clear distinction between API types and SDK types

**Negative:**
- Need to maintain consistency as SDK grows
- Some existing types may not follow convention exactly

---

## Summary

The SDK follows these principles:

1. **Minimal entry points** (4 total) - separate only when necessary
2. **Pure functions** - no hidden state, explicit config
3. **React as convenience** - hooks wrap pure functions
4. **Tree-shaking by design** - `sideEffects: false`, pure functions
5. **Inline defaults + auto-discovery** - no config files, Console override
6. **Consistent naming** - Input/Result/Options/Config suffixes

This matches Firebase's architecture pattern, which is considered industry best practice for SDK design.
