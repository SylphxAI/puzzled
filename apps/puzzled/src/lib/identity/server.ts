import { cookies, headers } from 'next/headers'
import { env } from '../env'
import { destIdentityCredential, destIdentityProjectId } from './credentials'
import {
	type AppConfig,
	destIdentityJson,
	destIdentityOrigin,
	destIdentityUser,
	type IdentityUser,
} from './dest'

export const AUTH_API_ORIGIN = destIdentityOrigin()
export const SESSION_COOKIE = 'sylphx_identity_session'
export type { IdentityUser }

function identityOrigin(): string {
	return destIdentityOrigin(env.SYLPHX_AUTH_URL)
}

export async function sessionToken(): Promise<string | undefined> {
	return (await cookies()).get(SESSION_COOKIE)?.value
}

/** The browser's User-Agent: Auth binds a session to it. */
export async function browserUserAgent(): Promise<string> {
	return (await headers()).get('user-agent')?.trim() || 'puzzled-web'
}

export async function currentUser(): Promise<IdentityUser | null> {
	const token = await sessionToken()
	if (!token) return null
	try {
		const current = await destIdentityJson(identityOrigin(), '/v1/sessions/current', {
			credential: token,
			headers: { 'user-agent': await browserUserAgent() },
		})
		return destIdentityUser(current)
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
	const token = await sessionToken()
	return { user, sessionToken: token, userId: user?.id }
}

export async function setSessionCookie(token: string): Promise<void> {
	const jar = await cookies()
	jar.set(SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		secure: env.NODE_ENV === 'production',
	})
}

export async function clearSessionCookie(): Promise<void> {
	const jar = await cookies()
	jar.delete(SESSION_COOKIE)
}

export async function revokeCurrentSessions(): Promise<void> {
	const token = await sessionToken()
	if (!token) {
		await clearSessionCookie()
		return
	}
	try {
		await destIdentityJson(identityOrigin(), '/v1/sessions/revoke-all', {
			method: 'POST',
			credential: token,
			headers: { 'user-agent': await browserUserAgent() },
			body: { idempotency_key: crypto.randomUUID(), reason: 'sign-out' },
		})
	} catch {
		// Cookie clear is the local effect; Identity revoke is best-effort.
	}
	await clearSessionCookie()
}

export type { AppConfig }

export async function getAppConfig(_opts?: {
	secretKey?: string
	appId?: string
	platformUrl?: string
}): Promise<AppConfig> {
	const { getAppConfig: loadAppConfig } = await import('./app-config')
	return loadAppConfig(_opts)
}

export async function getOAuthProviders(_opts?: { appId?: string }): Promise<string[]> {
	const { getOAuthProviders: loadProviders } = await import('./app-config')
	return loadProviders(_opts)
}

export function identityDestAdmission(): {
	origin: string
	credential: string
	projectId: string
} {
	const credential = destIdentityCredential()
	const projectId = destIdentityProjectId()
	if (!credential) {
		throw new Error('identity_credential_unconfigured')
	}
	if (!projectId) {
		throw new Error('identity_project_unconfigured')
	}
	return { origin: identityOrigin(), credential, projectId }
}

export type OAuthProvider = string
