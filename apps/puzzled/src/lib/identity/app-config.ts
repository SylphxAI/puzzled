import { unstable_cache } from 'next/cache'
import { env } from '../env'
import { destCommerceCredential, destIdentityCredential } from './credentials'
import {
	type AppConfig,
	DEST_CONSENT_PURPOSES,
	destIdentityJson,
	destIdentityOrigin,
	EMPTY_APP_CONFIG,
} from './dest'
import { getPlans } from './index'

/** Identity and commerce config changes rarely; one fetch serves every request for 5 minutes. */
const APP_CONFIG_TTL_SECONDS = 300

function parseFederations(body: { providers?: unknown[]; federations?: unknown[] }): string[] {
	return (body.providers ?? body.federations ?? []).flatMap((entry) => {
		if (typeof entry === 'string' && entry.trim()) return [entry.trim()]
		if (!entry || typeof entry !== 'object') return []
		const record = entry as Record<string, unknown>
		for (const key of ['federation_id', 'federationId', 'provider', 'issuer']) {
			const value = record[key]
			if (typeof value === 'string' && value.trim()) return [value.trim()]
		}
		return []
	})
}

async function fetchOAuthProviders(identityOrigin: string): Promise<string[]> {
	const credential = destIdentityCredential()
	if (!credential) return []
	const body = await destIdentityJson<{ providers?: unknown[]; federations?: unknown[] }>(
		identityOrigin,
		'/v1/oidc/federations:list',
		{ method: 'POST', credential, body: { cursor: '', limit: 32 } },
	)
	return parseFederations(body)
}

async function fetchPlans() {
	return destCommerceCredential() ? getPlans() : []
}

export async function getAppConfig(_opts?: {
	secretKey?: string
	appId?: string
	platformUrl?: string
}): Promise<AppConfig> {
	const identityOrigin = destIdentityOrigin(_opts?.platformUrl ?? env.IDENTITY_API_ORIGIN)
	/*
	 * Both reads run in parallel and are cached for five minutes. A loader that
	 * fails throws, so an outage is never cached: the next request tries again,
	 * and this one falls back to an empty list.
	 */
	const cacheOptions = { revalidate: APP_CONFIG_TTL_SECONDS }
	const [oauthProviders, plans] = await Promise.all([
		unstable_cache(
			fetchOAuthProviders,
			['identity-app-config', 'oauth-providers'],
			cacheOptions,
		)(identityOrigin).catch(() => [] as string[]),
		unstable_cache(fetchPlans, ['identity-app-config', 'plans'], cacheOptions)().catch(() => []),
	])

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
