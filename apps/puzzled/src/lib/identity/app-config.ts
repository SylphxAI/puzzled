import { unstable_cache } from 'next/cache'
import { env } from '../env'
import { destIdentityCredential } from './credentials'
import {
	type AppConfig,
	DEST_CONSENT_PURPOSES,
	destIdentityJson,
	destIdentityOrigin,
	EMPTY_APP_CONFIG,
} from './dest'

/** Identity config changes rarely; one fetch serves every request for 5 minutes. */
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

export async function getAppConfig(_opts?: {
	secretKey?: string
	appId?: string
	platformUrl?: string
}): Promise<AppConfig> {
	const identityOrigin = destIdentityOrigin(_opts?.platformUrl ?? env.IDENTITY_API_ORIGIN)
	/*
	 * Cached for five minutes. A loader that fails throws, so an outage is
	 * never cached: the next request tries again, and this one falls back to an
	 * empty list.
	 */
	const oauthProviders = await unstable_cache(
		fetchOAuthProviders,
		['identity-app-config', 'oauth-providers'],
		{ revalidate: APP_CONFIG_TTL_SECONDS },
	)(identityOrigin).catch(() => [] as string[])

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
