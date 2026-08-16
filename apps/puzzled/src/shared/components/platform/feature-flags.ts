import type { AppConfig } from '@sylphx/sdk/react'

/**
 * Adapt the server-fetched Platform definitions to the SDK's simple flag
 * context. The Platform response is the only authority; the web app does not
 * fetch or synthesize a second flag set.
 */
export function toInitialFeatureFlags(config: Pick<AppConfig, 'featureFlags'>) {
	return config.featureFlags.map(({ key, enabled }) => ({
		key,
		value: enabled,
		enabled,
	}))
}
