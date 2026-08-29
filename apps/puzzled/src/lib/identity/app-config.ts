import type { AppConfig } from './dest'

export async function getAppConfig(_opts?: {
	secretKey?: string
	appId?: string
	platformUrl?: string
}): Promise<AppConfig> {
	return {
		plans: [],
		consentTypes: [],
		oauthProviders: (process.env.IDENTITY_OIDC_PROVIDERS ?? '')
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean),
		featureFlags: [],
		app: { id: 'puzzled', name: 'Puzzled', slug: 'puzzled' },
		fetchedAt: new Date().toISOString(),
	}
}

export async function getOAuthProviders(_opts?: { appId?: string }): Promise<string[]> {
	return (await getAppConfig()).oauthProviders
}

export type OAuthProvider = string
