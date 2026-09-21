/**
 * TD-18: the replay sampling decision is the server's entitlement answer.
 *
 * The premium branch (25% sampling) is behaviour the browser acts on; it must
 * read the server-resolved snapshot threaded by the layout, and must never
 * resolve a copy of its own. A stale client-side answer claiming premium while
 * the server answered free must not raise the rate.
 */

import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { type ComponentProps, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Capture the real modules first: bun module mocks live for the whole test run,
// so each replacement below spreads the real surface and overrides only the
// seam (see src/lib/audit/index.test.ts for the same rule).
const realEnv = await import('@/lib/env')
const realAnalytics = await import('@/features/analytics')
const realMonitoringLib = await import('../lib')

// The provider only records in production; this lane is production. The proxy
// keeps every other field a live read of the real env (later files in this run
// still see the environment they set).
mock.module('@/lib/env', () => ({
	...realEnv,
	env: new Proxy(realEnv.env, {
		get(target, prop, receiver) {
			return prop === 'NODE_ENV' ? 'production' : Reflect.get(target, prop, receiver)
		},
	}),
}))

mock.module('@/features/analytics', () => ({
	...realAnalytics,
	hasAnalyticsConsent: () => true,
	onConsentChange: () => () => undefined,
}))

/** The config the provider reads; the premium branch overrides its rate. */
const replayConfig: { sampling: { rate: number | null } } = { sampling: { rate: 15 } }

mock.module('../lib', () => ({
	...realMonitoringLib,
	getSessionReplayConfig: () => replayConfig,
}))

// Hand the real modules back for the rest of the run.
afterAll(() => {
	try {
		mock.module('@/lib/env', () => realEnv)
		mock.module('@/features/analytics', () => realAnalytics)
		mock.module('../lib', () => realMonitoringLib)
	} catch {
		// the supersets above already keep later files import-safe
	}
})

const { SessionReplayProvider } = await import('./session-replay-provider')
const { SylphxProvider } = await import('@/lib/identity/react')

const originalFetch = globalThis.fetch

beforeEach(() => {
	// Adjusted rates are applied in place, so each test starts from the default.
	replayConfig.sampling.rate = 15
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

function renderReplay(
	billing: {
		isPremium: boolean
		subscription: { planSlug?: string; status?: string } | null
	} | null,
): string {
	// React 19's types model required `children` props positionally, so the
	// variadic form needs the props cast; children still travel as arguments.
	return renderToStaticMarkup(
		createElement(
			SylphxProvider,
			{ billing } as ComponentProps<typeof SylphxProvider>,
			createElement(
				SessionReplayProvider,
				{} as ComponentProps<typeof SessionReplayProvider>,
				null,
			),
		),
	)
}

describe('replay sampling follows the server-resolved entitlement', () => {
	test('a server-entitled viewer is sampled at the premium rate', () => {
		renderReplay({ isPremium: true, subscription: { planSlug: 'premium', status: 'active' } })

		expect(replayConfig.sampling.rate).toBe(25)
	})

	test('a free verdict stays free: a stale premium answer cannot raise the rate', () => {
		const calls: string[] = []
		globalThis.fetch = (async (url: string) => {
			calls.push(String(url))
			return {
				ok: true,
				status: 200,
				json: async () => ({ isPremium: true, subscription: { planSlug: 'premium' } }),
			} as Response
		}) as typeof fetch

		renderReplay({ isPremium: false, subscription: null })

		expect(replayConfig.sampling.rate).toBe(15)
		expect(calls).toEqual([])
	})

	test('a request with no account (no snapshot) keeps the default rate', () => {
		renderReplay(null)

		expect(replayConfig.sampling.rate).toBe(15)
	})
})
