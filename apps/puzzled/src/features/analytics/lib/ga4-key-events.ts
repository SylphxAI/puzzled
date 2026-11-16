/**
 * Consent-gated GA4 Key Event bridge (`sign_up`, `begin_checkout`, `purchase`).
 *
 * Strictly fail-closed: `CONSENT_DEFAULT_SCRIPT` defines `window.gtag` before
 * consent is decided, so checking `typeof window.gtag === 'function'` alone is
 * insufficient. This helper verifies explicit analytics consent
 * (`canTrackAnalytics()`) AND `typeof window.gtag === 'function'` before any
 * call, enriches `entry_surface` from `sessionStorage` (`puzzled:attr:session`)
 * when omitted, strips undefined and PII fields, and deduplicates `purchase`
 * per transaction in `sessionStorage`.
 */

import { readSessionEntrySurface } from '@/lib/attribution'
import { canTrackAnalytics } from './consent'

export type Ga4KeyEventName = 'sign_up' | 'begin_checkout' | 'purchase'

export type Ga4KeyEventParamsMap = {
	sign_up: {
		method?: string
		entry_surface?: string
	}
	begin_checkout: {
		plan?: string
		plan_sku?: string
		billing_interval?: string
		entry_surface?: string
		checkout_trigger?: string
		option?: string
		value?: number
		currency?: string
	}
	purchase: {
		transaction_id?: string
		session_id?: string
		value: number
		currency: string
		plan?: string
		plan_sku?: string
		billing_interval?: string
		entry_surface?: string
		items?: { item_id: string }[]
	}
}

export type Ga4KeyEventParams<E extends Ga4KeyEventName> = Ga4KeyEventParamsMap[E] &
	Record<string, unknown>

const PURCHASE_FIRED_PREFIX = 'puzzled:ga4:purchase:'
const firedPurchaseKeys = new Set<string>()

const ALLOWED_KEYS = new Set([
	'method',
	'entry_surface',
	'plan',
	'plan_sku',
	'billing_interval',
	'option',
	'checkout_trigger',
	'transaction_id',
	'value',
	'currency',
	'items',
])

const FORBIDDEN_PII_KEYS = new Set([
	'email',
	'email_address',
	'name',
	'username',
	'user_id',
	'userid',
	'phone',
	'phone_number',
	'address',
	'session_id',
	'sessionid',
	'token',
	'password',
	'url',
	'referrer',
])

function hasControlChar(value: string): boolean {
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i)
		if (code <= 0x1f || code === 0x7f) return true
	}
	return false
}

function sanitizeToken(value: unknown, maxLen = 120): string | undefined {
	if (typeof value !== 'string') return undefined
	const trimmed = value.trim()
	if (!trimmed || trimmed.includes('@') || hasControlChar(trimmed)) return undefined
	return trimmed.slice(0, maxLen)
}

function sanitizeParams(raw: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(raw)) {
		if (value === undefined || value === null) continue
		if (FORBIDDEN_PII_KEYS.has(key.toLowerCase()) || !ALLOWED_KEYS.has(key)) continue
		if (key === 'value') {
			if (typeof value === 'number' && Number.isFinite(value)) out.value = value
			continue
		}
		if (key === 'currency') {
			const clean = sanitizeToken(value, 8)
			if (clean) out.currency = clean.toUpperCase()
			continue
		}
		if (key === 'items' && Array.isArray(value)) {
			const items = value
				.map((entry) => {
					const itemId = sanitizeToken((entry as { item_id?: unknown } | null)?.item_id)
					return itemId ? { item_id: itemId } : null
				})
				.filter((entry): entry is { item_id: string } => entry !== null)
			if (items.length > 0) out.items = items
			continue
		}
		const clean = sanitizeToken(value)
		if (clean) out[key] = clean
	}
	return out
}

function sessionStore(): Storage | undefined {
	if (typeof window === 'undefined') return undefined
	try {
		return window.sessionStorage ?? undefined
	} catch {
		return undefined
	}
}

function isPurchaseRecorded(dedupeId: string): boolean {
	if (firedPurchaseKeys.has(dedupeId)) return true
	try {
		return sessionStore()?.getItem(`${PURCHASE_FIRED_PREFIX}${dedupeId}`) === '1'
	} catch {
		return false
	}
}

function markPurchaseRecorded(dedupeId: string): void {
	firedPurchaseKeys.add(dedupeId)
	try {
		sessionStore()?.setItem(`${PURCHASE_FIRED_PREFIX}${dedupeId}`, '1')
	} catch {
		// Private mode: in-memory set still prevents duplicates in this document.
	}
}

/** Test-only: clears in-memory purchase deduplication marks. */
export function resetGa4KeyEventsForTests(): void {
	firedPurchaseKeys.clear()
}

type GtagFn = (...args: unknown[]) => void

/**
 * Emits a consent-gated GA4 Key Event (`sign_up`, `begin_checkout`, `purchase`).
 * Returns `true` if `window.gtag` was called, `false` if gated or deduplicated.
 */
export function trackGa4KeyEvent<E extends Ga4KeyEventName>(
	event: E,
	params: Ga4KeyEventParams<E>,
): boolean {
	if (typeof window === 'undefined') return false
	if (!canTrackAnalytics()) return false
	const gtag = (window as unknown as { gtag?: unknown }).gtag
	if (typeof gtag !== 'function') return false

	const raw = params as Record<string, unknown>
	const clean = sanitizeParams(raw)

	if (clean.entry_surface === undefined) {
		const persisted = sanitizeToken(readSessionEntrySurface(sessionStore()))
		if (persisted) clean.entry_surface = persisted
	}

	if (event === 'purchase') {
		const dedupeId = sanitizeToken(clean.transaction_id, 255) ?? sanitizeToken(raw.session_id, 255)
		if (!dedupeId) return false
		if (!clean.transaction_id) clean.transaction_id = dedupeId
		if (isPurchaseRecorded(dedupeId)) return false
		markPurchaseRecorded(dedupeId)
	}

	;(gtag as GtagFn)('event', event, clean)
	return true
}
