import { describe, expect, test } from 'bun:test'
import { annualSavingsPercent, formatAmount, selectPaidPlans } from './pricing-plans'

describe('selectPaidPlans', () => {
	test('reads both intervals from one price code', () => {
		const selected = selectPaidPlans([
			{ slug: 'free' },
			{ slug: 'premium', monthlyPrice: 499, annualPrice: 3999 },
		])
		expect(selected.monthly?.slug).toBe('premium')
		expect(selected.annual?.slug).toBe('premium')
		expect(selected.comparable).toBe(true)
	})

	test('keeps two price codes as two products and refuses to compare them', () => {
		const selected = selectPaidPlans([
			{ slug: 'premium-monthly', monthlyPrice: 499 },
			{ slug: 'premium-yearly', annualPrice: 3999 },
		])
		expect(selected.monthly?.slug).toBe('premium-monthly')
		expect(selected.annual?.slug).toBe('premium-yearly')
		expect(selected.comparable).toBe(false)
	})

	test('an empty or free-only price list yields no prices', () => {
		const selected = selectPaidPlans([{ slug: 'free' }])
		expect(selected.monthly).toBeNull()
		expect(selected.annual).toBeNull()
		expect(selected.comparable).toBe(false)
	})

	test('ignores zero and missing amounts instead of inventing a price', () => {
		const selected = selectPaidPlans([
			{ slug: 'premium', monthlyPrice: 0 },
			{ slug: 'premium-yearly', annualPrice: 0 },
		])
		expect(selected.monthly).toBeNull()
		expect(selected.annual).toBeNull()
	})

	test('an annual-only price code never becomes the monthly price', () => {
		const selected = selectPaidPlans([{ slug: 'premium', annualPrice: 3999 }])
		expect(selected.monthly).toBeNull()
		expect(selected.annual?.slug).toBe('premium')
		expect(selected.comparable).toBe(false)
	})
})

describe('annualSavingsPercent', () => {
	test('computes the real saving for the annual interval', () => {
		expect(annualSavingsPercent(499, 3999, true)).toBe(33)
	})

	test('returns null when the intervals are not comparable', () => {
		expect(annualSavingsPercent(499, 3999, false)).toBeNull()
	})

	test('returns null when a price is missing', () => {
		expect(annualSavingsPercent(null, 3999, true)).toBeNull()
		expect(annualSavingsPercent(499, null, true)).toBeNull()
	})

	test('returns null when the year does not cost less', () => {
		expect(annualSavingsPercent(499, 5988, true)).toBeNull()
		expect(annualSavingsPercent(499, 7000, true)).toBeNull()
	})

	test('never rounds a saving up', () => {
		// 0.5% is real but not worth a badge, and 8.33% must not print as 9%.
		expect(annualSavingsPercent(1000, 11940, true)).toBeNull()
		expect(annualSavingsPercent(1000, 11000, true)).toBe(8)
	})
})

describe('formatAmount', () => {
	test('renders minor units with the currency symbol', () => {
		expect(formatAmount(499, 'en-US')).toBe('$4.99')
		expect(formatAmount(3999, 'en-US')).toBe('$39.99')
		expect(formatAmount(0, 'en-US')).toBe('$0.00')
	})
})
