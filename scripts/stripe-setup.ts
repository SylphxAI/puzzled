#!/usr/bin/env bun
/**
 * Puzzled Plus: create or check the Stripe catalogue, webhook endpoint and
 * Customer Portal configuration. Idempotent; run it once per Stripe mode
 * (test key first, then live key).
 *
 *   STRIPE_SECRET_KEY=sk_test_... bun scripts/stripe-setup.ts \
 *     [--public-url https://puzzled.gg] [--webhook-secret-out /path/file]
 *
 * Products, plans and prices come from the commercial catalogue
 * (config/commercial/catalogue.json) and nowhere else: tax inclusive, USD base
 * with a GBP option. A price whose amount changed in the catalogue gets a new
 * Stripe price that takes over the lookup key; the old one is archived and
 * existing subscriptions keep it until they change plan. The api serves the
 * same catalogue and keeps sales closed while Stripe's published prices
 * differ from it, so publishing after an edit is what makes a price live.
 *
 * The webhook signing secret is shown by Stripe only when the endpoint is
 * created. It is written to --webhook-secret-out (never printed); store it as
 * the api service's STRIPE_WEBHOOK_SECRET.
 */

import catalogue from '../config/commercial/catalogue.json'

const API = 'https://api.stripe.com'
const API_VERSION = '2024-06-20'

type CataloguePlan = {
	price_key: string
	plan_id: string
	provider_lookup_key: string
	product: string
	name: Record<string, string>
	interval: 'month' | 'year'
	unit_amounts: Record<string, number>
	tax_behavior: string
}

type PlanSpec = {
	lookupKey: string
	product: string
	interval: 'month' | 'year'
	usd: number
	gbp: number
	taxBehavior: string
	nickname: string
}

/** The English name, which is what the processor's own dashboard shows. */
const englishName = (names: Record<string, string>): string =>
	names['en-US'] ?? Object.values(names)[0] ?? ''

const PRODUCTS = catalogue.products.map((product) => ({
	id: product.id,
	name: englishName(product.name),
}))

function nickname(plan: CataloguePlan): string {
	const interval = plan.interval === 'month' ? 'monthly' : 'yearly'
	return plan.plan_id.startsWith('family_')
		? `Family ${interval}`
		: `${interval[0].toUpperCase()}${interval.slice(1)}`
}

const PLANS: PlanSpec[] = (catalogue.plans as CataloguePlan[]).map((plan) => ({
	lookupKey: plan.provider_lookup_key,
	product: plan.product,
	interval: plan.interval,
	usd: plan.unit_amounts.usd,
	gbp: plan.unit_amounts.gbp,
	taxBehavior: plan.tax_behavior,
	nickname: nickname(plan),
}))

const WEBHOOK_EVENTS = [
	'checkout.session.completed',
	'customer.subscription.created',
	'customer.subscription.updated',
	'customer.subscription.deleted',
	'customer.subscription.paused',
	'customer.subscription.resumed',
	'invoice.paid',
	'invoice.payment_failed',
	'charge.refunded',
]

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(name)
	return i >= 0 ? process.argv[i + 1] : undefined
}

const key = process.env.STRIPE_SECRET_KEY?.trim()
if (!key) {
	console.error('STRIPE_SECRET_KEY is required')
	process.exit(2)
}
const publicUrl = (arg('--public-url') ?? 'https://puzzled.gg').replace(/\/$/, '')
const secretOut = arg('--webhook-secret-out')

type Json = Record<string, unknown> & { id?: string; data?: Json[] }

async function stripe(method: string, path: string, form?: Record<string, string>): Promise<Json> {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${key}`,
			'stripe-version': API_VERSION,
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: form ? new URLSearchParams(form).toString() : undefined,
	})
	const body = (await res.json()) as Json
	if (!res.ok) {
		const message = (body.error as { message?: string } | undefined)?.message ?? res.statusText
		throw Object.assign(new Error(`${method} ${path}: ${message}`), { status: res.status })
	}
	return body
}

async function ensureProducts() {
	for (const product of PRODUCTS) {
		try {
			await stripe('GET', `/v1/products/${product.id}`)
			console.log(`product ${product.id}: exists`)
		} catch (error) {
			if ((error as { status?: number }).status !== 404) throw error
			await stripe('POST', '/v1/products', {
				id: product.id,
				name: product.name,
				'metadata[app]': 'puzzled',
			})
			console.log(`product ${product.id}: created`)
		}
	}
}

async function ensurePrices(): Promise<Map<string, string>> {
	const query = new URLSearchParams({ limit: '20', 'expand[]': 'data.currency_options' })
	for (const plan of PLANS) query.append('lookup_keys[]', plan.lookupKey)
	const existing = (await stripe('GET', `/v1/prices?${query}`)).data ?? []
	const ids = new Map<string, string>()
	for (const plan of PLANS) {
		const found = existing.find((p) => p.lookup_key === plan.lookupKey)
		const options = found?.currency_options as Record<string, { unit_amount?: number }> | undefined
		const same =
			found &&
			found.active === true &&
			found.unit_amount === plan.usd &&
			found.currency === 'usd' &&
			options?.gbp?.unit_amount === plan.gbp &&
			(found.recurring as { interval?: string } | undefined)?.interval === plan.interval &&
			found.tax_behavior === plan.taxBehavior
		if (same && found.id) {
			ids.set(plan.lookupKey, found.id)
			console.log(`price ${plan.lookupKey}: ${found.id} unchanged`)
			continue
		}
		const created = await stripe('POST', '/v1/prices', {
			product: plan.product,
			currency: 'usd',
			unit_amount: String(plan.usd),
			tax_behavior: plan.taxBehavior,
			'currency_options[gbp][unit_amount]': String(plan.gbp),
			'currency_options[gbp][tax_behavior]': plan.taxBehavior,
			'recurring[interval]': plan.interval,
			lookup_key: plan.lookupKey,
			transfer_lookup_key: 'true',
			nickname: plan.nickname,
			'metadata[app]': 'puzzled',
		})
		if (found?.id && found.active) {
			await stripe('POST', `/v1/prices/${found.id}`, { active: 'false' })
		}
		ids.set(plan.lookupKey, created.id as string)
		console.log(
			`price ${plan.lookupKey}: created ${created.id}${found ? ` (archived ${found.id})` : ''}`,
		)
	}
	return ids
}

async function ensureWebhook() {
	const url = `${publicUrl}/webhooks/stripe`
	const endpoints = (await stripe('GET', '/v1/webhook_endpoints?limit=100')).data ?? []
	const found = endpoints.find((e) => e.url === url)
	if (found) {
		const form: Record<string, string> = {}
		WEBHOOK_EVENTS.forEach((event, i) => {
			form[`enabled_events[${i}]`] = event
		})
		await stripe('POST', `/v1/webhook_endpoints/${found.id}`, form)
		console.log(`webhook ${url}: exists (${found.id}); events updated`)
		return
	}
	const form: Record<string, string> = {
		url,
		api_version: API_VERSION,
		description: 'Puzzled Plus',
		'metadata[app]': 'puzzled',
	}
	WEBHOOK_EVENTS.forEach((event, i) => {
		form[`enabled_events[${i}]`] = event
	})
	const created = await stripe('POST', '/v1/webhook_endpoints', form)
	if (secretOut) {
		await Bun.write(secretOut, `${created.secret as string}\n`)
		console.log(`webhook ${url}: created ${created.id}; signing secret written to ${secretOut}`)
	} else {
		console.log(
			`webhook ${url}: created ${created.id}. Its signing secret was not saved: delete the endpoint and rerun with --webhook-secret-out`,
		)
	}
}

async function ensurePortal(prices: Map<string, string>) {
	const configs =
		(await stripe('GET', '/v1/billing_portal/configurations?active=true&limit=100')).data ?? []
	const form: Record<string, string> = {
		'business_profile[headline]': 'Puzzled Plus, sold by Sylphx Limited',
		'business_profile[privacy_policy_url]': `${publicUrl}/privacy`,
		'business_profile[terms_of_service_url]': `${publicUrl}/terms`,
		'features[invoice_history][enabled]': 'true',
		'features[payment_method_update][enabled]': 'true',
		'features[customer_update][enabled]': 'true',
		'features[customer_update][allowed_updates][0]': 'email',
		'features[customer_update][allowed_updates][1]': 'address',
		// Cancellation lives in Settings > Subscription, which applies the
		// 14-day refund rule; the portal handles payment details and plan changes.
		'features[subscription_cancel][enabled]': 'false',
		'features[subscription_update][enabled]': 'true',
		'features[subscription_update][default_allowed_updates][0]': 'price',
		'features[subscription_update][proration_behavior]': 'create_prorations',
		'metadata[app]': 'puzzled',
	}
	PRODUCTS.forEach((product, i) => {
		form[`features[subscription_update][products][${i}][product]`] = product.id
		PLANS.filter((plan) => plan.product === product.id).forEach((plan, j) => {
			form[`features[subscription_update][products][${i}][prices][${j}]`] =
				prices.get(plan.lookupKey) ?? ''
		})
	})
	const found = configs.find(
		(c) => (c.metadata as Record<string, string> | undefined)?.app === 'puzzled',
	)
	if (found) {
		const { 'metadata[app]': _, ...update } = form
		await stripe('POST', `/v1/billing_portal/configurations/${found.id}`, update)
		console.log(`portal configuration: ${found.id} updated`)
	} else {
		const created = await stripe('POST', '/v1/billing_portal/configurations', form)
		console.log(`portal configuration: created ${created.id}`)
	}
}

console.log(
	`Stripe ${key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'LIVE' : 'test'} mode, site ${publicUrl}`,
)
await ensureProducts()
const prices = await ensurePrices()
await ensureWebhook()
await ensurePortal(prices)
console.log('done')
