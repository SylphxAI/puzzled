import { unstable_cache } from 'next/cache'
import { authConfig, socialProviders } from './client-auth'
import { type AppConfig, DEST_CONSENT_PURPOSES, EMPTY_APP_CONFIG } from './dest'

/** Identity config changes rarely; one fetch serves every request for 5 minutes. */
const APP_CONFIG_TTL_SECONDS = 300

async function fetchOAuthProviders(): Promise<string[]> {
	const config = authConfig()
	return config ? socialProviders(config) : []
}

export async function getAppConfig(_opts?: {
	secretKey?: string
	appId?: string
	platformUrl?: string
}): Promise<AppConfig> {
	/*
	 * Cached for five minutes. A loader that fails throws, so an outage is
	 * never cached: the next request tries again, and this one falls back to an
	 * empty list.
	 */
	const oauthProviders = await unstable_cache(
		fetchOAuthProviders,
		['identity-app-config', 'oauth-providers'],
		{ revalidate: APP_CONFIG_TTL_SECONDS },
	)().catch(() => [] as string[])

	return {
		...EMPTY_APP_CONFIG,
		consentTypes: [...DEST_CONSENT_PURPOSES],
		oauthProviders,
		app: {
			id: _opts?.appId?.trim() || 'puzzled',
			name: 'Puzzled',
			slug: 'puzzled',
		},
		fetchedAt: new Date().toISOString(),
	}
}

export async function getOAuthProviders(_opts?: { appId?: string }): Promise<string[]> {
	return (await getAppConfig({ appId: _opts?.appId })).oauthProviders
}

export type OAuthProvider = string
