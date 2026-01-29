/**
 * useOAuthProviders Hook
 *
 * Fetches the list of OAuth providers enabled for the current app.
 * Uses React Query for caching with 5-minute stale time.
 *
 * @example
 * ```tsx
 * function LoginPage() {
 *   const { providers, isLoading } = useOAuthProviders()
 *
 *   if (isLoading) return <Spinner />
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

'use client'

import { useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { OAuthProvider } from '@sylphx/ui'
import { PlatformContext } from '../platform-context'

// ============================================
// Types
// ============================================

export interface EnabledProvider {
	id: OAuthProvider
	name: string
}

export interface UseOAuthProvidersReturn {
	/** List of enabled OAuth provider IDs */
	providers: OAuthProvider[]
	/** Full provider info with names */
	providerDetails: EnabledProvider[]
	/** Loading state */
	isLoading: boolean
	/** Error if fetch failed */
	error: Error | null
	/** Refetch providers */
	refetch: () => void
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook to fetch enabled OAuth providers for the current app
 */
export function useOAuthProviders(): UseOAuthProvidersReturn {
	const platformContext = useContext(PlatformContext)

	const platformUrl = platformContext?.platformUrl ?? ''
	const publishableKey = platformContext?.publishableKey ?? ''
	const isConfigured = Boolean(platformUrl && publishableKey)

	const { data, isLoading, error, refetch } = useQuery<{ providers: EnabledProvider[] }>({
		queryKey: ['oauth-providers', publishableKey],
		queryFn: async () => {
			if (!isConfigured) {
				return { providers: [] }
			}

			const response = await fetch(`${platformUrl}/api/auth/providers`, {
				headers: { 'X-Publishable-Key': publishableKey },
			})

			if (!response.ok) {
				throw new Error('Failed to fetch OAuth providers')
			}

			return response.json()
		},
		enabled: isConfigured,
		staleTime: 5 * 60 * 1000, // 5 minutes - providers don't change often
		gcTime: 30 * 60 * 1000, // 30 minutes cache
		retry: 2,
	})

	const providerDetails = data?.providers ?? []
	const providers = providerDetails.map((p) => p.id)

	return {
		providers,
		providerDetails,
		isLoading,
		error: error as Error | null,
		refetch,
	}
}
