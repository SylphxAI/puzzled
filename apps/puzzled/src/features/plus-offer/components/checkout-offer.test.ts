import { describe, expect, mock, test } from 'bun:test'
import { fromJson } from '@bufbuild/protobuf'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
	type ListPlansResponse,
	ListPlansResponseSchema,
} from '@/gen/connect/puzzled/v1/billing_pb'

// Match the live Connect JSON: one-time plans omit the default interval field.
const plans = fromJson(ListPlansResponseSchema, {
	salesOpen: true,
	plans: [
		{
			id: 'individual_once',
			accessDays: 3,
			prices: [{ currency: 'usd', unitAmountMinor: '299' }],
		},
		{
			id: 'individual_yearly',
			interval: 'year',
			prices: [{ currency: 'usd', unitAmountMinor: '3999' }],
		},
		{
			id: 'individual_monthly',
			interval: 'month',
			prices: [{ currency: 'usd', unitAmountMinor: '499' }],
		},
	],
})
let response: ListPlansResponse

mock.module('next/headers', () => ({
	cookies: async () => ({ get: () => undefined }),
	headers: async () => new Headers(),
}))
mock.module('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }))
mock.module('next-intl', () => ({
	useTranslations: () => (key: string) => key,
	useLocale: () => 'en-US',
}))
mock.module('next-intl/server', () => ({
	getLocale: async () => 'en-US',
	getTranslations: async () => (key: string) => key,
}))
function TestLink({ children }: { children: ReactNode }) {
	return createElement('a', null, children)
}

mock.module('@/lib/i18n/routing', () => ({ Link: TestLink }))
mock.module('@/lib/api/server', () => ({ getServerPlans: async () => response }))

const { CheckoutOffer } = await import('./checkout-offer')

async function renderOffer(catalogue: ListPlansResponse) {
	response = catalogue
	return renderToStaticMarkup(
		await CheckoutOffer({
			locale: 'en-US',
			signedIn: false,
			callbackUrl: '/archive',
			gameCount: 19,
		}),
	)
}

function radios(html: string) {
	return html.match(/<input[^>]*name="unlock-plan"[^>]*>/g) ?? []
}

describe('CheckoutOffer', () => {
	test('renders and preselects the starter from live-shaped ListPlans JSON', async () => {
		const html = await renderOffer(plans)
		const [starter, yearly, monthly] = radios(html)
		expect(starter).toContain('value="once"')
		expect(starter).toContain('checked=""')
		expect(yearly).toContain('value="year"')
		expect(monthly).toContain('value="month"')
		expect(html).toContain('$2.99')
	})

	test.each([
		['zero access days', { accessDays: 0 }],
		['unsupported once interval', { interval: 'once' }],
		['family starter', { family: true }],
		['no price', { prices: [] }],
		[
			'no price in selected currency',
			{ prices: [{ ...plans.plans[0].prices[0], currency: 'hkd' }] },
		],
	] as const)('keeps recurring choices but omits the starter with %s', async (_, changes) => {
		const [starter, ...recurring] = plans.plans
		const html = await renderOffer({ ...plans, plans: [{ ...starter, ...changes }, ...recurring] })
		const options = radios(html)
		expect(options).toHaveLength(2)
		expect(options[0]).toContain('value="year"')
		expect(options[1]).toContain('value="month"')
	})

	test('does not render checkout when sales are closed', async () => {
		expect(radios(await renderOffer({ ...plans, salesOpen: false }))).toHaveLength(0)
	})
})
