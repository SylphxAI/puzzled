import { cookies, headers } from 'next/headers'
import { env } from '../env'
import { destIdentityCredential, destIdentityProjectId, destProductCredential } from './credentials'
import {
	type AppConfig,
	destIdentityJson,
	destIdentityOrigin,
	destIdentityUser,
	type IdentityUser,
} from './dest'
import {
	LEGACY_SESSION_COOKIE,
	readSessionToken,
	SESSION_COOKIE,
	SESSION_COOKIE_NAMES,
	sessionCookieOptions,
} from './session-cookie'

export const AUTH_API_ORIGIN = destIdentityOrigin()
export { SESSION_COOKIE }
export type { IdentityUser }

function identityOrigin(): string {
	return destIdentityOrigin(env.SYLPHX_AUTH_URL)
}

export async function sessionToken(): Promise<string | undefined> {
	return readSessionToken(await cookies())
}

/** The browser's User-Agent: Auth binds a session to it. */
export async function browserUserAgent(): Promise<string> {
	return (await headers()).get('user-agent')?.trim() || 'puzzled-web'
}

export async function currentUser(): Promise<IdentityUser | null> {
	const token = await sessionToken()
	if (!token) return null
	// Auth requires the product's publishable key on every session read; without it there is no session.
	// TODO: switch to the identity SDK's `callerKey` option once cloud#11034 publishes.
	const callerKey = destProductCredential(['SYLPHX_PUBLISHABLE_KEY'])
	if (!callerKey) return null
	try {
		const current = await destIdentityJson(identityOrigin(), '/v1/sessions/current', {
			credential: token,
			headers: { 'user-agent': await browserUserAgent(), 'x-sylphx-caller-key': callerKey },
		})
		return destIdentityUser(current, destIdentityProjectId())
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
	jar.set(SESSION_COOKIE, token, sessionCookieOptions(env.NODE_ENV === 'production'))
	// A fresh sign-in replaces any old-named cookie (removed 2026-10-31).
	jar.delete(LEGACY_SESSION_COOKIE)
}

export async function clearSessionCookie(): Promise<void> {
	const jar = await cookies()
	for (const name of SESSION_COOKIE_NAMES) jar.delete(name)
}

/**
 * Sign out: end this one session at Auth (`/v1/client/sign-out`, the player's
 * own bearer and User-Agent; it works for an unverified account too), then
 * clear both cookie names. Ending the session at Auth is best-effort; the
 * cookie clear is the local effect.
 */
export async function revokeCurrentSessions(userAgent?: string): Promise<void> {
	const token = await sessionToken()
	if (!token) {
		await clearSessionCookie()
		return
	}
	try {
		await destIdentityJson(identityOrigin(), '/v1/client/sign-out', {
			method: 'POST',
			credential: token,
			headers: { 'user-agent': userAgent ?? (await browserUserAgent()) },
		})
	} catch {
		// Cookie clear is the local effect; the Auth-side end is best-effort.
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
