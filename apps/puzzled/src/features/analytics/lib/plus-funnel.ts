/**
 * The Plus funnel, measured through the consent-gated Google tag (GA4 only).
 * Nothing is sent without analytics consent, and no account id, address or
 * free text is ever attached: only the fixed values below. Each event fires at
 * most once per surface per Hong Kong day per browser, remembered in one small
 * localStorage record that resets daily. A send that consent blocked is not
 * remembered, so it can still fire after the visitor opts in.
 * Funnel and how to read it: docs/monetization.md, "Measuring the Plus funnel".
 */

import { sendAnalyticsEvent } from './google-tag'

export type OfferSurface = 'result_card' | 'day3' | 'day7' | 'pricing'
export type FunnelInterval = 'month' | 'year'

const KEY = 'puzzled:funnel:sent'

type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void }

function store(): Store | null {
	try {
		return typeof window === 'undefined' ? null : window.localStorage
	} catch {
		return null
	}
}

/** The Hong Kong calendar day, the product day, from the browser clock (dedupe only). */
export function funnelDay(now: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(now)
}

function sentToday(storage: Store, day: string): string[] {
	try {
		const raw = JSON.parse(storage.getItem(KEY) ?? 'null') as { day?: unknown; sent?: unknown }
		if (raw?.day === day && Array.isArray(raw.sent)) {
			return raw.sent.filter((v): v is string => typeof v === 'string')
		}
	} catch {
		// fall through: treat as nothing sent
	}
	return []
}

/** Fire `name` once per `slot` per day; true only when it was sent now. */
export function fireFunnelOnce(
	name: string,
	slot: string,
	params: Record<string, unknown>,
	now: Date = new Date(),
): boolean {
	const storage = store()
	if (!storage) return false
	const day = funnelDay(now)
	const sent = sentToday(storage, day)
	const id = `${name}:${slot}`
	if (sent.includes(id)) return false
	if (!sendAnalyticsEvent(name, params)) return false
	try {
		storage.setItem(KEY, JSON.stringify({ day, sent: [...sent, id] }))
	} catch {
		// Cannot remember; at worst the event repeats on a later page.
	}
	return true
}

export const trackOfferShown = (surface: OfferSurface) =>
	fireFunnelOnce('plus_offer_shown', surface, { surface })

export const trackOfferClicked = (surface: OfferSurface) =>
	fireFunnelOnce('plus_offer_clicked', surface, { surface })

export const trackCheckoutStarted = (input: {
	plan: string
	interval: FunnelInterval
	trial: boolean
}) =>
	fireFunnelOnce('checkout_started', input.plan, {
		plan: input.plan,
		interval: input.interval,
		trial: input.trial ? 'yes' : 'no',
	})

export const trackCheckoutReturned = (outcome: 'success' | 'cancel') =>
	fireFunnelOnce('checkout_returned', outcome, { outcome })

export const trackTrialStarted = () => fireFunnelOnce('trial_started', 'trial', {})
