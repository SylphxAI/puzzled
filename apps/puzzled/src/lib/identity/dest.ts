const IDENTITY_API_ORIGIN = 'https://api.identity.sylphx.com'
const BINDING_HEADER = 'sylphx-project-binding'

export type IdentityPrincipal = {
	principalId: string
	primaryEmail?: string
	displayName?: string
	primaryEmailVerified?: boolean
}

export type IdentitySession = {
	sessionId?: string
	accessToken?: string
	principal: IdentityPrincipal
}

export function destIdentityOrigin(raw?: string | null): string {
	const value = raw?.trim()
	if (!value) return IDENTITY_API_ORIGIN
	try {
		if (new URL(value).hostname.toLowerCase().endsWith('.api.sylphx.com')) {
			return IDENTITY_API_ORIGIN
		}
	} catch {
		return IDENTITY_API_ORIGIN
	}
	return value.replace(/\/+$/, '')
}

export async function destIdentityJson<T>(
	origin: string,
	path: string,
	init: {
		method?: string
		sessionToken?: string
		projectBinding?: string
		body?: unknown
	} = {},
): Promise<T> {
	const headers: Record<string, string> = {}
	if (init.projectBinding) headers[BINDING_HEADER] = init.projectBinding
	if (init.sessionToken) headers.Authorization = `Bearer ${init.sessionToken}`
	if (init.body !== undefined) headers['content-type'] = 'application/json'
	const response = await fetch(`${origin.replace(/\/+$/, '')}${path}`, {
		method: init.method ?? 'GET',
		headers,
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	})
	const text = await response.text()
	if (!response.ok) {
		throw new Error(`Identity dest ${path} ${response.status}: ${text.slice(0, 300)}`)
	}
	return (text ? JSON.parse(text) : {}) as T
}
