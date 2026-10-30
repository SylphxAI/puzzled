import { describe, expect, test } from 'bun:test'
import {
	type Config,
	type Json,
	type Mode,
	type Ports,
	requestIdentity,
	run,
	Unknown,
} from '../../../scripts/checkout-journey'

const home = 'orgs/example/projects/example/envs/example'
const sessionName = `${home}/checkout_sessions/chk-example`
const privateUrl = 'https://checkout.stripe.com/c/pay/cs_live_example#private-bearer'
function fixture() {
	const config: Config = {
		mode: 'prod-unpaid',
		baseUrl: 'https://product.example',
		moneyOrigin: 'https://money.example',
		environment: home,
		moneyReadKey: 'private-read-key',
		session: 'private-fixture-session',
		userAgent: 'checkout-check/1',
		fixtureKey: 'checkout-owned',
		merchantAccount: 'acct_example',
		consent: true,
		currency: 'usd',
		deadline: 60_000,
	}
	const session: Json = {
		name: sessionName,
		state: 'open',
		livemode: true,
		amount_total: '99',
		currency_code: 'USD',
		payment_status: 'unpaid',
		processor_session_id: 'cs_live_example',
		url: privateUrl,
		line_items: [{ price: 'puzzled_starter_unlock', quantity: '1' }],
	}
	const catalogue: Json = {
		name: `${home}/price_catalogs/default`,
		meta: { generation: '2' },
		status: {
			processor_price_ids: { puzzled_starter_unlock: 'price_example' },
			conditions: [{ type: 'Synced', status: 'true', observed_generation: '2' }],
		},
		spec: {
			products: [
				{
					key: 'puzzled_starter',
					licence: {
						plan: 'plus',
						token_product: 'puzzled',
						key: 'puzzled_plus',
						term: { unit: 'days', count: 3 },
					},
					features: { plus: 'true', seats: '1' },
					prices: [{ key: 'puzzled_starter_unlock', unit_amounts: { USD: '99', GBP: '79' } }],
				},
			],
		},
	}
	const merchant: Json = {
		name: `${home}/merchant_accounts/default`,
		account_id: 'acct_example',
		processor: 'stripe',
		state: 'connected',
		charges_enabled: true,
		livemode: true,
	}
	let state = 'absent'
	let identity = '01900000-0000-7000-8000-000000000001'
	let clock = 0
	let loseReply = false
	let hosted = true
	const calls: { url: string; body?: Json; headers?: Record<string, string> }[] = []
	const ports: Ports = {
		now: () => clock,
		requestId: requestIdentity,
		pricing: async () => '3-day pass $0.99',
		hosted: async () => hosted,
		read: async (url, _headers, body) => {
			calls.push({ url, body, headers: _headers })
			if (url.endsWith('/ListPlans'))
				return {
					salesOpen: true,
					plans: [
						{
							id: 'individual_once',
							accessDays: 3,
							prices: [{ currency: 'usd', unitAmountMinor: '99' }],
						},
					],
				}
			if (url.endsWith('/whoami')) return { env: home }
			if (url.endsWith('/price_catalogs/default')) return catalogue
			if (url.endsWith('/merchant_accounts/default')) return merchant
			if (url.endsWith('/GetCheckout'))
				return {
					state,
					requestId: identity,
					syntheticFixture: 'checkout-owned',
					moneySessionName: sessionName,
					processorSessionId: session.processor_session_id,
				}
			if (url.endsWith('/CreateCheckoutAttempt')) {
				identity = String(body?.requestId)
				state = loseReply ? 'pending' : 'ready'
				if (loseReply) throw new Unknown('transport')
				return { url: privateUrl }
			}
			if (url.endsWith('/checkout_sessions/chk-example')) return session
			throw new Error('unexpected fixture route')
		},
	}
	return {
		config,
		session,
		catalogue,
		merchant,
		ports,
		calls,
		setState: (value: string) => {
			state = value
		},
		setClock: (value: number) => {
			clock = value
		},
		loseReply: () => {
			loseReply = true
		},
		noForm: () => {
			hosted = false
		},
		creates: () => calls.filter((call) => call.url.endsWith('/CreateCheckoutAttempt')),
	}
}

describe('unpaid checkout bundle source contract (no processor receipt)', () => {
	test('all required steps precede exit zero and output contains only fixed diagnostics', async () => {
		const f = fixture()
		const result = await run(f.config, f.ports)
		expect(result.exit).toBe(0)
		expect(result.receipt.steps.map((step) => step.id)).toEqual([
			'public-pricing',
			'catalogue',
			'merchant',
			'fixture',
			'attempt',
			'session-readback',
			'hosted-form',
		])
		expect(f.creates()).toHaveLength(1)
		expect(f.calls.find((call) => call.url.endsWith('/ListPlans'))?.headers).not.toHaveProperty(
			'Authorization',
		)
		expect(f.creates()[0].body).toMatchObject({
			requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
			immediateSupplyConsent: true,
			planId: 'individual_once',
		})
		const output = JSON.stringify(result.receipt)
		for (const secret of [
			privateUrl,
			'private-read-key',
			'private-fixture-session',
			home,
			'cs_live_example',
		])
			expect(output).not.toContain(secret)
	})
	test('a retained open session is freshly read without a second create', async () => {
		const f = fixture()
		f.setState('ready')
		expect((await run(f.config, f.ports)).exit).toBe(0)
		expect(f.creates()).toHaveLength(0)
		expect(
			f.calls.filter((call) => call.url.endsWith('/checkout_sessions/chk-example')),
		).toHaveLength(2)
	})
	test('an unresolved call stays pending across invocations with no replay', async () => {
		const f = fixture()
		f.loseReply()
		expect((await run(f.config, f.ports)).exit).toBe(2)
		const next = await run(f.config, f.ports)
		expect(next.exit).toBe(2)
		expect(next.receipt.steps.at(-1)?.code).toBe('attempt_pending')
		expect(f.creates()).toHaveLength(1)
	})
	test.each(['pending', 'refused'])('never replaces a %s attempt', async (state) => {
		const f = fixture()
		f.setState(state)
		const result = await run(f.config, f.ports)
		expect(result.exit).toBe(state === 'pending' ? 2 : 42)
		expect(f.creates()).toHaveLength(0)
	})
	test('empty synced catalogue is a completed semantic failure', async () => {
		const f = fixture()
		f.catalogue.spec = { products: [] }
		const result = await run(f.config, f.ports)
		expect(result.exit).toBe(42)
		expect(result.receipt.steps.at(-1)?.code).toBe('catalogue_offer_missing')
		expect(f.creates()).toHaveLength(0)
	})
	test('an earlier sync generation cannot pass', async () => {
		const f = fixture()
		f.catalogue.meta = { generation: '3' }
		expect((await run(f.config, f.ports)).exit).toBe(42)
		expect(f.creates()).toHaveLength(0)
	})
	test('wrong merchant mode refuses before any checkout', async () => {
		const f = fixture()
		f.merchant.livemode = false
		expect((await run(f.config, f.ports)).exit).toBe(42)
		expect(f.creates()).toHaveLength(0)
	})
	test.each([
		'livemode',
		'amount_total',
		'currency_code',
		'payment_status',
	])('rejects wrong session %s', async (field) => {
		const f = fixture()
		f.session[field] = field === 'livemode' ? false : 'wrong'
		expect((await run(f.config, f.ports)).exit).not.toBe(0)
	})
	test('fixture identity drift refuses before creating', async () => {
		const f = fixture()
		f.config.fixtureKey = 'another-fixture'
		expect((await run(f.config, f.ports)).exit).toBe(42)
		expect(f.creates()).toHaveLength(0)
	})
	test('a live paid session is a failure and never replaced', async () => {
		const f = fixture()
		f.setState('ready')
		f.session.payment_status = 'paid'
		expect((await run(f.config, f.ports)).exit).toBe(42)
		expect(f.creates()).toHaveLength(0)
	})
	test('a loaded hosted page without the required form cannot pass', async () => {
		const f = fixture()
		f.noForm()
		expect((await run(f.config, f.ports)).exit).toBe(42)
	})
	test('browser and transport exceptions stay unknown and never serialize the exception', async () => {
		const f = fixture()
		f.ports.hosted = async () => {
			throw new Error(privateUrl)
		}
		const result = await run(f.config, f.ports)
		expect(result.exit).toBe(2)
		expect(JSON.stringify(result)).not.toContain(privateUrl)
	})
	test('a step finishing after the deadline cannot pass', async () => {
		const f = fixture()
		f.ports.hosted = async () => {
			f.setClock(60_001)
			return true
		}
		const result = await run(f.config, f.ports)
		expect(result.exit).toBe(2)
		expect(result.receipt.steps.at(-1)?.code).toBe('deadline')
	})
	test('incomplete Test payment evidence cannot report a passing Test run', async () => {
		const f = fixture()
		f.config.mode = 'test-payment'
		f.merchant.livemode = false
		const result = await run(f.config, f.ports)
		expect(result.exit).toBe(2)
		expect(result.receipt.steps.at(-1)?.code).toBe('test_acceptance_unavailable')
		expect(f.creates()).toHaveLength(0)
	})
	test('an uncertain request that never reached admission keeps its exact identity', async () => {
		const f = fixture()
		const original = f.ports.read
		f.ports.read = async (url, headers, body) => {
			if (url.endsWith('/CreateCheckoutAttempt')) {
				f.calls.push({ url, body })
				throw new Unknown('transport')
			}
			return original(url, headers, body)
		}
		await run(f.config, f.ports)
		await run(f.config, f.ports)
		expect(f.creates()).toHaveLength(2)
		expect(f.creates()[0].body?.requestId).toBe(f.creates()[1].body?.requestId)
	})
	test('a confirmed unpaid expiry selects one stable successor and then reuses it', async () => {
		const f = fixture()
		f.setState('ready')
		f.session.state = 'expired'
		const original = f.ports.read
		f.ports.read = async (url, headers, body) => {
			const result = await original(url, headers, body)
			if (url.endsWith('/CreateCheckoutAttempt')) f.session.state = 'open'
			return result
		}
		expect((await run(f.config, f.ports)).exit).toBe(0)
		expect((await run(f.config, f.ports)).exit).toBe(0)
		expect(f.creates()).toHaveLength(1)
	})
	test('a wrong-mode expired session never authorizes a replacement', async () => {
		const f = fixture()
		f.setState('ready')
		f.session.state = 'expired'
		f.session.livemode = false
		const result = await run(f.config, f.ports)
		expect(result.receipt.steps.at(-1)?.code).toBe('session_mode_mismatch')
		expect(f.creates()).toHaveLength(0)
	})
	test('an arbitrary exception code cannot leak into a receipt', async () => {
		const f = fixture()
		f.ports.hosted = async () => {
			throw new Unknown(privateUrl)
		}
		const result = await run(f.config, f.ports)
		expect(result.exit).toBe(2)
		expect(result.receipt.steps.at(-1)?.code).toBe('runtime')
		expect(JSON.stringify(result.receipt)).not.toContain(privateUrl)
	})
	test('missing processor price refuses a synced catalogue', async () => {
		const f = fixture()
		;(f.catalogue.status as Json).processor_price_ids = {}
		const result = await run(f.config, f.ports)
		expect(result.receipt.steps.at(-1)?.code).toBe('catalogue_processor_missing')
		expect(f.creates()).toHaveLength(0)
	})
	test('a different connected live merchant cannot pass', async () => {
		const f = fixture()
		f.merchant.account_id = 'acct_other'
		const result = await run(f.config, f.ports)
		expect(result.receipt.steps.at(-1)?.code).toBe('merchant_binding_mismatch')
		expect(f.creates()).toHaveLength(0)
	})
	test('invalid configuration cannot echo an arbitrary mode into diagnostic output', async () => {
		const f = fixture()
		f.config.mode = 'private-unrecognized-value' as Mode
		const result = await run(f.config, f.ports)
		expect(result.exit).toBe(2)
		expect(JSON.stringify(result.receipt)).not.toContain('private-unrecognized-value')
	})
})
