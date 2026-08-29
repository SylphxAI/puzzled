import { cookies } from 'next/headers'
import { destIdentityJson, destIdentityOrigin, type IdentitySession } from './dest'

export const IDENTITY_API_ORIGIN = destIdentityOrigin()
const SESSION_COOKIE = 'sylphx_identity_session'

export type IdentityUser = {
	id: string
	email?: string
	name?: string | null
	image?: string | null
	emailVerified?: boolean
	createdAt?: string
	role?: string | null
}

function identityOrigin(): string {
	return destIdentityOrigin(process.env.IDENTITY_API_ORIGIN)
}

export async function currentUser(): Promise<IdentityUser | null> {
	const token = (await cookies()).get(SESSION_COOKIE)?.value
	if (!token) return null
	try {
		const current = await destIdentityJson<{ session: IdentitySession }>(
			identityOrigin(),
			'/v1/sessions/current',
			{
				sessionToken: token,
				projectBinding: process.env.SYLPHX_PROJECT_BINDING,
			},
		)
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

export async function auth(): Promise<{
	user: IdentityUser | null
	sessionToken?: string
	userId?: string
}> {
	const user = await currentUser()
	const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value
	return { user, sessionToken, userId: user?.id }
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
