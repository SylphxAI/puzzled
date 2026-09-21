/**
 * TD-18: the browser chrome states the server's entitlement answer.
 *
 * Premium is resolved once per request from Commerce EvaluateEntitlement and
 * threaded to the client as data (the layout's `billing` prop -> the billing
 * context). These tests pin that the client surfaces render that answer, that
 * a second (client-side) resolution is never attempted, and that a client-side
 * claim cannot flip a free verdict - the exact mismatch TD-18 exists for.
 */

import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { type ComponentProps, createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { type AppConfig, EMPTY_APP_CONFIG } from './dest'

// Capture the real modules first: bun module mocks live for the whole test run,
// so each replacement below spreads the real surface and overrides only the
// seam (see src/lib/audit/index.test.ts for the same rule).
const realNextIntl = await import('next-intl')
const realRouting = await import('@/lib/i18n/routing')

mock.module('next-intl', () => ({
	...realNextIntl,
	useTranslations: (_namespace?: string) => (key: string) => key,
}))

mock.module('@/lib/i18n/routing', () => ({
	...realRouting,
	Link: ({ href, children }: { href: string; children?: ReactNode }) =>
		createElement('a', { href }, children),
}))

// Hand the real modules back for the rest of the run.
afterAll(() => {
	try {
		mock.module('next-intl', () => realNextIntl)
		mock.module('@/lib/i18n/routing', () => realRouting)
	} catch {
		// the supersets above already keep later files import-safe
	}
})

const { BillingSection, SylphxProvider, useBilling } = await import('./react')
const { PricingContent } = await import('../../app/[locale]/(main)/pricing/pricing-client')

const PREMIUM = {
	isPremium: true,
	subscription: { planSlug: 'premium-monthly', status: 'active' },
}
const FREE = { isPremium: false, subscription: null }

const PRICING_CONFIG: AppConfig = {
	...EMPTY_APP_CONFIG,
	plans: [{ slug: 'premium', name: 'Premium', monthlyPrice: 499, annualPrice: 3999 }],
}

const originalFetch = globalThis.fetch

/** Every fetch the render path attempts, with the stub answering premium. */
function stubPremiumBillingApi(): string[] {
	const calls: string[] = []
	globalThis.fetch = (async (url: string) => {
		calls.push(String(url))
		return {
			ok: true,
			status: 200,
			json: async () => ({
				authority: 'sylphx-commerce',
				subscription: { planSlug: 'premium', status: 'active' },
				isPremium: true,
			}),
		} as Response
	}) as typeof fetch
	return calls
}

afterEach(() => {
	globalThis.fetch = originalFetch
})

function renderWithBilling(
	child: ReactElement,
	billing: {
		isPremium: boolean
		subscription: { planSlug?: string; status?: string } | null
	} | null,
	config: AppConfig = PRICING_CONFIG,
): string {
	// React 19's types model the required `children` prop positionally, so the
	// variadic form needs the props cast; children still travel as arguments.
	return renderToStaticMarkup(
		createElement(
			SylphxProvider,
			{ config, billing } as ComponentProps<typeof SylphxProvider>,
			child,
		),
	)
}

function BillingProbe() {
	const billing = useBilling()
	return createElement(
		'span',
		null,
		`${billing.isPremium ? 'premium' : 'free'}:${billing.subscription?.planSlug ?? 'none'}`,
	)
}

describe('billing chrome reads the server-resolved entitlement', () => {
	test('renders Premium and the plan from the server snapshot', () => {
		const html = renderWithBilling(createElement(BillingSection), PREMIUM)

		expect(html).toContain('Premium')
		expect(html).toContain('premium-monthly')
	})

	test('renders Free Plan from a free snapshot and when no snapshot was threaded', () => {
		expect(renderWithBilling(createElement(BillingSection), FREE)).toContain('Free Plan')
		expect(renderWithBilling(createElement(BillingSection), null)).toContain('Free Plan')
	})

	test('the snapshot is the only source: a premium claim from anywhere else cannot flip free', () => {
		// If any client surface went back to resolving its own copy, this stub
		// would answer premium=true while the server answered free - the
		// mismatch case TD-18 exists for. The rendered verdict must stay free.
		const calls = stubPremiumBillingApi()

		const html = renderWithBilling(createElement(BillingSection), FREE)
		const probe = renderWithBilling(createElement(BillingProbe), FREE)

		expect(html).toContain('Free Plan')
		expect(probe).toContain('free:none')
		expect(calls).toEqual([])
	})

	test('the hook exposes the snapshot as data on entitled renders too', () => {
		expect(renderWithBilling(createElement(BillingProbe), PREMIUM)).toContain(
			'premium:premium-monthly',
		)
	})
})

describe('the pricing gate reads the server-resolved entitlement', () => {
	const pricingProps = {
		locale: 'en',
		freeGameSlug: 'sudoku',
		freeGameName: 'Sudoku',
		moduleCount: 19,
	}

	test('an entitled viewer keeps the current-plan state', () => {
		// The plan card slug is the one the authority published ('premium'), so
		// the snapshot subscription must name it for the current-plan state.
		const html = renderWithBilling(createElement(PricingContent, pricingProps), {
			isPremium: true,
			subscription: { planSlug: 'premium', status: 'active' },
		})

		expect(html).toContain('currentPlan')
		expect(html).toContain('disabled')
	})

	test('a free verdict is not flipped by a stale premium answer', () => {
		const calls = stubPremiumBillingApi()

		const html = renderWithBilling(createElement(PricingContent, pricingProps), {
			isPremium: false,
			subscription: { planSlug: 'premium', status: 'inactive' },
		})

		expect(html).toContain('subscribeCta')
		expect(html).not.toContain('currentPlan')
		expect(calls).toEqual([])
	})
})
