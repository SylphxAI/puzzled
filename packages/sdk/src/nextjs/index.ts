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
	type AuthResult,
} from './server'

// Cookie helpers
export {
	getCookieNames,
	getAuthCookies,
	setAuthCookies,
	clearAuthCookies,
	isAuthExpired,
} from './cookies'

// Middleware
export {
	authMiddleware,
	createMatcher,
	type AuthMiddlewareConfig,
} from './middleware'
