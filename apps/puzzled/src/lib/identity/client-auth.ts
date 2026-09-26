import 'server-only'

/**
 * Puzzled's players are end users of its own Sylphx Auth instance, reached
 * through the Auth client API in server mode:
 *
 * - sign-up: `POST /v1/client/sign-up` (publishable key), then sign in;
 * - password sign-in: `POST /v1/client/sign-in/password` → one-time ticket;
 * - Google: `GET /v1/client/oauth/google/start` → Auth returns to our
 *   callback with `sylphx_ticket`;
 * - every ticket is redeemed here with the secret key
 *   (`POST /v1/client/tickets:redeem`), so a session token never enters a URL
 *   or the browser's JavaScript.
 *
 * Auth binds a session to the browser's User-Agent, so every call made on a
 * player's behalf forwards it. Keys come from the Enable Auth binding:
 * `SYLPHX_AUTH_URL`, `SYLPHX_PUBLISHABLE_KEY`, `SYLPHX_AUTH_SECRET_KEY`.
 */

const DEFAULT_AUTH_URL = 'https://api.sylphx.com'

/** How long after an account is created a first sign-in still counts as new. */
export const NEW_USER_WINDOW_SECONDS = 600

export type AuthConfig = { url: string; publishableKey: string; secretKey: string }

function envValue(names: readonly string[], env: Record<string, string | undefined>) {
	for (const name of names) {
		const value = env[name]?.trim()
		if (value) return value
	}
	return undefined
}

/** The instance's keys, or null while Auth is not enabled for this environment. */
export function authConfig(
	env: Record<string, string | undefined> = process.env,
): AuthConfig | null {
	const publishableKey = envValue(
		['SYLPHX_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY'],
		env,
	)
	const secretKey = envValue(['SYLPHX_AUTH_SECRET_KEY'], env)
	if (!publishableKey || !secretKey) return null
	const url = (envValue(['SYLPHX_AUTH_URL'], env) ?? DEFAULT_AUTH_URL).replace(/\/+$/, '')
	return { url, publishableKey, secretKey }
}

export class AuthCallError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
	) {
		super(`auth ${status} ${code}`)
	}
}

async function call<T>(
	config: AuthConfig,
	path: string,
	init: { method?: string; bearer: string; userAgent: string; body?: unknown },
): Promise<T> {
	const response = await fetch(`${config.url}${path}`, {
		method: init.method ?? 'POST',
		headers: {
			authorization: `Bearer ${init.bearer}`,
			'user-agent': init.userAgent,
			...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
		},
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
		cache: 'no-store',
		signal: AbortSignal.timeout(10_000),
	})
	const text = await response.text()
	let body: Record<string, unknown> = {}
	try {
		body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
	} catch {
		body = {}
	}
	if (!response.ok) {
		const code = typeof body.error === 'string' ? body.error : `http_${response.status}`
		throw new AuthCallError(response.status, code)
	}
	return body as T
}

/** Create an account; Auth answers the same whether or not the email exists. */
export async function signUp(
	config: AuthConfig,
	input: { email: string; password: string; name: string; verifyUrl: string; userAgent: string },
): Promise<void> {
	await call(config, '/v1/client/sign-up', {
		bearer: config.publishableKey,
		userAgent: input.userAgent,
		body: {
			email: input.email,
			password: input.password,
			name: input.name,
			redirect_url: input.verifyUrl,
		},
	})
}

/** Password sign-in in server mode: a one-time ticket for this backend. */
export async function passwordTicket(
	config: AuthConfig,
	input: { email: string; password: string; userAgent: string },
): Promise<string> {
	const body = await call<{ ticket?: string }>(config, '/v1/client/sign-in/password', {
		bearer: config.publishableKey,
		userAgent: input.userAgent,
		body: { email: input.email, password: input.password, session_mode: 'server' },
	})
	if (!body.ticket) throw new AuthCallError(502, 'no_ticket')
	return body.ticket
}

export type RedeemedSession = {
	token: string
	/** Auth says the account was just created (`is_new_user`), when it says. */
	isNewUser?: boolean
}

/** Exchange a one-time ticket for a session, with the secret key. */
export async function redeemTicket(
	config: AuthConfig,
	ticket: string,
	userAgent: string,
): Promise<RedeemedSession> {
	const body = await call<{
		session?: { token?: string }
		is_new_user?: boolean
		isNewUser?: boolean
	}>(config, '/v1/client/tickets:redeem', {
		bearer: config.secretKey,
		userAgent,
		body: { ticket },
	})
	const token = body.session?.token
	if (!token) throw new AuthCallError(502, 'no_session')
	const flag = body.is_new_user ?? body.isNewUser
	return { token, isNewUser: typeof flag === 'boolean' ? flag : undefined }
}

/**
 * Was this sign-in the account's first? Auth's own flag wins; until Auth
 * sends it, an account created within the window before the session counts.
 */
export function isNewUser(input: {
	flag?: boolean
	principalCreatedAt?: number
	sessionCreatedAt?: number
	now: number
}): boolean {
	if (typeof input.flag === 'boolean') return input.flag
	if (!input.principalCreatedAt) return false
	const reference = input.sessionCreatedAt || input.now
	return reference - input.principalCreatedAt <= NEW_USER_WINDOW_SECONDS
}

/** Creation times from `GET /v1/sessions/current` (seconds). */
export async function sessionTimes(
	config: AuthConfig,
	token: string,
	userAgent: string,
): Promise<{ principalCreatedAt?: number; sessionCreatedAt?: number }> {
	const body = await call<{
		session?: {
			created_at_unix_seconds?: number | string
			principal?: { created_at_unix_seconds?: number | string }
		}
	}>(config, '/v1/sessions/current', { method: 'GET', bearer: token, userAgent })
	const num = (v: number | string | undefined) => (v === undefined ? undefined : Number(v))
	return {
		principalCreatedAt: num(body.session?.principal?.created_at_unix_seconds),
		sessionCreatedAt: num(body.session?.created_at_unix_seconds),
	}
}

/** Auth's Google start door; Auth returns to `returnUrl` with `sylphx_ticket`. */
export function googleStartUrl(config: AuthConfig, returnUrl: string): string {
	const query = new URLSearchParams({
		publishable_key: config.publishableKey,
		redirect_url: returnUrl,
		session_mode: 'server',
	})
	return `${config.url}/v1/client/oauth/google/start?${query}`
}

/** A same-site path to return to after sign-in; anything else becomes `/`. */
export function safeNext(raw: string | null | undefined): string {
	const value = (raw ?? '').trim()
	const unsafe = [...value].some((char) => char === '\\' || char.charCodeAt(0) < 0x20)
	if (!value.startsWith('/') || value.startsWith('//') || unsafe) return '/'
	return value
}
