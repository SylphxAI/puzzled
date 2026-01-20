# @sylphx/sdk

Complete SDK for integrating apps with the Sylphx Platform. Get auth, billing, analytics, AI, storage, and more with minimal setup.

## Installation

```bash
npm install @sylphx/sdk
# or
pnpm add @sylphx/sdk
# or
bun add @sylphx/sdk
```

## Quick Start (Next.js)

### 1. Environment Variables

```bash
# .env.local
SYLPHX_APP_ID=your-app-slug
SYLPHX_APP_SECRET=sk_dev_xxxxxxxxxxxx
SYLPHX_PLATFORM_URL=https://sylphx.com
```

### 2. Add Provider to Layout

```tsx
// app/layout.tsx
import { SylphxProvider } from '@sylphx/sdk/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SylphxProvider appId={process.env.NEXT_PUBLIC_SYLPHX_APP_ID!}>
          {children}
        </SylphxProvider>
      </body>
    </html>
  )
}
```

### 3. Add Middleware

```ts
// middleware.ts
import { authMiddleware } from '@sylphx/sdk/nextjs'

export default authMiddleware({
  appId: process.env.SYLPHX_APP_ID!,
  publicRoutes: ['/', '/login', '/signup', '/api/auth/callback'],
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### 4. Create Callback Route

```ts
// app/api/auth/callback/route.ts
import { handleCallback } from '@sylphx/sdk/nextjs'

export const GET = handleCallback()
```

### 5. Use the SDK

```tsx
// app/page.tsx
'use client'

import { useUser, SignedIn, SignedOut, SignIn, UserButton } from '@sylphx/sdk/react'

export default function Home() {
  const { user } = useUser()

  return (
    <div>
      <SignedOut>
        <SignIn mode="embedded" afterSignInUrl="/dashboard" />
      </SignedOut>

      <SignedIn>
        <h1>Hello, {user?.name}</h1>
        <UserButton />
      </SignedIn>
    </div>
  )
}
```

---

## React Hooks

### Authentication

```tsx
import { useUser, useAuth, useSession } from '@sylphx/sdk/react'

// Get current user
const { user, isLoading, isSignedIn } = useUser()

// Auth actions
const { signIn, signUp, signOut, resetPassword } = useAuth()

// Session management
const { session, refresh } = useSession()
```

### Billing

```tsx
import { useBilling } from '@sylphx/sdk/react'

const { subscription, isPremium, plans, createCheckout, openPortal } = useBilling()

// Check premium status
if (isPremium) {
  // Show premium features
}

// Start checkout (returns URL to redirect to)
const checkoutUrl = await createCheckout('pro', 'monthly')
window.location.href = checkoutUrl

// Open billing portal to manage subscription
await openPortal()
```

### Analytics

```tsx
import { useAnalytics } from '@sylphx/sdk/react'

const { track, identify, pageView } = useAnalytics()

// Track custom event
track('button_clicked', { buttonId: 'signup' })

// Identify user
identify({ name: 'John', email: 'john@example.com' })
```

### AI

```tsx
import { useChat, useCompletion, useEmbedding } from '@sylphx/sdk/react'

// Chat completion
const { messages, send, isLoading } = useChat({
  model: 'anthropic/claude-3.5-sonnet',
})

// Text completion
const { complete, completion, isLoading } = useCompletion()

// Embeddings
const { embed, embedding } = useEmbedding()
```

### Storage

```tsx
import { useStorage } from '@sylphx/sdk/react'

const { upload, uploadAvatar, deleteFile, getUrl, isUploading, progress } = useStorage()

// Upload avatar (special handling for profile images)
const avatarUrl = await uploadAvatar(file)

// Upload file with optional path
const fileUrl = await upload(file, { path: 'documents/' })

// Show progress while uploading
if (isUploading) {
  console.log(`Upload progress: ${progress}%`)
}
```

### More Hooks

```tsx
// Feature flags - check if features are enabled
import { useFeatureFlag, useFeatureFlags } from '@sylphx/sdk/react'
const { isEnabled, variant, isLoading } = useFeatureFlag('new-dashboard')
const flags = useFeatureFlags(['dark-mode', 'beta-features'])

// Error tracking - capture exceptions and breadcrumbs
import { useErrorTracking } from '@sylphx/sdk/react'
const { captureException, addBreadcrumb, setRoute } = useErrorTracking()

// Referrals - referral program management
import { useReferral } from '@sylphx/sdk/react'

// Privacy/consent - GDPR consent management
import { useConsent } from '@sylphx/sdk/react'

// Background jobs - async task management
import { useJobs } from '@sylphx/sdk/react'

// Organizations - multi-tenant support
import { useOrganization } from '@sylphx/sdk/react'

// Notifications - in-app notification center
import { useNotifications } from '@sylphx/sdk/react'
```

---

## UI Components

### Auth Components

```tsx
import {
  SignIn,
  SignUp,
  UserButton,
  ForgotPassword,
  ResetPassword,
  VerifyEmail,
} from '@sylphx/sdk/react'

// Embedded sign-in form
<SignIn mode="embedded" afterSignInUrl="/dashboard" />

// Modal sign-in
<SignIn mode="modal" />

// User avatar with dropdown menu
<UserButton afterSignOutUrl="/" />
```

### Protected Routes

```tsx
import { SignedIn, SignedOut, ProtectedRoute, Protect } from '@sylphx/sdk/react'

// Show only to signed-in users
<SignedIn>
  <Dashboard />
</SignedIn>

// Show only to signed-out users
<SignedOut>
  <SignIn mode="embedded" />
</SignedOut>

// Role-based access
<Protect role="admin">
  <AdminPanel />
</Protect>
```

### Billing Components

```tsx
import { PricingTable, BillingCard, CheckoutButton } from '@sylphx/sdk/react'

// Show pricing plans
<PricingTable plans={plans} />

// Current subscription card
<BillingCard />

// Checkout button
<CheckoutButton planSlug="pro" interval="monthly">
  Upgrade to Pro
</CheckoutButton>
```

### Organization Components

```tsx
import { OrganizationSwitcher, MembersList, InviteMember } from '@sylphx/sdk/react'

// Switch between orgs
<OrganizationSwitcher />

// Show org members
<MembersList />

// Invite form
<InviteMember onInvite={(email) => console.log(email)} />
```

---

## Server-Side (Next.js)

### Get Current User

```tsx
// In Server Components
import { auth, currentUser } from '@sylphx/sdk/nextjs'

export default async function Page() {
  const user = await currentUser()

  if (!user) {
    redirect('/login')
  }

  return <div>Hello, {user.name}</div>
}

// With full auth details
export default async function Page() {
  const { userId, accessToken } = await auth()

  // Use accessToken for API calls
}
```

### Server API Client

```tsx
import { createSylphx } from '@sylphx/sdk'

const sylphx = createSylphx({
  appId: process.env.SYLPHX_APP_ID!,
  appSecret: process.env.SYLPHX_APP_SECRET!,
})

// Track events (tRPC-style with full type inference)
await sylphx.analytics.track.mutate({
  event: 'purchase_completed',
  userId: user.id,
  properties: { amount: 99.99 },
})

// Get subscription
const subscription = await sylphx.billing.getSubscription.query()

// Check feature flag
const isEnabled = await sylphx.flags.check.query({ key: 'new-feature' })
```

---

## API Reference

### `createSylphx(config)`

Creates a server-side API client with full TypeScript inference.

```ts
const sylphx = createSylphx({
  appId: string,          // Your app slug
  appSecret: string,      // sk_dev_*, sk_stg_*, or sk_prod_*
  platformUrl?: string,   // Default: https://sylphx.com
  accessToken?: string,   // User access token (optional)
})
```

> **Note**: `createPlatformAPI` is deprecated. Use `createSylphx` instead.

**Available Namespaces:**

All methods use tRPC patterns: `.query()` for reads, `.mutate()` for writes.

| Namespace | Methods |
|-----------|---------|
| `auth` | `login`, `register`, `logout`, `verifyMfa`, `forgotPassword`, `resetPassword` |
| `user` | `getProfile`, `updateProfile`, `changePassword`, `getSecuritySettings`, `getLoginHistory`, `deleteAccount` |
| `billing` | `getPlans`, `getSubscription`, `createCheckout`, `createPortalSession`, `cancelSubscription` |
| `analytics` | `track`, `trackBatch`, `identify`, `pageView` |
| `notifications` | `list`, `markRead`, `getUnreadCount`, `getPreferences` |
| `referrals` | `getMyCode`, `redeem`, `getStats` |
| `flags` | `check`, `getAll`, `checkWithDetail`, `getAllWithDetail` |
| `storage` | `getUploadUrl`, `uploadAvatar` |
| `jobs` | `submit`, `getStatus`, `cancel`, `list` |

---

## Entry Points

| Import | Use For |
|--------|---------|
| `@sylphx/sdk` | Server-side API client |
| `@sylphx/sdk/react` | React hooks, components, provider |
| `@sylphx/sdk/nextjs` | Next.js middleware, auth helpers |

---

## TypeScript

Full type support included. No additional packages needed.

```tsx
import type { User, Plan, Subscription } from '@sylphx/sdk'
```
