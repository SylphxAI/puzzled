'use client'

/**
 * Sylphx Platform Provider Wrapper
 *
 * Wraps the app with SylphxProvider when publishable key is configured.
 *
 * Architecture:
 * - Server-first config: getAppConfig() fetches all config in Server Components
 * - Sylphx Platform handles ALL auth (email, OAuth, 2FA, sessions)
 * - Sylphx Platform handles ALL billing (subscriptions, checkout, portal)
 * - Sylphx Platform handles feature flags (gradual rollouts, A/B testing)
 * - App contains business logic only (games, streaks, achievements)
 */

import type { AppConfig } from '@sylphx/sdk/react'
import { FeatureFlagProvider, SylphxProvider, useSafeBilling, useSafeUser } from '@sylphx/sdk/react'
import type * as React from 'react'
import { MINUTE_MS } from '@/lib/constants/time'

interface PlatformProviderProps {
	children: React.ReactNode
	/** Sylphx Publishable Key (required when using Sylphx) */
	appId: string
	/** Server-fetched config via getAppConfig() (required) */
	config: AppConfig
	/** Platform URL (optional, defaults to https://sylphx.com) */
	platformUrl?: string
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

export function PlatformProvider({ children, appId, config, platformUrl }: PlatformProviderProps) {
	return (
		<SylphxProvider
			appId={appId}
			config={config}
			platformUrl={platformUrl}
			afterSignOutUrl="/login"
		>
			<FeatureFlagWrapper>{children}</FeatureFlagWrapper>
		</SylphxProvider>
	)
}
