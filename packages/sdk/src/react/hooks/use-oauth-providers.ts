/**
 * useOAuthProviders Hook
 *
 * Returns the list of OAuth providers enabled for the current app.
 * Reads directly from server-fetched config (no client-side fetching).
 *
 * @example
 * ```tsx
 * function LoginPage() {
 *   const { providers } = useOAuthProviders()
 *
 *   return (
 *     <div>
 *       {providers.map(provider => (
 *         <OAuthButton key={provider} provider={provider} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */

"use client";

import type { OAuthProvider } from "@sylphx/ui";
import { useConfig } from "./use-config";

// ============================================
// Types
// ============================================

export interface EnabledProvider {
	id: OAuthProvider;
	name: string;
}

export interface UseOAuthProvidersReturn {
	/** List of enabled OAuth provider IDs */
	providers: OAuthProvider[];
	/** Full provider info with names */
	providerDetails: EnabledProvider[];
	/** Always false - no client-side loading */
	isLoading: false;
	/** Always null - no client-side errors */
	error: null;
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook to get enabled OAuth providers for the current app
 *
 * Reads directly from server-fetched config (instant, no loading state).
 */
export function useOAuthProviders(): UseOAuthProvidersReturn {
	const config = useConfig();
	const providerDetails = config.oauthProviders as EnabledProvider[];
	const providers = providerDetails.map((p) => p.id);

	return {
		providers,
		providerDetails,
		isLoading: false,
		error: null,
	};
}
