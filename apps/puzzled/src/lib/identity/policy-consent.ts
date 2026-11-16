import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/config/app'

export const POLICY_ACCEPTANCE = {
	terms_accepted: true,
	terms_version: TERMS_VERSION,
	privacy_version: PRIVACY_VERSION,
	surface: 'puzzled_web',
} as const
export type PolicyAcceptance = typeof POLICY_ACCEPTANCE

export function isPolicyAcceptance(value: unknown): value is PolicyAcceptance {
	if (!value || typeof value !== 'object') return false
	const body = value as Record<string, unknown>
	return (
		Object.keys(body).length === 4 &&
		Object.entries(POLICY_ACCEPTANCE).every(([key, expected]) => body[key] === expected)
	)
}

export interface PolicyConsentStatus {
	user_id: string
	current_terms_version: string
	current_privacy_version: string
	accepted_terms_version: string | null
	accepted_privacy_version: string | null
	accepted_at: string | null
	needs_reconsent: boolean
}
function isDateVersion(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		Number.isFinite(Date.parse(value)) &&
		new Date(value).toISOString().slice(0, 10) === value
	)
}
function isVersion(value: unknown): value is string {
	return (
		isDateVersion(value) ||
		(typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))
	)
}
/** Only complete, session-bound receipts can decide whether protected UI is released. */
export function isPolicyConsentStatus(
	value: unknown,
	userId: string,
): value is PolicyConsentStatus {
	if (!value || typeof value !== 'object') return false
	const status = value as Record<string, unknown>
	return (
		status.user_id === userId &&
		isDateVersion(status.current_terms_version) &&
		status.current_terms_version >= TERMS_VERSION &&
		isDateVersion(status.current_privacy_version) &&
		status.current_privacy_version >= PRIVACY_VERSION &&
		(status.accepted_terms_version === null || isVersion(status.accepted_terms_version)) &&
		(status.accepted_privacy_version === null || isVersion(status.accepted_privacy_version)) &&
		(status.accepted_at === null ||
			(typeof status.accepted_at === 'string' &&
				Number.isFinite(Date.parse(status.accepted_at)))) &&
		typeof status.needs_reconsent === 'boolean'
	)
}
/** Auth owns version compatibility (including its supported semver policy family). */
export function hasCurrentPolicyConsent(status: PolicyConsentStatus): boolean {
	return (
		!status.needs_reconsent &&
		status.accepted_at !== null &&
		status.accepted_terms_version !== null &&
		status.accepted_privacy_version !== null
	)
}

export function isLegalPath(pathname: string): boolean {
	const segments = pathname.split('/').filter(Boolean)
	return (
		(segments.length === 1 || segments.length === 2) &&
		['terms', 'privacy'].includes(segments.at(-1) ?? '')
	)
}
