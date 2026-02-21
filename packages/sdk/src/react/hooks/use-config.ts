/**
 * Config Hooks
 *
 * Hooks for accessing server-fetched configuration data.
 * Config is required and passed to SylphxProvider from Server Components via getAppConfig().
 *
 * This eliminates client-side config fetching and the associated:
 * - Loading states
 * - staleTime tuning
 * - Delayed updates after admin changes
 */

"use client";

import { createContext, useContext } from "react";
import type { Plan } from "../../billing";
import type { ConsentType } from "../../consent";
import type {
	AppConfig,
	AppMetadata,
	FeatureFlagDefinition,
	OAuthProviderInfo,
} from "../../types";

// ============================================
// Config Context
// ============================================

/**
 * Context for server-fetched configuration (required)
 */
export const ConfigContext = createContext<AppConfig | null>(null);

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
	const config = useContext(ConfigContext);
	if (!config) {
		throw new Error("useConfig must be used within a SylphxProvider");
	}
	return config;
}

// ============================================
// Derived Config Hooks
// ============================================

/**
 * Get subscription plans from server-fetched config
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
	return useConfig().plans;
}

/**
 * Get enabled OAuth providers from config
 *
 * @example
 * ```tsx
 * function OAuthButtons() {
 *   const providers = useOAuthProviders()
 *   return providers.map(p => <OAuthButton key={p.id} provider={p.id} />)
 * }
 * ```
 */
export function useOAuthProviders(): OAuthProviderInfo[] {
	return useConfig().oauthProviders;
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
	return useConfig().consentTypes;
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
	return useConfig().featureFlags;
}

/**
 * Get app metadata from config
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
	return useConfig().app;
}

// Re-export types
export type {
	AppConfig,
	OAuthProviderInfo,
	FeatureFlagDefinition,
	AppMetadata,
};
export type { Plan };
export type { ConsentType };
