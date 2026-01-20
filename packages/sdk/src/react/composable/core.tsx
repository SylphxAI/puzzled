/**
 * Sylphx Core Provider
 *
 * Provides configuration context to all child providers.
 * This is the foundation - all other providers depend on it.
 */

'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createConfig, type SylphxConfig } from '../../functions/config'

// ============================================================================
// Context
// ============================================================================

const SylphxConfigContext = createContext<SylphxConfig | null>(null)

// ============================================================================
// Provider
// ============================================================================

export interface SylphxCoreProps {
	children: ReactNode
	/** App ID (slug) */
	appId: string
	/** Secret key (publishable key for client, secret key for server) */
	secretKey: string
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string
}

/**
 * Core provider that supplies configuration to all Sylphx hooks and providers
 *
 * @example
 * ```tsx
 * <SylphxCore appId="my-app" secretKey={process.env.NEXT_PUBLIC_SYLPHX_KEY!}>
 *   <App />
 * </SylphxCore>
 * ```
 */
export function SylphxCore({
	children,
	appId,
	secretKey,
	platformUrl,
}: SylphxCoreProps) {
	const config = useMemo(
		() =>
			createConfig({
				appId,
				appSecret: secretKey,
				platformUrl,
			}),
		[appId, secretKey, platformUrl]
	)

	return (
		<SylphxConfigContext.Provider value={config}>
			{children}
		</SylphxConfigContext.Provider>
	)
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Get the Sylphx configuration
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const config = useSylphxConfig()
 *   // Use config with function-based SDK
 *   await signIn(config, { email, password })
 * }
 * ```
 */
export function useSylphxConfig(): SylphxConfig {
	const config = useContext(SylphxConfigContext)
	if (!config) {
		throw new Error('useSylphxConfig must be used within a SylphxCore provider')
	}
	return config
}
