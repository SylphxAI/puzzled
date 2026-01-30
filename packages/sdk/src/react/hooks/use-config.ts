/**
 * Config Hooks
 *
 * Hooks for accessing server-fetched configuration data.
 * Config is passed to SylphxProvider from Server Components via getAppConfig().
 *
 * This eliminates client-side config fetching and the associated:
 * - Loading states
 * - staleTime tuning
 * - Delayed updates after admin changes
 */

'use client'

import { createContext, useContext } from 'react'
import type { AppConfig, OAuthProviderInfo, FeatureFlagDefinition, AppMetadata } from '../../types'
import type { Plan } from '../../billing'
import type { ConsentType } from '../../consent'
import { PlatformContext } from '../platform-context'

// ============================================
// Config Context
// ============================================

/**
 * Context for server-fetched configuration
 */
export const ConfigContext = createContext<AppConfig | null>(null)

/**
 * Hook to get the full app config
 *
 * @throws Error if used outside SylphxProvider
 *
 * @example
 * ```tsx
 * function Debug() {
 *   const config = useConfig()
 *   console.log('Config fetched at:', config.fetchedAt)
 *   return <pre>{JSON.stringify(config, null, 2)}</pre>
 * }
 * ```
 */
export function useConfig(): AppConfig {
	const config = useContext(ConfigContext)
	if (!config) {
		throw new Error('useConfig must be used within a SylphxProvider with config prop')
	}
	return config
}

/**
 * Safe version of useConfig that returns null outside provider
 */
export function useSafeConfig(): AppConfig | null {
	return useContext(ConfigContext)
}

// ============================================
// Derived Config Hooks
// ============================================

/**
 * Get subscription plans
 *
 * Reads from:
 * 1. ConfigContext (if config was provided to SylphxProvider)
 * 2. PlatformContext (fallback to React Query data)
 *
 * @example
 * ```tsx
 * function PricingTable() {
 *   const plans = usePlans()
 *   return plans.map(plan => <PlanCard key={plan.id} plan={plan} />)
 * }
 * ```
 */
export function usePlans(): Plan[] {
	const config = useSafeConfig()
	const platform = useContext(PlatformContext)

	// Prefer config (server-fetched), fall back to platform context (React Query)
	if (config?.plans) {
		return config.plans
	}
	return platform?.plans ?? []
}

/**
 * Safe version - returns empty array outside provider
 */
export function useSafePlans(): Plan[] {
	const config = useSafeConfig()
	const platform = useContext(PlatformContext)
	return config?.plans ?? platform?.plans ?? []
}

/**
 * Get enabled OAuth providers from config
 *
 * Note: For most use cases, prefer the `useOAuthProviders` hook from the
 * main SDK exports which also handles the fallback to React Query.
 *
 * @example
 * ```tsx
 * function OAuthButtons() {
 *   const providers = useConfigOAuthProviders()
 *   return providers.map(p => <OAuthButton key={p.id} provider={p.id} />)
 * }
 * ```
 */
export function useOAuthProviders(): OAuthProviderInfo[] {
	const config = useSafeConfig()
	return config?.oauthProviders ?? []
}

/**
 * Safe version - returns empty array outside provider
 */
export function useSafeOAuthProviders(): OAuthProviderInfo[] {
	const config = useSafeConfig()
	return config?.oauthProviders ?? []
}

/**
 * Get consent types from config
 *
 * @example
 * ```tsx
 * function CookieBanner() {
 *   const types = useConsentTypes()
 *   return types.map(type => <ConsentToggle key={type.id} type={type} />)
 * }
 * ```
 */
export function useConsentTypes(): ConsentType[] {
	const config = useSafeConfig()
	return config?.consentTypes ?? []
}

/**
 * Safe version - returns empty array outside provider
 */
export function useSafeConsentTypes(): ConsentType[] {
	const config = useSafeConfig()
	return config?.consentTypes ?? []
}

/**
 * Get feature flag definitions from config
 *
 * Note: For flag evaluation, use useFlag() or useFeatureFlag() instead.
 * This hook returns raw definitions, not evaluated values.
 *
 * @example
 * ```tsx
 * function FlagsDebug() {
 *   const flags = useFeatureFlagDefinitions()
 *   return flags.map(f => <FlagRow key={f.key} flag={f} />)
 * }
 * ```
 */
export function useFeatureFlagDefinitions(): FeatureFlagDefinition[] {
	const config = useSafeConfig()
	return config?.featureFlags ?? []
}

/**
 * Safe version - returns empty array outside provider
 */
export function useSafeFeatureFlagDefinitions(): FeatureFlagDefinition[] {
	const config = useSafeConfig()
	return config?.featureFlags ?? []
}

/**
 * Get app metadata from config
 *
 * @throws Error if config is not provided (use useSafeAppMetadata for safe version)
 *
 * @example
 * ```tsx
 * function AppInfo() {
 *   const app = useAppMetadata()
 *   return <span>{app.name}</span>
 * }
 * ```
 */
export function useAppMetadata(): AppMetadata {
	const config = useSafeConfig()
	if (!config?.app) {
		throw new Error('useAppMetadata requires config to be provided to SylphxProvider')
	}
	return config.app
}

/**
 * Safe version - returns empty metadata outside provider
 */
export function useSafeAppMetadata(): AppMetadata | null {
	const config = useSafeConfig()
	return config?.app ?? null
}

// Re-export types
export type { AppConfig, OAuthProviderInfo, FeatureFlagDefinition, AppMetadata }
export type { Plan }
export type { ConsentType }
