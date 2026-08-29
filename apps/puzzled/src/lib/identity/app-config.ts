import { destCommerceCredential, destIdentityCredential } from './credentials'
import {
	DEST_CONSENT_PURPOSES,
	EMPTY_APP_CONFIG,
	destIdentityJson,
	destIdentityOrigin,
	type AppConfig,
} from './dest'
import { getPlans } from './index'

export async function getAppConfig(_opts?: {
	secretKey?: string
	appId?: string
	platformUrl?: string
}): Promise<AppConfig> {
	const identityOrigin = destIdentityOrigin(_opts?.platformUrl ?? process.env.IDENTITY_API_ORIGIN)
	const identityCredential = destIdentityCredential()
	const oauthProviders = identityCredential
		? await destIdentityJson<{
				providers?: unknown[]
				federations?: unknown[]
			}>(identityOrigin, '/v1/oidc/federations:list', {
				method: 'POST',
				credential: identityCredential,
				body: { cursor: '', limit: 32 },
			})
				.then((body) =>
					(body.providers ?? body.federations ?? []).flatMap((entry) => {
						if (typeof entry === 'string' && entry.trim()) return [entry.trim()]
						if (!entry || typeof entry !== 'object') return []
						const record = entry as Record<string, unknown>
						for (const key of ['federation_id', 'federationId', 'provider', 'issuer']) {
							const value = record[key]
							if (typeof value === 'string' && value.trim()) return [value.trim()]
						}
						return []
					}),
				)
				.catch(() => [] as string[])
		: []

	const plans = destCommerceCredential() ? await getPlans().catch(() => []) : []

	return {
		...EMPTY_APP_CONFIG,
		plans,
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
