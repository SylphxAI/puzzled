import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveLocale } from '../../../../../../scripts/i18n-resolved-catalogue'

const enUS = resolveLocale('en-US')
const catalogMessages = {
	plus: enUS.plus as Record<string, unknown>,
	common: enUS.common as Record<string, unknown>,
}

function lookup(
	namespace: string | undefined,
	key: string,
	values?: Record<string, string | number>,
) {
	const rootKey = namespace?.split('.')[0]
	let node: unknown = rootKey
		? (catalogMessages as Record<string, unknown>)[rootKey]
		: catalogMessages
	const parts = namespace ? [...namespace.split('.').slice(1), ...key.split('.')] : key.split('.')
	for (const part of parts) {
		node = (node as Record<string, unknown> | undefined)?.[part]
	}
	if (typeof node !== 'string') return `${namespace ?? ''}.${key}`
	let out = node
	if (values) {
		for (const [k, v] of Object.entries(values)) {
			out = out.replace(`{${k}}`, String(v))
		}
	}
	return out
}

function serializeHref(
	href: string | { pathname: string; query?: Record<string, string> },
): string {
	if (typeof href === 'string') return href
	const qs = href.query ? new URLSearchParams(href.query).toString() : ''
	return qs ? `${href.pathname}?${qs}` : href.pathname
}

let mockSignedIn = false
let mockClaimCookie: string | undefined
let mockEntitled = false
let memoizedSubscription:
	| {
			salesOpen: boolean
			entitled: boolean
			source: string
			planId?: string
			status?: string
			currentPeriodEndMs?: bigint
			cancelAtPeriodEnd: boolean
	  }
	| undefined
const claimCalls: Array<{ sessionId: string; locale: string }> = []
const redirectedTo: string[] = []

mock.module('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) =>
			name === 'puzzled_checkout_claim' && mockClaimCookie ? { value: mockClaimCookie } : undefined,
	}),
	headers: async () => new Headers(),
}))

mock.module('next-intl', () => ({
	useTranslations: (ns?: string) => (key: string, values?: Record<string, string | number>) =>
		lookup(ns, key, values),
	useLocale: () => 'en-US',
}))

mock.module('next-intl/server', () => ({
	getTranslations: async (opts?: string | { locale?: string; namespace?: string }) => {
		const ns = typeof opts === 'string' ? opts : opts?.namespace
		return (key: string, values?: Record<string, string | number>) => lookup(ns, key, values)
	},
	setRequestLocale: () => undefined,
}))

function MockLink({
	href,
	children,
	className,
}: {
	href: string | { pathname: string; query?: Record<string, string> }
	children?: ReactNode
	className?: string
}) {
	return createElement('a', { href: serializeHref(href), className }, children)
}

mock.module('@/lib/i18n/routing', () => ({
	Link: MockLink,
	useRouter: () => ({ refresh: () => undefined }),
}))

mock.module('@/features/console/lib/require-member', () => ({
	requireMember: async (input: { locale: string; returnTo: string }) => {
		redirectedTo.push(input.returnTo)
		return null
	},
}))

mock.module('@/lib/identity/server', () => ({
	currentUser: async () =>
		mockSignedIn ? { id: 'usr_paid_1', email: 'buyer@example.com', emailVerified: true } : null,
}))

mock.module('@/lib/api/server', () => ({
	claimServerCheckout: async (sessionId = '', locale = '') => {
		claimCalls.push({ sessionId, locale })
		mockEntitled = true
		return true
	},
	// Mirror React.cache() per-request memoization in server.ts so tests fail if
	// getServerSubscription is read before claimServerCheckout runs.
	getServerSubscription: async () => {
		if (!memoizedSubscription) {
			memoizedSubscription = {
				salesOpen: true,
				entitled: mockEntitled,
				source: mockEntitled ? 'plus' : 'none',
				planId: mockEntitled ? 'individual_yearly' : undefined,
				status: mockEntitled ? 'active' : undefined,
				currentPeriodEndMs: mockEntitled ? BigInt(4_070_908_800_000) : undefined,
				cancelAtPeriodEnd: false,
			}
		}
		return memoizedSubscription
	},
	getServerPlans: async () => ({
		salesOpen: true,
		familyMaxMembers: 4,
		plans: [
			{
				id: 'individual_yearly',
				family: false,
				interval: 'year',
				trialDays: 0,
				accessDays: 0,
				prices: [{ currency: 'usd', unitAmountMinor: BigInt(3999) }],
			},
		],
	}),
}))

const { default: SubscriptionSettingsPage } = await import('./page')

describe('SubscriptionSettingsPage guest checkout claim handoff', () => {
	test('prompts unauthenticated post-payment buyer to create account or sign in with preserved return URL and zero secrets', async () => {
		mockSignedIn = false
		mockClaimCookie = 'encoded_secret_cookie_only'
		mockEntitled = false
		memoizedSubscription = undefined
		claimCalls.length = 0
		redirectedTo.length = 0

		const node = await SubscriptionSettingsPage({
			params: Promise.resolve({ locale: 'en-US' }),
			searchParams: Promise.resolve({
				checkout: 'success',
				s: 'cs_live_guest_session_123',
				callbackUrl: '/games/sudoku',
			}),
		})
		const html = renderToStaticMarkup(node)

		expect(redirectedTo).toHaveLength(0)
		expect(claimCalls).toHaveLength(0)
		expect(html).toContain('Payment received — link your Tryit Plus')
		expect(html).toContain('Create account to activate Plus')
		expect(html).toContain('Sign in to link subscription')
		const expectedCallback = encodeURIComponent(
			'/settings/subscription?checkout=success&s=cs_live_guest_session_123&callbackUrl=%2Fgames%2Fsudoku',
		)
		expect(html).toContain(`/signup?callbackUrl=${expectedCallback}`)
		expect(html).toContain(`/login?callbackUrl=${expectedCallback}`)
		expect(html).not.toContain('encoded_secret_cookie_only')
		expect(html).not.toContain('clm_')
	})

	test('preserves session_id for signed-out buyer without HttpOnly cookie so verified-email :claim works after sign-in', async () => {
		mockSignedIn = false
		mockClaimCookie = undefined
		mockEntitled = false
		memoizedSubscription = undefined
		claimCalls.length = 0
		redirectedTo.length = 0

		const node = await SubscriptionSettingsPage({
			params: Promise.resolve({ locale: 'en-US' }),
			searchParams: Promise.resolve({
				checkout: 'success',
				session_id: 'cs_live_verify_probe',
			}),
		})
		const html = renderToStaticMarkup(node)

		expect(redirectedTo).toHaveLength(0)
		expect(claimCalls).toHaveLength(0)
		expect(html).toContain('Payment received — link your Tryit Plus')
		const expectedCallback = encodeURIComponent(
			'/settings/subscription?checkout=success&session_id=cs_live_verify_probe',
		)
		expect(html).toContain(`/signup?callbackUrl=${expectedCallback}`)
		expect(html).toContain(`/login?callbackUrl=${expectedCallback}`)
	})

	test('redirects unauthenticated visitors on normal /settings/subscription without checkout=success', async () => {
		mockSignedIn = false
		mockClaimCookie = undefined
		memoizedSubscription = undefined
		redirectedTo.length = 0

		await SubscriptionSettingsPage({
			params: Promise.resolve({ locale: 'en-US' }),
			searchParams: Promise.resolve({}),
		})
		expect(redirectedTo).toEqual(['/settings/subscription'])
	})

	test('automatically executes :claim for signed-in buyer holding HttpOnly claim cookie', async () => {
		mockSignedIn = true
		mockClaimCookie = 'opaque_cookie_value'
		mockEntitled = false
		memoizedSubscription = undefined
		claimCalls.length = 0

		const node = await SubscriptionSettingsPage({
			params: Promise.resolve({ locale: 'en-US' }),
			searchParams: Promise.resolve({
				checkout: 'success',
				s: 'cs_live_guest_session_123',
				callbackUrl: '/games/sudoku',
			}),
		})
		const html = renderToStaticMarkup(node)

		expect(claimCalls).toEqual([{ sessionId: 'cs_live_guest_session_123', locale: 'en-US' }])
		expect(html).toContain('Welcome to Tryit Plus. Every game and the archive are open.')
		expect(html).toContain('Return to puzzle')
	})

	test('falls back to verified-email :claim before memoized subscription read when signed-in buyer returns with session_id and no cookie', async () => {
		mockSignedIn = true
		mockClaimCookie = undefined
		mockEntitled = false
		memoizedSubscription = undefined
		claimCalls.length = 0

		const node = await SubscriptionSettingsPage({
			params: Promise.resolve({ locale: 'en-US' }),
			searchParams: Promise.resolve({
				checkout: 'success',
				session_id: 'cs_live_email_match_456',
			}),
		})
		const html = renderToStaticMarkup(node)

		expect(claimCalls).toEqual([{ sessionId: 'cs_live_email_match_456', locale: 'en-US' }])
		expect(html).toContain('Welcome to Tryit Plus. Every game and the archive are open.')
	})
})
