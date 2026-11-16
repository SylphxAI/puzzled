import { describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import { ListPlansResponseSchema } from '@/gen/connect/puzzled/v1/billing_pb'
import {
	availableCurrencies,
	chooseCurrency,
	currencyOptionLabel,
	defaultCurrency,
	normalizeCurrency,
	serializeCurrencyCookie,
} from './currency'

const both = ['gbp', 'usd']

describe('display currency', () => {
	test('country decides the default across all 16 supported currency regions, then locale region, then dollars', () => {
		expect(defaultCurrency('GB', 'en-US')).toBe('gbp')
		expect(defaultCurrency('gb', 'zh-HK')).toBe('gbp')
		expect(defaultCurrency('IM', 'en-US')).toBe('gbp')
		expect(defaultCurrency('US', 'en-GB')).toBe('usd')
		expect(defaultCurrency('HK', 'en-US')).toBe('hkd')
		expect(defaultCurrency('TW', 'en-US')).toBe('twd')
		expect(defaultCurrency('JP', 'en-US')).toBe('jpy')
		expect(defaultCurrency('KR', 'en-US')).toBe('krw')
		expect(defaultCurrency('MY', 'en-US')).toBe('myr')
		expect(defaultCurrency('SG', 'en-US')).toBe('sgd')
		expect(defaultCurrency('CA', 'en-US')).toBe('cad')
		expect(defaultCurrency('AU', 'en-US')).toBe('aud')
		expect(defaultCurrency('NZ', 'en-US')).toBe('nzd')
		expect(defaultCurrency('TH', 'en-US')).toBe('thb')
		expect(defaultCurrency('PH', 'en-US')).toBe('php')
		expect(defaultCurrency('ID', 'en-US')).toBe('idr')
		expect(defaultCurrency('VN', 'en-US')).toBe('vnd')
		expect(defaultCurrency('DE', 'en-US')).toBe('eur')
		expect(defaultCurrency('FR', 'en-US')).toBe('eur')
		expect(defaultCurrency('ES', 'en-US')).toBe('eur')
		expect(defaultCurrency('BG', 'en-US')).toBe('eur')
		expect(defaultCurrency('BR', 'pt-BR')).toBe('usd')
		expect(defaultCurrency(null, 'en-GB')).toBe('gbp')
		expect(defaultCurrency('XX', 'en-GB')).toBe('gbp')
		expect(defaultCurrency('T1', 'en-US')).toBe('usd')
		expect(defaultCurrency(undefined, 'zh-HK')).toBe('hkd')
		expect(defaultCurrency(undefined, 'zh-TW')).toBe('twd')
		expect(defaultCurrency(undefined, 'ja')).toBe('jpy')
		expect(defaultCurrency(undefined, 'zh-CN')).toBe('usd')
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

	test('only currencies every plan publishes are offered, with USD/GBP/EUR first then alphabetical', () => {
		const plans = create(ListPlansResponseSchema, {
			plans: [
				{
					id: 'a',
					prices: [
						{ currency: 'jpy', unitAmountMinor: BigInt(1) },
						{ currency: 'usd', unitAmountMinor: BigInt(1) },
						{ currency: 'eur', unitAmountMinor: BigInt(1) },
						{ currency: 'gbp', unitAmountMinor: BigInt(1) },
					],
				},
				{
					id: 'b',
					prices: [
						{ currency: 'usd', unitAmountMinor: BigInt(1) },
						{ currency: 'gbp', unitAmountMinor: BigInt(1) },
						{ currency: 'jpy', unitAmountMinor: BigInt(1) },
					],
				},
			],
		}).plans
		expect(availableCurrencies(plans)).toEqual(['usd', 'gbp', 'jpy'])
		expect(availableCurrencies([])).toEqual([])
	})

	test('option labels combine uppercase ISO code and localized currency name', () => {
		expect(currencyOptionLabel('usd', 'en-US')).toBe('USD — US Dollar')
		expect(currencyOptionLabel('jpy', 'ja')).toContain('JPY — ')
	})

	test('cookie is first-party, a year long and secure when asked', () => {
		expect(serializeCurrencyCookie('gbp', true)).toBe(
			'puzzled_currency=gbp; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
		)
	})
})
