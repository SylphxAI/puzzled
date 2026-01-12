'use client'

/**
 * Sylphx Platform Provider Wrapper
 *
 * Wraps the app with SylphxProvider when SYLPHX_APP_ID is configured.
 *
 * Architecture:
 * - Sylphx Platform handles ALL auth (email, OAuth, 2FA, sessions)
 * - Sylphx Platform handles ALL billing (subscriptions, checkout, portal)
 * - Sylphx Platform handles feature flags (gradual rollouts, A/B testing)
 * - App contains business logic only (games, streaks, achievements)
 */

import * as React from 'react'
import {
	SylphxProvider,
	FeatureFlagProvider,
	useSafeUser,
	useBilling,
} from '@sylphx/platform-sdk/react'

interface PlatformProviderProps {
	children: React.ReactNode
	/** Sylphx App ID (from NEXT_PUBLIC_SYLPHX_APP_ID env var) */
	appId?: string
	/** Sylphx Publishable Key (from NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY env var) */
	publishableKey?: string
}

/**
 * Inner component that has access to user context for feature flags
 */
function FeatureFlagWrapper({ children }: { children: React.ReactNode }) {
	const { user } = useSafeUser()
	const { subscription, isPremium } = useBilling()

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
			refreshInterval={5 * 60 * 1000} // Refresh every 5 minutes
			enableCache
		>
			{children}
		</FeatureFlagProvider>
	)
}

export function PlatformProvider({
	children,
	appId,
	publishableKey,
}: PlatformProviderProps) {
	// If Sylphx is not configured, just render children
	if (!appId || !publishableKey) {
		return <>{children}</>
	}

	return (
		<SylphxProvider
			appId={appId}
			publishableKey={publishableKey}
			afterSignOutUrl="/login"
		>
			<FeatureFlagWrapper>{children}</FeatureFlagWrapper>
		</SylphxProvider>
	)
}
