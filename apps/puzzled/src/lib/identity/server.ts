import { cookies } from 'next/headers'
import { IdentityClient } from '@sylphx/identity'

export const IDENTITY_API_ORIGIN = 'https://api.identity.sylphx.com'
const SESSION_COOKIE = 'sylphx_identity_session'

export type IdentityUser = {
	id: string
	email?: string
	name?: string | null
	image?: string | null
	emailVerified?: boolean
}

function identityOrigin(): string {
	const raw = process.env.IDENTITY_API_ORIGIN?.trim()
	if (!raw) return IDENTITY_API_ORIGIN
	try {
		if (new URL(raw).hostname.toLowerCase().endsWith('.api.sylphx.com')) {
			return IDENTITY_API_ORIGIN
		}
	} catch {
		return IDENTITY_API_ORIGIN
	}
	return raw.replace(/\/+$/, '')
}

export async function currentUser(): Promise<IdentityUser | null> {
	const token = (await cookies()).get(SESSION_COOKIE)?.value
	if (!token) return null
	try {
		const current = await new IdentityClient(identityOrigin(), {
			sessionToken: token,
			projectBinding: process.env.SYLPHX_PROJECT_BINDING,
		}).identitySessionCurrentGet({})
		const principal = current.session.principal
		return {
			id: principal.principalId,
			email: principal.primaryEmail,
			name: principal.displayName,
			emailVerified: principal.primaryEmailVerified,
		}
	} catch {
		return null
	}
}

export async function auth(): Promise<{ user: IdentityUser | null; sessionToken?: string }> {
	const user = await currentUser()
	const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value
	return { user, sessionToken }
}

export type AppConfig = {
	plans: never[]
	consentTypes: never[]
	oauthProviders: string[]
	featureFlags: never[]
	app: { id: string; name: string; slug: string }
	fetchedAt: string
}

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
