import { NextResponse } from 'next/server'
import { destIdentityCall, identityFail, issueSessionCookie } from '@/lib/identity/http'

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as {
		email?: string
		password?: string
		name?: string
		displayName?: string
		organizationName?: string
		captchaToken?: string
		captcha_token?: string
	} | null
	const email = body?.email?.trim()
	const password = body?.password?.trim()
	if (!email || !password) {
		return identityFail(400, 'invalid_signup')
	}
	if (password.length < 12) {
		return identityFail(400, 'password_too_short')
	}
	try {
		const completed = await destIdentityCall('/v1/signup', {
			method: 'POST',
			body: {
				idempotency_key: crypto.randomUUID(),
				email,
				password,
				display_name: (body.displayName ?? body.name ?? '').trim(),
				organization_name: (body.organizationName ?? 'Puzzled').trim() || 'Puzzled',
				captcha_token: (body.captchaToken ?? body.captcha_token ?? '').trim(),
			},
		})
		await issueSessionCookie(completed)
		return NextResponse.json({ authority: 'sylphx-identity' })
	} catch {
		return identityFail(401, 'identity_rejected')
	}
}
