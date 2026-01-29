'use client'

/**
 * Sylphx Platform Provider Wrapper
 *
 * Wraps the app with SylphxProvider when publishable key is configured.
 *
 * Architecture:
 * - Sylphx Platform handles ALL auth (email, OAuth, 2FA, sessions)
 * - Sylphx Platform handles ALL billing (subscriptions, checkout, portal)
 * - Sylphx Platform handles feature flags (gradual rollouts, A/B testing)
 * - App contains business logic only (games, streaks, achievements)
 */

import { FeatureFlagProvider, SylphxProvider, useSafeBilling, useSafeUser } from '@sylphx/sdk/react'
import type * as React from 'react'
import { MINUTE_MS } from '@/lib/constants/time'

interface PlatformProviderProps {
	children: React.ReactNode
	/** Sylphx Publishable Key (from NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY env var) */
	publishableKey?: string
}

/**
 * Inner component that has access to user context for feature flags
 */
function FeatureFlagWrapper({ children }: { children: React.ReactNode }) {
	const { user } = useSafeUser()
	const { subscription, isPremium } = useSafeBilling()

	return (
		<FeatureFlagProvider
			endpoint="/api/flags"
			userContext={
				user
					? {
							userId: user.id,
							email: user.email ?? undefined,
							attributes: {
								isPremium,
								plan: subscription?.planSlug,
							},
						}
					: undefined
			}
			refreshInterval={5 * MINUTE_MS}
			enableCache
		>
			{children}
		</FeatureFlagProvider>
	)
}

export function PlatformProvider({ children, publishableKey }: PlatformProviderProps) {
	// If Sylphx is not configured, just render children
	if (!publishableKey) {
		return <>{children}</>
	}

	return (
		<SylphxProvider publishableKey={publishableKey} afterSignOutUrl="/login">
			<FeatureFlagWrapper>{children}</FeatureFlagWrapper>
		</SylphxProvider>
	)
}
