export type AccountSession = {
	session_id: string
	device: { display_name?: string; user_agent?: string }
	created_at_unix_seconds: number
	expires_at_unix_seconds: number
	state: string
}

/** Fail honestly if the authority did not return its session-list contract. */
export function isAccountSession(value: unknown): value is AccountSession {
	if (!value || typeof value !== 'object') return false
	const row = value as Partial<AccountSession>
	return (
		typeof row.session_id === 'string' &&
		row.session_id.length > 0 &&
		!!row.device &&
		typeof row.device === 'object' &&
		(row.device.display_name === undefined || typeof row.device.display_name === 'string') &&
		(row.device.user_agent === undefined || typeof row.device.user_agent === 'string') &&
		typeof row.created_at_unix_seconds === 'number' &&
		Number.isFinite(row.created_at_unix_seconds) &&
		typeof row.expires_at_unix_seconds === 'number' &&
		Number.isFinite(row.expires_at_unix_seconds) &&
		typeof row.state === 'string'
	)
}
