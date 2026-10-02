import { describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import { ListPlansResponseSchema } from '@/gen/connect/puzzled/v1/billing_pb'
import {
	availableCurrencies,
	chooseCurrency,
	defaultCurrency,
	normalizeCurrency,
	serializeCurrencyCookie,
} from './currency'

const both = ['gbp', 'usd']

describe('display currency', () => {
	test('country decides the default, then locale region, then dollars', () => {
		expect(defaultCurrency('GB', 'en-US')).toBe('gbp')
		expect(defaultCurrency('gb', 'zh-HK')).toBe('gbp')
		expect(defaultCurrency('US', 'en-GB')).toBe('usd')
		expect(defaultCurrency(null, 'en-GB')).toBe('gbp')
		expect(defaultCurrency('XX', 'en-GB')).toBe('gbp')
		expect(defaultCurrency('T1', 'en-US')).toBe('usd')
		expect(defaultCurrency(undefined, 'zh-TW')).toBe('usd')
	})

	test('the visitor choice beats geography, but only if the catalogue publishes it', () => {
		const base = { country: 'GB', locale: 'en-US' }
		expect(chooseCurrency({ ...base, cookie: 'usd', available: both })).toBe('usd')
		expect(chooseCurrency({ ...base, cookie: 'eur', available: both })).toBe('gbp')
		expect(chooseCurrency({ ...base, cookie: null, available: ['usd'] })).toBe('usd')
		expect(chooseCurrency({ ...base, cookie: 'GBP', available: both })).toBe('gbp')
		expect(chooseCurrency({ ...base, cookie: null, available: ['eur'] })).toBe('eur')
	})

	test('malformed codes are rejected', () => {
		expect(normalizeCurrency('GBP')).toBe('gbp')
		expect(normalizeCurrency('gb;x')).toBeNull()
		expect(normalizeCurrency('')).toBeNull()
	})

	test('only currencies every plan publishes are offered', () => {
		const plans = create(ListPlansResponseSchema, {
			plans: [
				{
					id: 'a',
					prices: [
						{ currency: 'usd', unitAmountMinor: BigInt(1) },
						{ currency: 'gbp', unitAmountMinor: BigInt(1) },
					],
				},
				{ id: 'b', prices: [{ currency: 'usd', unitAmountMinor: BigInt(1) }] },
			],
		}).plans
		expect(availableCurrencies(plans)).toEqual(['usd'])
		expect(availableCurrencies([])).toEqual([])
	})

	test('cookie is first-party, a year long and secure when asked', () => {
		expect(serializeCurrencyCookie('gbp', true)).toBe(
			'puzzled_currency=gbp; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
		)
	})
})
