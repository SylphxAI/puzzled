/**
 * @sylphx/sdk/nextjs — State of the Art
 *
 * Next.js integration for Sylphx Platform SDK.
 *
 * ONE middleware handles everything:
 * - Auth routes (mounted automatically)
 * - Token refresh (automatic, every request)
 * - Route protection
 * - Cookie management
 *
 * @example
 * ```ts
 * // middleware.ts (or proxy.ts for Next.js 16)
 * import { createSylphxMiddleware } from '@sylphx/sdk/nextjs'
 *
 * export default createSylphxMiddleware({
 *   publicRoutes: ['/', '/about', '/pricing'],
 * })
 *
 * export const config = {
 *   matcher: ['/((?!_next|.*\\..*).*)', '/'],
 * }
 * ```
 *
 * That's it. No /api/auth/* routes needed.
 *
 * @example
 * ```ts
 * // In a Server Component
 * import { auth, currentUser } from '@sylphx/sdk/nextjs'
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

// =============================================================================
// Middleware — State of the Art (Auth0 v4 / Clerk / Supabase pattern)
// =============================================================================
// ONE middleware handles everything. No manual API routes needed.

export {
	createSylphxMiddleware,
	createMatcher,
	getNamespace,
	type SylphxMiddlewareConfig,
} from "./middleware";

// =============================================================================
// Server-side Auth (for Server Components)
// =============================================================================

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
} from "./server";

// =============================================================================
// Cookie Helpers (advanced use only)
// =============================================================================

export {
	getCookieNames,
	getAuthCookies,
	setAuthCookies,
	clearAuthCookies,
	setAuthCookiesMiddleware,
	clearAuthCookiesMiddleware,
	isSessionExpired,
	hasRefreshToken,
	parseUserCookie,
	SESSION_TOKEN_LIFETIME,
	REFRESH_TOKEN_LIFETIME,
	SECURE_COOKIE_OPTIONS,
	USER_COOKIE_OPTIONS,
	type UserCookieData,
	type AuthCookiesData,
} from "./cookies";

// Re-export constants needed for token expiry calculations
export {
	TOKEN_EXPIRY_BUFFER_MS,
	SESSION_TOKEN_LIFETIME_MS,
} from "../constants";
