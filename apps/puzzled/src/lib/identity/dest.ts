const IDENTITY_API_ORIGIN = 'https://api.sylphx.com'
const EVENTS_API_ORIGIN = 'https://api.events.sylphx.com'
const AI_API_ORIGIN = 'https://api.models.sylphx.ai/v1'

export const DEST_PEELS = {
	identity: IDENTITY_API_ORIGIN,
	events: EVENTS_API_ORIGIN,
	ai: AI_API_ORIGIN,
} as const

export const DEST_CONSENT_PURPOSES = [
	'necessary',
	'analytics',
	'marketing',
	'functional',
	'preferences',
] as const

export type DestConsentPurpose = (typeof DEST_CONSENT_PURPOSES)[number]

export type IdentityPrincipal = {
	principalId: string
	primaryEmail?: string
	displayName?: string
	primaryEmailVerified?: boolean
}

export type IdentityUser = {
	id: string
	email?: string
	name?: string | null
	image?: string | null
	emailVerified?: boolean
	createdAt?: string
	role?: string | null
}

export type AppConfig = {
	consentTypes: DestConsentPurpose[]
	oauthProviders: string[]
	app: { id: string; name: string; slug: string }
	fetchedAt: string
}

export const EMPTY_APP_CONFIG: AppConfig = {
	consentTypes: [...DEST_CONSENT_PURPOSES],
	oauthProviders: [],
	app: { id: 'puzzled', name: 'Puzzled', slug: 'puzzled' },
	fetchedAt: new Date(0).toISOString(),
}

export type IdentitySession = {
	sessionId?: string
	accessToken?: string
	principal: IdentityPrincipal
}

function trimSlash(value: string): string {
	return value.replace(/\/+$/, '')
}

function forbiddenDestHost(hostname: string): boolean {
	return hostname.toLowerCase().endsWith('.api.sylphx.com')
}

export function destPeelOrigin(fallback: string, raw?: string | null): string {
	const value = raw?.trim()
	if (!value) return fallback
	try {
		if (forbiddenDestHost(new URL(value).hostname)) return fallback
	} catch {
		return fallback
	}
	return trimSlash(value)
}

export function destIdentityOrigin(raw?: string | null): string {
	return destPeelOrigin(IDENTITY_API_ORIGIN, raw)
}

export function destEventsOrigin(raw?: string | null): string {
	return destPeelOrigin(EVENTS_API_ORIGIN, raw)
}

function readText(value: unknown, keys: string[]): string | undefined {
	if (!value || typeof value !== 'object') return undefined
	const record = value as Record<string, unknown>
	for (const key of keys) {
		const candidate = record[key]
		if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
	}
	return undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TYPEID = /^[a-z]{2,5}_([0-7][0-9a-hjkmnp-tv-z]{25})$/
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz'

/**
 * The 128-bit value an Auth id carries (32 lowercase hex digits), in any of
 * its forms: `organization-<uuid>`, a TypeID (`<prefix>_<26 base32 chars>`,
 * spec v0.3) or a bare canonical uuid. Anything else is undefined.
 */
export function authIdValue(raw: string | undefined | null): string | undefined {
	const value = raw?.trim() ?? ''
	const uuid = value.startsWith('organization-') ? value.slice('organization-'.length) : value
	if (CANONICAL_UUID.test(uuid)) return uuid.replaceAll('-', '').toLowerCase()
	const suffix = TYPEID.exec(value)?.[1]
	if (!suffix) return undefined
	let bits = BigInt(0)
	for (const char of suffix) bits = (bits << BigInt(5)) | BigInt(CROCKFORD.indexOf(char))
	return bits.toString(16).padStart(32, '0')
}

/**
 * The principal of a `GET /v1/sessions/current` answer. Auth answers for a
 * session of ANY Auth instance, so the principal counts only when its
 * `project_id` is this product's own instance (`expectedProjectId`, i.e.
 * `SYLPHX_AUTH_ORGANIZATION_ID`), compared by value; a missing or different
 * id, or no expected id, is no principal.
 */
export function destIdentityPrincipal(
	raw: unknown,
	expectedProjectId: string | undefined,
): IdentityPrincipal | null {
	const record = asRecord(raw)
	if (!record) return null
	const nested =
		asRecord(record.principal) ?? asRecord(asRecord(record.session)?.principal) ?? record
	const principalId = readText(nested, ['principal_id', 'principalId'])
	if (!principalId) return null
	const expected = authIdValue(expectedProjectId)
	const projectId = readText(nested, ['project_id', 'projectId'])
	if (!expected || authIdValue(projectId) !== expected) {
		console.warn('auth session from another Auth instance refused', { projectId })
		return null
	}
	const verified =
		nested.primary_email_verified ?? nested.primaryEmailVerified ?? nested.email_verified
	return {
		principalId,
		primaryEmail: readText(nested, ['primary_email', 'primaryEmail', 'email']),
		displayName: readText(nested, ['display_name', 'displayName']),
		primaryEmailVerified: verified === true,
	}
}

export function destIdentityUser(
	raw: unknown,
	expectedProjectId: string | undefined,
): IdentityUser | null {
	const principal = destIdentityPrincipal(raw, expectedProjectId)
	if (!principal) return null
	return {
		id: principal.principalId,
		email: principal.primaryEmail,
		name: principal.displayName ?? null,
		emailVerified: principal.primaryEmailVerified,
	}
}

export function destSessionAccessToken(raw: unknown): string | undefined {
	const record = asRecord(raw)
	const session = asRecord(record?.session) ?? record
	return readText(session, ['access_token', 'accessToken'])
}

export function destSessionChallengeId(raw: unknown): string | undefined {
	const record = asRecord(raw)
	const challenge = asRecord(record?.challenge) ?? record
	return readText(challenge, ['challenge_id', 'challengeId'])
}

/** A refused Auth call: the HTTP status, Auth's `code` field (never its message) and Retry-After. */
export class DestHttpError extends Error {
	constructor(
		readonly path: string,
		readonly status: number,
		readonly code: string,
		readonly retryAfter: string | null,
		detail: string,
	) {
		super(`dest ${path} ${status}: ${detail}`)
		this.name = 'DestHttpError'
	}
}

function authErrorCode(text: string, status: number): string {
	try {
		const body = JSON.parse(text) as { code?: unknown; error?: unknown }
		if (typeof body.code === 'string' && body.code) return body.code
	} catch {
		// Not JSON: fall through to the status.
	}
	return `http_${status}`
}

export async function destJson<T>(
	origin: string,
	path: string,
	init: {
		method?: string
		credential?: string
		body?: unknown
		headers?: Record<string, string>
	} = {},
): Promise<T> {
	const headers: Record<string, string> = { ...(init.headers ?? {}) }
	for (const name of Object.keys(headers)) {
		if (name.toLowerCase().includes('binding')) {
			throw new Error('dest peels do not admit Binding')
		}
	}
	const credential = init.credential?.trim()
	if (credential) {
		headers.Authorization = `Bearer ${credential.replace(/^Bearer /i, '')}`
	}
	if (init.body !== undefined) headers['content-type'] = 'application/json'
	const response = await fetch(`${trimSlash(origin)}${path}`, {
		method: init.method ?? 'GET',
		headers,
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	})
	const text = await response.text()
	if (!response.ok) {
		throw new DestHttpError(
			path,
			response.status,
			authErrorCode(text, response.status),
			response.headers?.get('retry-after') ?? null,
			text.slice(0, 300),
		)
	}
	return (text ? JSON.parse(text) : {}) as T
}

export async function destIdentityJson<T>(
	origin: string,
	path: string,
	init: {
		method?: string
		credential?: string
		body?: unknown
		headers?: Record<string, string>
	} = {},
): Promise<T> {
	return destJson<T>(origin, path, init)
}
