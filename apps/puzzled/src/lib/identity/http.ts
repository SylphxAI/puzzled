import { NextResponse } from 'next/server'
import {
	destIdentityJson,
	destIdentityOrigin,
	destSessionAccessToken,
	destSessionChallengeId,
} from './dest'
import { identityDestAdmission, setSessionCookie } from './server'

export function identityFail(status: number, error: string) {
	return NextResponse.json({ error, authority: 'sylphx-identity' }, { status })
}

export function identityOrigin(): string {
	return destIdentityOrigin(process.env.IDENTITY_API_ORIGIN)
}

export function destDevice(request: Request) {
	return {
		device_id: 'puzzled-web',
		display_name: 'Puzzled',
		user_agent: request.headers.get('user-agent')?.trim() || 'puzzled-web',
	}
}

export function destAdmissionResponse():
	| { ok: true; origin: string; credential: string; projectId: string }
	| { ok: false; response: NextResponse } {
	try {
		return { ok: true, ...identityDestAdmission() }
	} catch (error) {
		const message = error instanceof Error ? error.message : 'identity_unconfigured'
		const errorCode = message.includes('IDENTITY_API_KEY')
			? 'identity_credential_unconfigured'
			: message.includes('IDENTITY_ORGANIZATION_ID')
				? 'identity_project_unconfigured'
				: 'identity_unconfigured'
		return { ok: false, response: identityFail(503, errorCode) }
	}
}

export async function destIdentityCall<T>(
	path: string,
	init: { method?: string; credential?: string; body?: unknown } = {},
): Promise<T> {
	return destIdentityJson<T>(identityOrigin(), path, init)
}

export async function issueSessionCookie(raw: unknown): Promise<string | undefined> {
	const token = destSessionAccessToken(raw)
	if (token) await setSessionCookie(token)
	return token
}

export { destSessionChallengeId }
