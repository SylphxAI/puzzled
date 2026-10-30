/** One invocation of the product checkout check; scheduling belongs to Observability. */
import { createHash } from 'node:crypto'
import declaration from '../config/commercial/catalogue.json'

export type Mode = 'prod-unpaid' | 'test-payment'
export type Json = Record<string, unknown>
type Step = {
	id: string
	status: 'passed' | 'failed' | 'unknown'
	code: string
	durationMs: number
}
export type Receipt = {
	schema: 'puzzled.checkout-journey/1'
	journeyId: 'puzzled-checkout'
	mode: Mode
	status: 'passed' | 'failed' | 'unknown'
	steps: Step[]
}
export type Config = {
	mode: Mode
	baseUrl: string
	moneyOrigin: string
	environment: string
	moneyReadKey: string
	session: string
	userAgent: string
	fixtureKey: string
	merchantAccount: string
	consent: boolean
	currency: 'usd' | 'gbp'
	deadline: number
}
export type Ports = {
	read(url: string, headers: Record<string, string>, body?: Json): Promise<Json>
	pricing(url: string): Promise<string>
	hosted(url: string, product: string, amount: number, currency: string): Promise<boolean>
	now(): number
	requestId(seed: string): string
}

/** Stable even if a request never reaches the product before its reply is lost. */
export function requestIdentity(seed: string): string {
	const hash = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('')
	hash[12] = '8'
	hash[16] = '8'
	const value = hash.join('')
	return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

const diagnosticCodes = new Set([
	'attempt_identity_mismatch',
	'attempt_incomplete',
	'attempt_pending',
	'authorization',
	'catalogue_binding_mismatch',
	'catalogue_features_mismatch',
	'catalogue_licence_mismatch',
	'catalogue_not_synced',
	'catalogue_offer_mismatch',
	'catalogue_offer_missing',
	'catalogue_price_mismatch',
	'catalogue_processor_missing',
	'catalogue_term_mismatch',
	'checkout_refused',
	'configuration',
	'credential_binding',
	'deadline',
	'fixture_identity_mismatch',
	'hosted_form_mismatch',
	'hosted_readiness_unconfirmed',
	'hosted_url_mismatch',
	'http',
	'merchant_binding_mismatch',
	'merchant_mode_mismatch',
	'merchant_unavailable',
	'public_offer_mismatch',
	'public_page_mismatch',
	'public_price_mismatch',
	'response_invalid',
	'response_limit',
	'runtime',
	'sales_closed',
	'session_amount_mismatch',
	'session_binding',
	'session_identity_mismatch',
	'session_mode_mismatch',
	'session_offer_mismatch',
	'session_state_mismatch',
	'steps_incomplete',
	'test_acceptance_unavailable',
	'transport',
	'unexpected_payment',
])

export class Unknown extends Error {
	constructor(readonly code: string) {
		super(code)
	}
}
class Assertion extends Error {
	constructor(readonly code: string) {
		super(code)
	}
}
function assert(condition: unknown, code: string): asserts condition {
	if (!condition) throw new Assertion(code)
}
function object(value: unknown): Json {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Unknown('response_invalid')
	return value as Json
}
function array(value: unknown): Json[] {
	if (!Array.isArray(value)) throw new Unknown('response_invalid')
	return value.map(object)
}
function text(value: unknown): string {
	return typeof value === 'string' ? value : ''
}
function minor(value: unknown): bigint {
	if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value)
	if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value)
	throw new Unknown('response_invalid')
}

const offer = declaration.plans.find((plan) => plan.plan_id === 'individual_once')!
const product = declaration.products.find((item) => item.id === offer.product)!
const accessDays = product.licence!.term.count
const required = [
	'public-pricing',
	'catalogue',
	'merchant',
	'fixture',
	'attempt',
	'session-readback',
	'hosted-form',
]

export async function run(
	config: Config,
	ports: Ports,
): Promise<{ exit: number; receipt: Receipt }> {
	const receipt: Receipt = {
		schema: 'puzzled.checkout-journey/1',
		journeyId: 'puzzled-checkout',
		mode: config.mode === 'test-payment' ? 'test-payment' : 'prod-unpaid',
		status: 'unknown',
		steps: [],
	}
	const productHeaders = {
		Authorization: `Bearer ${config.session}`,
		'User-Agent': config.userAgent,
	}
	const moneyHeaders = { Authorization: `Bearer ${config.moneyReadKey}` }
	const home = `${config.moneyOrigin}/v1/${config.environment}`
	const rpc = (method: string, body: Json = {}) =>
		ports.read(`${config.baseUrl}/puzzled.v1.BillingService/${method}`, productHeaders, body)
	let activeStep = 'configuration'
	let started = ports.now()
	async function step<T>(id: string, action: () => Promise<T>): Promise<T> {
		activeStep = id
		started = ports.now()
		if (started >= config.deadline) throw new Unknown('deadline')
		const result = await action()
		if (ports.now() >= config.deadline) throw new Unknown('deadline')
		receipt.steps.push({
			id,
			status: 'passed',
			code: 'ok',
			durationMs: Math.max(0, ports.now() - started),
		})
		return result
	}
	try {
		if (
			!['prod-unpaid', 'test-payment'].includes(config.mode) ||
			!Number.isFinite(config.deadline) ||
			!config.session ||
			!config.moneyReadKey ||
			!config.fixtureKey ||
			!/^acct_[A-Za-z0-9]+$/.test(config.merchantAccount) ||
			!config.userAgent ||
			!config.consent ||
			!/^orgs\/[^/]+\/projects\/[^/]+\/envs\/[^/]+$/.test(config.environment)
		)
			throw new Unknown('configuration')
		for (const origin of [config.baseUrl, config.moneyOrigin]) {
			const url = new URL(origin)
			if (
				url.protocol !== 'https:' ||
				url.username ||
				url.password ||
				url.search ||
				url.hash ||
				url.pathname !== '/'
			)
				throw new Unknown('configuration')
		}
		const amount = offer.unit_amounts[config.currency]
		await step('public-pricing', async () => {
			const page = await ports.pricing(`${config.baseUrl}/pricing`)
			const plans = await rpc('ListPlans')
			assert(plans.salesOpen === true, 'sales_closed')
			const plan = array(plans.plans).find((plan) => plan.id === offer.plan_id)
			assert(plan && !plan.interval && plan.accessDays === accessDays, 'public_offer_mismatch')
			const price = array(plan.prices).find((price) => price.currency === config.currency)
			assert(price && minor(price.unitAmountMinor) === BigInt(amount), 'public_price_mismatch')
			// The public page is read without running its anonymous analytics.
			const displayed = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: config.currency,
			}).format(amount / 100)
			assert(
				page.includes(`${accessDays}-day pass`) && page.includes(displayed),
				'public_page_mismatch',
			)
		})
		await step('catalogue', async () => {
			const identity = await ports.read(`${config.moneyOrigin}/v1/whoami`, moneyHeaders)
			const scoped = text(identity.env).startsWith('orgs/')
				? text(identity.env)
				: `orgs/${text(identity.org)}/projects/${text(identity.project)}/envs/${text(identity.env)}`
			if (scoped !== config.environment) throw new Unknown('credential_binding')
			const catalogue = await ports.read(`${home}/price_catalogs/default`, moneyHeaders)
			assert(
				catalogue.name === `${config.environment}/price_catalogs/default`,
				'catalogue_binding_mismatch',
			)
			const meta = object(catalogue.meta)
			assert(
				text(object(object(catalogue.status).processor_price_ids)[offer.price_key]).startsWith(
					'price_',
				),
				'catalogue_processor_missing',
			)
			const sync = array(object(catalogue.status).conditions).find(
				(condition) => condition.type === 'Synced',
			)
			assert(
				sync &&
					sync.status === 'true' &&
					minor(sync.observed_generation) === minor(meta.generation),
				'catalogue_not_synced',
			)
			const item = array(object(catalogue.spec).products).find((item) => item.key === offer.product)
			assert(item, 'catalogue_offer_missing')
			const price = array(item.prices).find((price) => price.key === offer.price_key)
			assert(
				price && price.archived !== true && !price.recurring_interval,
				'catalogue_offer_mismatch',
			)
			assert(
				minor(object(price.unit_amounts)[config.currency.toUpperCase()]) === BigInt(amount),
				'catalogue_price_mismatch',
			)
			const licence = object(item.licence)
			const term = object(licence.term)
			assert(
				term.unit === product.licence!.term.unit && minor(term.count) === BigInt(accessDays),
				'catalogue_term_mismatch',
			)
			assert(
				licence.key === product.licence!.key &&
					licence.plan === product.licence!.plan &&
					licence.token_product === product.licence!.token_product,
				'catalogue_licence_mismatch',
			)
			const features = object(item.features)
			assert(
				Object.entries(offer.grants).every(([key, value]) => features[key] === value),
				'catalogue_features_mismatch',
			)
		})
		await step('merchant', async () => {
			const merchant = await ports.read(`${home}/merchant_accounts/default`, moneyHeaders)
			assert(
				merchant.name === `${config.environment}/merchant_accounts/default` &&
					merchant.account_id === config.merchantAccount &&
					merchant.processor === 'stripe',
				'merchant_binding_mismatch',
			)
			assert(
				merchant.state === 'connected' && merchant.charges_enabled === true,
				'merchant_unavailable',
			)
			assert(merchant.livemode === (config.mode === 'prod-unpaid'), 'merchant_mode_mismatch')
		})
		let attempt = await step('fixture', async () => {
			const attempt = await rpc('GetCheckout')
			assert(attempt.syntheticFixture === config.fixtureKey, 'fixture_identity_mismatch')
			return attempt
		})
		if (config.mode === 'test-payment') throw new Unknown('test_acceptance_unavailable')
		await step('attempt', async () => {
			if (attempt.state === 'pending') throw new Unknown('attempt_pending')
			assert(attempt.state !== 'refused', 'checkout_refused')
			// New attempt only after authoritative expiry; a read error or a
			// pending record never reaches the normal checkout action.
			let create = attempt.state === 'absent'
			if (attempt.state === 'ready') {
				const prior = await session(attempt)
				facts(prior, attempt)
				assert(prior.payment_status === 'unpaid', 'unexpected_payment')
				create = prior.state === 'expired'
				if (!create) assert(prior.state === 'open', 'session_state_mismatch')
			}
			if (create) {
				if (attempt.state === 'ready' && !/^[0-9a-f-]{36}$/i.test(text(attempt.requestId)))
					throw new Unknown('response_invalid')
				const requestId = ports.requestId(
					[
						'puzzled.checkout-journey/1',
						config.environment,
						config.fixtureKey,
						offer.price_key,
						config.currency,
						attempt.state === 'ready' ? text(attempt.requestId) : 'initial',
					].join('\0'),
				)
				await rpc('CreateCheckoutAttempt', {
					planId: offer.plan_id,
					currency: config.currency,
					locale: 'en-US',
					immediateSupplyConsent: true,
					requestId,
				})
				attempt = await rpc('GetCheckout', { requestId })
				assert(attempt.requestId === requestId, 'attempt_identity_mismatch')
			}
			assert(attempt.state === 'ready', 'attempt_incomplete')
		})
		async function session(attempt: Json): Promise<Json> {
			const name = text(attempt.moneySessionName)
			if (
				!name.startsWith(`${config.environment}/checkout_sessions/`) ||
				name.slice(`${config.environment}/checkout_sessions/`.length).includes('/')
			)
				throw new Unknown('session_binding')
			return ports.read(`${config.moneyOrigin}/v1/${name}`, moneyHeaders)
		}
		function facts(current: Json, attempt: Json): void {
			assert(
				current.livemode === true && text(current.processor_session_id).startsWith('cs_live_'),
				'session_mode_mismatch',
			)
			assert(
				['open', 'expired'].includes(text(current.state)) && current.payment_status === 'unpaid',
				'session_state_mismatch',
			)
			assert(
				minor(current.amount_total) === BigInt(amount) &&
					text(current.currency_code).toLowerCase() === config.currency,
				'session_amount_mismatch',
			)
			const items = array(current.line_items)
			assert(
				items.length === 1 && items[0].price === offer.price_key && minor(items[0].quantity) === 1n,
				'session_offer_mismatch',
			)
			assert(
				current.processor_session_id === attempt.processorSessionId &&
					current.name === attempt.moneySessionName,
				'session_identity_mismatch',
			)
		}
		const current = await step('session-readback', async () => {
			const current = await session(attempt)
			facts(current, attempt)
			assert(current.state === 'open', 'session_state_mismatch')
			return current
		})
		await step('hosted-form', async () => {
			const url = new URL(text(current.url))
			assert(
				url.protocol === 'https:' &&
					url.hostname === 'checkout.stripe.com' &&
					url.pathname.includes(text(current.processor_session_id)) &&
					!url.username &&
					!url.password,
				'hosted_url_mismatch',
			)
			assert(
				await ports.hosted(url.href, product.name['en-US'], amount, config.currency),
				'hosted_form_mismatch',
			)
		})
		assert(
			required.every((id) =>
				receipt.steps.some((step) => step.id === id && step.status === 'passed'),
			),
			'steps_incomplete',
		)
		receipt.status = 'passed'
		return { exit: 0, receipt }
	} catch (error) {
		const semantic = error instanceof Assertion
		const candidate =
			error instanceof Assertion || error instanceof Unknown ? error.code : 'runtime'
		const code = diagnosticCodes.has(candidate) ? candidate : 'runtime'
		receipt.status = semantic ? 'failed' : 'unknown'
		receipt.steps.push({
			id: activeStep,
			status: receipt.status,
			code,
			durationMs: Math.max(0, ports.now() - started),
		})
		return { exit: semantic ? 42 : 2, receipt }
	}
}

if (import.meta.main) {
	const env = (name: string) => process.env[name] ?? ''
	const deadline = Math.min(
		Date.now() + 55_000,
		Number(env('JOURNEY_DEADLINE_UNIX_MS')) || Number.POSITIVE_INFINITY,
	)
	const config: Config = {
		mode: env('PUZZLED_CHECKOUT_MODE') as Mode,
		baseUrl: env('PUZZLED_CHECKOUT_BASE_URL'),
		moneyOrigin: 'https://api.sylphx.com',
		environment: env('PUZZLED_CHECKOUT_ENVIRONMENT'),
		moneyReadKey: env('PUZZLED_CHECKOUT_MONEY_READ_KEY'),
		session: env('PUZZLED_CHECKOUT_FIXTURE_SESSION'),
		userAgent: env('PUZZLED_CHECKOUT_FIXTURE_USER_AGENT'),
		fixtureKey: env('PUZZLED_CHECKOUT_FIXTURE_KEY'),
		merchantAccount: env('PUZZLED_CHECKOUT_MERCHANT_ACCOUNT'),
		consent: env('PUZZLED_CHECKOUT_IMMEDIATE_SUPPLY_CONSENT') === 'true',
		currency: 'usd',
		deadline,
	}
	const abort = new AbortController()
	const timer = setTimeout(
		() => {
			abort.abort()
			console.log(
				JSON.stringify({
					schema: 'puzzled.checkout-journey/1',
					journeyId: 'puzzled-checkout',
					mode: config.mode === 'test-payment' ? 'test-payment' : 'prod-unpaid',
					status: 'unknown',
					steps: [{ id: 'deadline', status: 'unknown', code: 'deadline', durationMs: 55_000 }],
				}),
			)
			process.exit(2)
		},
		Math.max(0, deadline - Date.now()),
	)
	const request = async (url: string, headers: Record<string, string> = {}, body?: Json) => {
		let response: Response
		try {
			response = await fetch(url, {
				method: body ? 'POST' : 'GET',
				headers: {
					...headers,
					...(body ? { 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1' } : {}),
				},
				...(body ? { body: JSON.stringify(body) } : {}),
				signal: abort.signal,
				redirect: 'error',
			})
		} catch {
			throw new Unknown(abort.signal.aborted ? 'deadline' : 'transport')
		}
		if (!response.ok)
			throw new Unknown(
				response.status === 401 || response.status === 403 ? 'authorization' : 'http',
			)
		const reader = response.body?.getReader()
		if (!reader) throw new Unknown('response_invalid')
		const chunks: Uint8Array[] = []
		let size = 0
		try {
			for (;;) {
				const { value, done } = await reader.read()
				if (done) break
				size += value.byteLength
				if (size > 1_048_576) throw new Unknown('response_limit')
				chunks.push(value)
			}
		} finally {
			await reader.cancel().catch(() => {})
		}
		return Buffer.concat(chunks).toString('utf8')
	}
	const result = await run(config, {
		now: Date.now,
		requestId: requestIdentity,
		read: async (url, headers, body) => {
			try {
				return object(JSON.parse(await request(url, headers, body)))
			} catch (error) {
				if (error instanceof Unknown) throw error
				throw new Unknown('response_invalid')
			}
		},
		pricing: (url) => request(url, { 'User-Agent': config.userAgent }),
		hosted: async (url, product, amount, currency) => {
			const { chromium } = await import('playwright')
			const browser = await chromium.launch({
				headless: true,
				executablePath: process.env.PUZZLED_CHECKOUT_CHROMIUM_PATH || undefined,
				timeout: Math.max(1, deadline - Date.now()),
			})
			try {
				const page = await browser.newPage()
				page.setDefaultTimeout(Math.max(1, deadline - Date.now()))
				await page.goto(url, {
					waitUntil: 'domcontentloaded',
					timeout: Math.max(1, deadline - Date.now()),
				})
				await page.locator('button[type="submit"]').first().waitFor({ state: 'visible' })
				const body = await page.locator('body').innerText()
				const price = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
					amount / 100,
				)
				let card = false
				for (const frame of page.frames()) {
					if (
						await frame
							.locator('#cardNumber, input[autocomplete="cc-number"], input[name="cardnumber"]')
							.count()
					)
						card = true
				}
				return body.includes(product) && body.includes(price) && card
			} catch {
				throw new Unknown('hosted_readiness_unconfirmed')
			} finally {
				await browser.close()
			}
		},
	})
	clearTimeout(timer)
	// Fixed fields only. Never serialize a provider response, URL or exception.
	console.log(JSON.stringify(result.receipt))
	process.exit(result.exit)
}
