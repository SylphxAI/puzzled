const IDENTITY_API_ORIGIN = 'https://api.identity.sylphx.com'
const DATA_API_ORIGIN = 'https://api.data.sylphx.com'
const COMPUTE_API_ORIGIN = 'https://api.compute.sylphx.com'
const EVENTS_API_ORIGIN = 'https://api.events.sylphx.com'
const COMMERCE_API_ORIGIN = 'https://api.commerce.sylphx.com'
const AI_API_ORIGIN = 'https://api.sylphx.ai/v1'

export const DEST_PEELS = {
	identity: IDENTITY_API_ORIGIN,
	data: DATA_API_ORIGIN,
	compute: COMPUTE_API_ORIGIN,
	events: EVENTS_API_ORIGIN,
	commerce: COMMERCE_API_ORIGIN,
	ai: AI_API_ORIGIN,
} as const

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
	plans: never[]
	consentTypes: never[]
	oauthProviders: string[]
	featureFlags: never[]
	app: { id: string; name: string; slug: string }
	fetchedAt: string
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

export function destDataOrigin(raw?: string | null): string {
	return destPeelOrigin(DATA_API_ORIGIN, raw)
}

export function destComputeOrigin(raw?: string | null): string {
	return destPeelOrigin(COMPUTE_API_ORIGIN, raw)
}

export function destEventsOrigin(raw?: string | null): string {
	return destPeelOrigin(EVENTS_API_ORIGIN, raw)
}

export function destCommerceOrigin(raw?: string | null): string {
	return destPeelOrigin(COMMERCE_API_ORIGIN, raw)
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

export function destIdentityPrincipal(raw: unknown): IdentityPrincipal | null {
	const record = asRecord(raw)
	if (!record) return null
	const nested =
		asRecord(record.principal) ?? asRecord(asRecord(record.session)?.principal) ?? record
	const principalId = readText(nested, ['principal_id', 'principalId'])
	if (!principalId) return null
	const verified =
		nested.primary_email_verified ?? nested.primaryEmailVerified ?? nested.email_verified
	return {
		principalId,
		primaryEmail: readText(nested, ['primary_email', 'primaryEmail', 'email']),
		displayName: readText(nested, ['display_name', 'displayName']),
		primaryEmailVerified: verified === true,
	}
}

export function destIdentityUser(raw: unknown): IdentityUser | null {
	const principal = destIdentityPrincipal(raw)
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
		throw new Error(`dest ${path} ${response.status}: ${text.slice(0, 300)}`)
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
	} = {},
): Promise<T> {
	return destJson<T>(origin, path, init)
}
