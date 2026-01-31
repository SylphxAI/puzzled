/**
 * @sylphx/platform-sdk/nextjs
 *
 * Next.js integration for Sylphx Platform SDK.
 *
 * Provides server-side auth helpers and middleware for Next.js apps.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { authMiddleware } from '@sylphx/platform-sdk/nextjs'
 *
 * export default authMiddleware({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 *   publicRoutes: ['/', '/about'],
 * })
 *
 * export const config = {
 *   matcher: ['/((?!.*\\..*|_next).*)', '/'],
 * }
 * ```
 *
 * @example
 * ```ts
 * // In a Server Component
 * import { auth, currentUser } from '@sylphx/platform-sdk/nextjs'
 *
 * export default async function Page() {
 *   const { userId } = await auth()
 *   const user = await currentUser()
 *
 *   if (!userId) {
 *     redirect('/login')
 *   }
 *
 *   return <div>Hello, {user?.name}</div>
 * }
 * ```
 */

// Server-side auth
export {
	configureServer,
	auth,
	currentUser,
	currentUserId,
	handleCallback,
	signOut,
	syncAuthToCookies,
	getAuthorizationUrl,
	getSessionToken,
	type AuthResult,
} from './server'

// Cookie helpers
export {
	getCookieNames,
	getAuthCookies,
	setAuthCookies,
	clearAuthCookies,
	isSessionExpired,
	hasRefreshToken,
	SESSION_TOKEN_LIFETIME,
	REFRESH_TOKEN_LIFETIME,
	SECURE_COOKIE_OPTIONS,
	USER_COOKIE_OPTIONS,
	type UserCookieData,
	type AuthCookiesData,
} from './cookies'

// Middleware
export {
	authMiddleware,
	createMatcher,
	getMiddlewareNamespace,
	type AuthMiddlewareConfig,
} from './middleware'

// API Route Helpers (BFF Pattern)
export {
	createCallbackHandler,
	handleCallbackPost,
	type CallbackHandlerOptions,
} from './api-routes'
