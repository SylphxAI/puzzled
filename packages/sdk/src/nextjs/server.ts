/**
 * Server-side Auth Helpers for Next.js
 *
 * Use in Server Components and API Routes.
 *
 * Architecture: Cookie-Centric Single Source of Truth
 * ===================================================
 *
 * All auth state lives in cookies. The auth() function reads
 * from HttpOnly cookies and refreshes if needed.
 *
 * Cookie Structure:
 * - __sylphx_{namespace}_session  — HttpOnly JWT (5 min)
 * - __sylphx_{namespace}_refresh  — HttpOnly refresh token (30 days)
 * - __sylphx_{namespace}_user     — JS-readable user data (5 min)
 */

import { cache } from "react";
import { DEFAULT_PLATFORM_URL, TOKEN_EXPIRY_BUFFER_MS } from "../constants";
import {
	getCookieNamespace as getCookieNamespaceFromKey,
	validateAndSanitizeAppId,
	validateAndSanitizeSecretKey,
} from "../key-validation";
import { verifyAccessToken } from "../server";
import type { TokenResponse, User } from "../types";
import { clearAuthCookies, getAuthCookies, setAuthCookies } from "./cookies";

// =============================================================================
// Type Guards
// =============================================================================

/** Type guard for token response */
function isTokenResponse(data: unknown): data is TokenResponse {
	return (
		typeof data === "object" &&
		data !== null &&
		"accessToken" in data &&
		"refreshToken" in data &&
		"user" in data &&
		typeof (data as TokenResponse).accessToken === "string" &&
		typeof (data as TokenResponse).refreshToken === "string"
	);
}

// =============================================================================
// Configuration
// =============================================================================

// Configuration for server helpers (auto-configured from env vars)
let serverConfig: { secretKey: string; platformUrl: string } | null = null;

/**
 * Configure the SDK for server-side usage
 *
 * NOTE: This is optional! The SDK auto-configures from environment variables:
 * - SYLPHX_SECRET_KEY (required)
 * - SYLPHX_PLATFORM_URL (optional, defaults to https://sylphx.com)
 *
 * Use this only if you need to override the default configuration.
 *
 * @example
 * ```ts
 * // Optional: Override default configuration
 * import { configureServer } from '@sylphx/sdk/nextjs'
 *
 * configureServer({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 *   platformUrl: 'https://custom.sylphx.com',
 * })
 * ```
 */
export function configureServer(config: {
	secretKey: string;
	platformUrl?: string;
}) {
	// Validate and sanitize secret key using SSOT
	const secretKey = validateAndSanitizeSecretKey(config.secretKey);
	serverConfig = {
		secretKey,
		platformUrl: (config.platformUrl || DEFAULT_PLATFORM_URL).trim(),
	};
}

/**
 * Get server configuration
 *
 * Auto-configures from environment variables if not explicitly configured.
 * This follows the Clerk/Auth0 pattern where SDK auto-initializes from env vars.
 */
function getConfig(): { secretKey: string; platformUrl: string } | null {
	// Return cached config if already set
	if (serverConfig) {
		return serverConfig;
	}

	// Auto-configure from environment variables (Clerk/Auth0 pattern)
	const rawSecretKey = process.env.SYLPHX_SECRET_KEY;
	if (!rawSecretKey) {
		// No secret key configured - cannot authenticate
		// This is expected for public pages that don't need auth
		return null;
	}

	try {
		const secretKey = validateAndSanitizeSecretKey(rawSecretKey);
		const platformUrl = (
			process.env.SYLPHX_PLATFORM_URL || DEFAULT_PLATFORM_URL
		).trim();

		// Cache the auto-configured settings
		serverConfig = { secretKey, platformUrl };
		return serverConfig;
	} catch (error) {
		// Invalid secret key format - log warning and return null
		console.warn("[Sylphx] Invalid SYLPHX_SECRET_KEY format:", error);
		return null;
	}
}

/**
 * Derive a stable cookie namespace from the secret key prefix.
 * Uses the SSOT getCookieNamespace function from key-validation.
 */
function getCookieNamespace(): string {
	const config = getConfig();
	if (!config) return "sylphx";
	return getCookieNamespaceFromKey(config.secretKey);
}

// =============================================================================
// Auth Types
// =============================================================================

/**
 * Auth state returned by auth()
 */
export interface AuthResult {
	userId: string | null;
	user: User | null;
	/** Session token (for internal use only - not exposed to client) */
	sessionToken: string | null;
}

// =============================================================================
// Core Auth Function
// =============================================================================

/**
 * Get the current auth state (memoized per request)
 *
 * This is the primary way to check authentication in Server Components.
 * It reads from HttpOnly cookies and refreshes if needed.
 *
 * @example
 * ```ts
 * // In a Server Component
 * import { auth } from '@sylphx/platform-sdk/nextjs'
 *
 * export default async function Dashboard() {
 *   const { userId, user } = await auth()
 *
 *   if (!userId) {
 *     redirect('/login')
 *   }
 *
 *   return <div>Hello, {user?.name}</div>
 * }
 * ```
 */
export const auth = cache(async (): Promise<AuthResult> => {
	const config = getConfig();

	// SDK not configured - return unauthenticated state
	if (!config) {
		return { userId: null, user: null, sessionToken: null };
	}

	const namespace = getCookieNamespace();
	const { sessionToken, refreshToken, user, expiresAt } =
		await getAuthCookies(namespace);

	// No tokens at all
	if (!sessionToken && !refreshToken) {
		return { userId: null, user: null, sessionToken: null };
	}

	// Session token exists and not expired (with 30 second buffer)
	if (
		sessionToken &&
		expiresAt &&
		expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS
	) {
		// Verify token is valid
		try {
			const payload = await verifyAccessToken(sessionToken, config);
			return {
				userId: payload.sub,
				user: user || {
					id: payload.sub,
					email: payload.email,
					name: payload.name || null,
					image: payload.picture || null,
					emailVerified: payload.email_verified,
				},
				sessionToken,
			};
		} catch {
			// Token verification failed - treat as expired
		}
	}

	// Session expired but have refresh token + user data from cookie
	// NOTE: We don't refresh here because cookies can only be modified in Route Handlers.
	// The middleware handles token refresh. If we get here during SSR with expired session
	// but valid user cookie, we trust the user cookie (it was set when tokens were valid).
	if (refreshToken && user && expiresAt) {
		// User cookie hasn't expired yet (same lifetime as session)
		if (expiresAt > Date.now()) {
			return {
				userId: user.id,
				user,
				sessionToken: sessionToken || null, // May be expired, but user data is valid
			};
		}
	}

	// No valid session - return unauthenticated
	// NOTE: We don't clear cookies here because cookies can only be modified in Route Handlers.
	// The middleware will clear invalid cookies on next request.
	return { userId: null, user: null, sessionToken: null };
});

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Get the current user (null if not logged in)
 *
 * @example
 * ```ts
 * import { currentUser } from '@sylphx/platform-sdk/nextjs'
 *
 * export default async function Header() {
 *   const user = await currentUser()
 *   if (!user) return <SignIn />
 *   return <span>Hello, {user.name}</span>
 * }
 * ```
 */
export async function currentUser(): Promise<User | null> {
	const { user } = await auth();
	return user;
}

/**
 * Get the current user ID (null if not logged in)
 */
export async function currentUserId(): Promise<string | null> {
	const { userId } = await auth();
	return userId;
}

// =============================================================================
// OAuth Callback Handler
// =============================================================================

/**
 * Handle OAuth callback - exchange code for tokens and set cookies
 *
 * NOTE: With createSylphxMiddleware(), this is handled automatically.
 * You don't need to create manual /api/auth/* routes.
 *
 * This function is exported for advanced use cases where you need
 * custom callback handling outside of the middleware flow.
 *
 * @example
 * ```ts
 * // Using middleware (recommended - zero manual routes)
 * import { createSylphxMiddleware } from '@sylphx/sdk/nextjs'
 * export default createSylphxMiddleware({ publicRoutes: ['/', '/about'] })
 *
 * // Middleware automatically handles /auth/callback
 * ```
 */
export async function handleCallback(code: string): Promise<User> {
	const config = getConfig();
	if (!config) {
		throw new Error(
			"Sylphx SDK not configured. Set SYLPHX_SECRET_KEY environment variable.",
		);
	}

	const response = await fetch(`${config.platformUrl}/api/auth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			grant_type: "authorization_code",
			code,
			client_secret: config.secretKey,
		}),
	});

	if (!response.ok) {
		const errorData = (await response
			.json()
			.catch(() => ({ error: "Token exchange failed" }))) as { error?: string };
		throw new Error(errorData.error || "Token exchange failed");
	}

	const data: unknown = await response.json();
	if (!isTokenResponse(data)) {
		throw new Error("Invalid token response format");
	}

	const namespace = getCookieNamespace();
	await setAuthCookies(namespace, data);

	return data.user;
}

// =============================================================================
// Sign Out
// =============================================================================

/**
 * Sign out - clear cookies and optionally revoke token
 *
 * NOTE: With createSylphxMiddleware(), signout is handled automatically
 * at /auth/signout. No manual route needed.
 *
 * This function is exported for advanced use cases.
 *
 * @example
 * ```ts
 * // Using middleware (recommended)
 * // Navigate users to /auth/signout - middleware handles everything
 * <a href="/auth/signout">Sign Out</a>
 * ```
 */
export async function signOut(): Promise<void> {
	const config = getConfig();

	// SDK not configured - nothing to sign out from
	if (!config) {
		return;
	}

	const namespace = getCookieNamespace();
	const { refreshToken } = await getAuthCookies(namespace);

	// Revoke token on platform
	if (refreshToken) {
		try {
			await fetch(`${config.platformUrl}/api/auth/revoke`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					token: refreshToken,
					client_secret: config.secretKey,
				}),
			});
		} catch {
			// Ignore revocation errors
		}
	}

	// Clear all auth cookies
	await clearAuthCookies(namespace);
}

// =============================================================================
// Token Sync (Server Action)
// =============================================================================

/**
 * Sync tokens to cookies (server action)
 *
 * NOTE: With createSylphxMiddleware(), OAuth callbacks are handled
 * automatically at /auth/callback. This function is rarely needed.
 *
 * Use only for edge cases like custom OAuth providers not going
 * through the standard flow.
 */
export async function syncAuthToCookies(tokens: TokenResponse): Promise<void> {
	"use server";
	const namespace = getCookieNamespace();
	await setAuthCookies(namespace, tokens);
}

// =============================================================================
// Authorization URL
// =============================================================================

/**
 * Get authorization URL for OAuth redirect
 */
export function getAuthorizationUrl(options?: {
	redirectUri?: string;
	mode?: "login" | "signup";
	state?: string;
	appId?: string;
}): string {
	const config = getConfig();
	if (!config) {
		throw new Error(
			"Sylphx SDK not configured. Set SYLPHX_SECRET_KEY environment variable.",
		);
	}

	const rawClientId = options?.appId || process.env.NEXT_PUBLIC_SYLPHX_APP_ID;
	if (!rawClientId) {
		throw new Error(
			"App ID is required for authorization URL. Set NEXT_PUBLIC_SYLPHX_APP_ID.",
		);
	}

	// Validate and sanitize app ID using SSOT
	const clientId = validateAndSanitizeAppId(rawClientId);

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: options?.redirectUri || "/",
		response_type: "code",
	});

	if (options?.mode === "signup") {
		params.set("mode", "signup");
	}

	if (options?.state) {
		params.set("state", options.state);
	}

	return `${config.platformUrl}/auth/authorize?${params}`;
}

// =============================================================================
// Session Token Access (BFF Pattern)
// =============================================================================

/**
 * Get the current session token for API calls
 *
 * This is for apps that need to call third-party APIs with the session token.
 * For same-origin API calls, cookies are sent automatically.
 *
 * @example
 * ```ts
 * // In an API route that needs to call external APIs
 * import { getSessionToken } from '@sylphx/platform-sdk/nextjs'
 *
 * export async function GET() {
 *   const token = await getSessionToken()
 *   if (!token) {
 *     return new Response('Unauthorized', { status: 401 })
 *   }
 *
 *   // Call third-party API
 *   const response = await fetch('https://api.example.com/data', {
 *     headers: { Authorization: `Bearer ${token}` }
 *   })
 *   // ...
 * }
 * ```
 */
export async function getSessionToken(): Promise<string | null> {
	const { sessionToken } = await auth();
	return sessionToken;
}
