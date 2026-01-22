/**
 * Composable React Providers
 *
 * Tree-shakeable, composable providers for React apps.
 * Import only what you need - no bundle bloat.
 *
 * @example
 * ```tsx
 * import {
 *   SylphxCore,
 *   AuthProvider,
 *   AnalyticsProvider,
 * } from '@sylphx/platform-sdk/react/composable'
 *
 * // Compose only what you need
 * function App() {
 *   return (
 *     <SylphxCore appId="my-app" secretKey={process.env.SYLPHX_SECRET!}>
 *       <AuthProvider>
 *         <AnalyticsProvider>
 *           {children}
 *         </AnalyticsProvider>
 *       </AuthProvider>
 *     </SylphxCore>
 *   )
 * }
 * ```
 */

// Core provider (required)
export { SylphxCore, useSylphxConfig, type SylphxCoreProps } from './core'

// Auth provider and hooks
export {
	AuthProvider,
	useAuth,
	useUser,
	useSignIn,
	useSignOut,
	type AuthState,
} from './auth'

// Analytics provider and hooks
export {
	AnalyticsProvider,
	useAnalytics,
	useTrack,
	usePage,
	useIdentify,
} from './analytics'

// AI hooks (no provider needed - uses config directly)
export {
	useChat,
	useChatStream,
	useEmbed,
} from './ai'

// Billing hooks (composable, no provider needed)
export {
	usePlans,
	useSubscription,
	useCheckout,
	usePortal,
	type Plan,
	type Subscription,
} from './billing'

// Billing provider (for shared state pattern)
export { BillingProvider, useBilling } from '../billing'

// Storage hooks (no provider needed)
export {
	useUpload,
	useFileUrl,
} from './storage'

// Feature flags hooks
export {
	useFlag,
	useFlags,
	useVariant,
} from './flags'
