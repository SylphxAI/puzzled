'use client'

/**
 * Sylphx Platform Provider Wrapper
 *
 * Conditionally wraps the app with SylphxProvider when:
 * 1. SYLPHX_APP_ID is configured
 * 2. appId prop is provided
 *
 * This enables a hybrid auth setup where:
 * - BetterAuth handles local auth (email/password, OAuth)
 * - Sylphx Platform handles centralized auth (optional)
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
