'use client'

/**
 * Sylphx Platform Provider Wrapper
 *
 * Wraps the app with SylphxProvider when SYLPHX_APP_ID is configured.
 *
 * Architecture:
 * - Sylphx Platform handles ALL auth (email, OAuth, 2FA, sessions)
 * - Sylphx Platform handles ALL billing (subscriptions, checkout, portal)
 * - App contains business logic only (games, streaks, achievements)
 */

import { SylphxProvider } from '@sylphx/platform-sdk/react'

interface PlatformProviderProps {
	children: React.ReactNode
	/** Sylphx App ID (from NEXT_PUBLIC_SYLPHX_APP_ID env var) */
	appId?: string
	/** Sylphx Platform URL (from NEXT_PUBLIC_SYLPHX_PLATFORM_URL env var) */
	platformUrl?: string
}

export function PlatformProvider({ children, appId, platformUrl }: PlatformProviderProps) {
	// If Sylphx is not configured, just render children
	if (!appId) {
		return <>{children}</>
	}

	return (
		<SylphxProvider
			appId={appId}
			platformUrl={platformUrl || 'https://sylphx.com'}
			afterSignOutUrl="/login"
		>
			{children}
		</SylphxProvider>
	)
}
