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

import type * as React from 'react'
import type { CommercePremium } from '@/lib/identity'
import type { AppConfig } from '@/lib/identity/react'
import { SylphxProvider } from '@/lib/identity/react'

interface PlatformProviderProps {
	children: React.ReactNode
	/** Sylphx Publishable Key (required when using Sylphx) */
	appId: string
	/** Server-fetched config via getAppConfig() (required) */
	config: AppConfig
	/** Platform URL (optional, defaults to https://sylphx.com) */
	platformUrl?: string
	/**
	 * The server-resolved entitlement snapshot for this request (null when the
	 * request has no account or the read did not answer; the client renders
	 * fail-closed). Never resolved in the browser.
	 */
	billing?: CommercePremium | null
}

export function PlatformProvider({
	children,
	appId,
	config,
	platformUrl,
	billing,
}: PlatformProviderProps) {
	return (
		<SylphxProvider
			appId={appId}
			config={config}
			platformUrl={platformUrl}
			billing={billing}
			afterSignOutUrl="/login"
		>
			{children}
		</SylphxProvider>
	)
}
