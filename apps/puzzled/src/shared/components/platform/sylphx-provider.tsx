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
import { FeatureFlagProvider, SylphxProvider } from '@sylphx/sdk/react'
import type * as React from 'react'
import { toInitialFeatureFlags } from './feature-flags'

interface PlatformProviderProps {
	children: React.ReactNode
	/** Sylphx Publishable Key (required when using Sylphx) */
	appId: string
	/** Server-fetched config via getAppConfig() (required) */
	config: AppConfig
	/** Platform URL (optional, defaults to https://sylphx.com) */
	platformUrl?: string
}

function FeatureFlagWrapper({
	children,
	config,
}: {
	children: React.ReactNode
	config: AppConfig
}) {
	// An empty Platform catalog is a valid fail-closed state. The SDK's legacy
	// provider fetches its default local endpoint when initialFlags is empty,
	// which would recreate the deleted local REST authority.
	if (config.featureFlags.length === 0) return <>{children}</>

	return (
		<FeatureFlagProvider
			initialFlags={toInitialFeatureFlags(config)}
			refreshInterval={0}
			enableCache={false}
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
			<FeatureFlagWrapper config={config}>{children}</FeatureFlagWrapper>
		</SylphxProvider>
	)
}
