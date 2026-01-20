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

## Summary

The SDK follows these principles:

1. **Minimal entry points** (4 total) - separate only when necessary
2. **Pure functions** - no hidden state, explicit config
3. **React as convenience** - hooks wrap pure functions
4. **Tree-shaking by design** - `sideEffects: false`, pure functions

This matches Firebase's architecture pattern, which is considered industry best practice for SDK design.
