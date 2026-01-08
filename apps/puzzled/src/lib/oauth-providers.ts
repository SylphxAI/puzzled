/**
 * OAuth Provider Configuration
 * Single source of truth for all OAuth provider settings
 */

/**
 * Environment variable names for each OAuth provider
 * Used by backend to check which providers are enabled
 */
export const OAUTH_PROVIDER_ENV_VARS = {
	google: { clientId: 'GOOGLE_CLIENT_ID', clientSecret: 'GOOGLE_CLIENT_SECRET' },
	apple: { clientId: 'APPLE_CLIENT_ID', clientSecret: 'APPLE_CLIENT_SECRET' },
	facebook: { clientId: 'FACEBOOK_CLIENT_ID', clientSecret: 'FACEBOOK_CLIENT_SECRET' },
	github: { clientId: 'GITHUB_CLIENT_ID', clientSecret: 'GITHUB_CLIENT_SECRET' },
	discord: { clientId: 'DISCORD_CLIENT_ID', clientSecret: 'DISCORD_CLIENT_SECRET' },
	microsoft: { clientId: 'MICROSOFT_CLIENT_ID', clientSecret: 'MICROSOFT_CLIENT_SECRET' },
	twitter: { clientId: 'TWITTER_CLIENT_ID', clientSecret: 'TWITTER_CLIENT_SECRET' },
	twitch: { clientId: 'TWITCH_CLIENT_ID', clientSecret: 'TWITCH_CLIENT_SECRET' },
	steam: { clientId: 'STEAM_API_KEY', clientSecret: 'STEAM_API_KEY' }, // Steam uses single API key
} as const

export type OAuthProviderKey = keyof typeof OAUTH_PROVIDER_ENV_VARS

/**
 * Check which OAuth providers are enabled based on environment variables
 * Server-side only - do not import in client components
 */
export function getEnabledOAuthProviders(): Record<OAuthProviderKey, boolean> {
	const enabled = {} as Record<OAuthProviderKey, boolean>
	for (const [provider, envVars] of Object.entries(OAUTH_PROVIDER_ENV_VARS)) {
		enabled[provider as OAuthProviderKey] = !!(
			process.env[envVars.clientId] && process.env[envVars.clientSecret]
		)
	}
	return enabled
}

/**
 * Get social providers config for Better Auth
 * Server-side only - returns credentials for enabled providers
 */
export function getBetterAuthSocialProviders(): Record<
	string,
	{ clientId: string; clientSecret: string }
> {
	const providers: Record<string, { clientId: string; clientSecret: string }> = {}

	for (const [provider, envVars] of Object.entries(OAUTH_PROVIDER_ENV_VARS)) {
		const clientId = process.env[envVars.clientId]
		const clientSecret = process.env[envVars.clientSecret]

		if (clientId && clientSecret) {
			providers[provider] = { clientId, clientSecret }
		}
	}

	return providers
}

/**
 * Get human-readable display name for an OAuth provider
 */
export function getOAuthProviderDisplayName(providerId: string): string {
	const displayNames: Record<string, string> = {
		google: 'Google',
		apple: 'Apple',
		facebook: 'Facebook',
		github: 'GitHub',
		discord: 'Discord',
		microsoft: 'Microsoft',
		twitter: 'Twitter',
		twitch: 'Twitch',
		steam: 'Steam',
	}
	return displayNames[providerId] ?? providerId
}
