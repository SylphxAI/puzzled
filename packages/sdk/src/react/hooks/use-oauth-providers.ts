/**
 * useOAuthProviders Hook
 *
 * Returns the list of OAuth providers enabled for the current app.
 *
 * **Architecture (Server-First):**
 * When `config` is provided to SylphxProvider, OAuth providers are read from
 * the config context (no client-side fetch). When config is not provided,
 * falls back to React Query fetch.
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
import { ConfigContext } from './use-config'

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
	/** Refetch providers (no-op when using server config) */
	refetch: () => void
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook to get enabled OAuth providers for the current app
 *
 * When config is provided to SylphxProvider, reads from context (instant, no fetch).
 * Otherwise falls back to React Query fetch.
 */
export function useOAuthProviders(): UseOAuthProvidersReturn {
	const platformContext = useContext(PlatformContext)
	const config = useContext(ConfigContext)

	const platformUrl = platformContext?.platformUrl ?? ''
	const publishableKey = platformContext?.publishableKey ?? ''
	const isConfigured = Boolean(platformUrl && publishableKey)

	// When config is provided, we already have the providers - no fetch needed
	const hasConfigProviders = Boolean(config?.oauthProviders)

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
		// Skip fetch when config provides the data
		enabled: isConfigured && !hasConfigProviders,
		staleTime: 5 * 60 * 1000, // 5 minutes - providers don't change often
		gcTime: 30 * 60 * 1000, // 30 minutes cache
		retry: 2,
	})

	// Use config providers if available, otherwise use query data
	const providerDetails: EnabledProvider[] = hasConfigProviders && config
		? (config.oauthProviders as EnabledProvider[])
		: (data?.providers ?? [])
	const providers = providerDetails.map((p) => p.id)

	return {
		providers,
		providerDetails,
		// No loading when config provides the data
		isLoading: hasConfigProviders ? false : isLoading,
		error: hasConfigProviders ? null : (error as Error | null),
		refetch: hasConfigProviders ? () => {} : refetch,
	}
}
