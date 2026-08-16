import { describe, expect, test } from 'bun:test'
import {
	dayKeyUtcDate,
	isServedPuzzleId,
	millisecondsUntilNextProductDay,
	nextProductDayStart,
	ordinal0FromDayKey,
	PRODUCT_DAY_TZ,
	productDayKey,
	servedPuzzleId,
	shiftDayKey,
} from './product-day'

describe('productDayKey', () => {
	test('timezone name matches ritual SSOT', () => {
		expect(PRODUCT_DAY_TZ).toBe('Asia/Hong_Kong')
	})

	test('same calendar day when UTC and HKT agree', () => {
		expect(productDayKey(new Date('2026-08-12T02:00:00Z'))).toBe('2026-08-12')
	})

	test('rolls at HKT midnight, not UTC midnight', () => {
		expect(productDayKey(new Date('2026-08-11T20:00:00Z'))).toBe('2026-08-12')
		expect(productDayKey(new Date('2026-08-12T15:59:59Z'))).toBe('2026-08-12')
		expect(productDayKey(new Date('2026-08-12T16:00:00Z'))).toBe('2026-08-13')
		expect(productDayKey(new Date('2026-08-12T20:07:00Z'))).toBe('2026-08-13')
		expect(productDayKey(new Date('2026-08-13T00:00:00Z'))).toBe('2026-08-13')
	})
})

describe('nextProductDayStart', () => {
	test('resets at HKT midnight, not UTC midnight', () => {
		const beforeReset = new Date('2026-08-12T15:59:59Z')
		expect(nextProductDayStart(beforeReset).toISOString()).toBe('2026-08-12T16:00:00.000Z')
		expect(millisecondsUntilNextProductDay(beforeReset)).toBe(1_000)

		const afterReset = new Date('2026-08-12T16:00:00Z')
		expect(nextProductDayStart(afterReset).toISOString()).toBe('2026-08-13T16:00:00.000Z')
	})
})

describe('ordinal0FromDayKey', () => {
	test('Jan 1 is 0', () => {
		expect(ordinal0FromDayKey('2026-01-01')).toBe(0)
	})

	test('2026-08-13 is 224 (matches chrono ordinal0)', () => {
		expect(ordinal0FromDayKey('2026-08-12')).toBe(223)
		expect(ordinal0FromDayKey('2026-08-13')).toBe(224)
	})

	test('rejects invalid keys', () => {
		expect(() => ordinal0FromDayKey('nope')).toThrow('invalid_day_key')
	})
})

describe('shiftDayKey', () => {
	test('includes today and rolls across month bounds', () => {
		expect(shiftDayKey('2026-08-12', 0)).toBe('2026-08-12')
		expect(shiftDayKey('2026-08-12', 1)).toBe('2026-08-13')
		expect(shiftDayKey('2026-08-31', 1)).toBe('2026-09-01')
		expect(shiftDayKey('2026-08-12', -1)).toBe('2026-08-11')
	})

	test('dayKeyUtcDate is midnight UTC of the civil key', () => {
		expect(dayKeyUtcDate('2026-08-12').toISOString()).toBe('2026-08-12T00:00:00.000Z')
	})
})

describe('servedPuzzleId', () => {
	test('accepts UUID, rejects puzzle-number fallback', () => {
		expect(isServedPuzzleId('2c1b0a4e-7f31-4c2a-9d0b-1a2b3c4d5e6f')).toBe(true)
		expect(servedPuzzleId('2c1b0a4e-7f31-4c2a-9d0b-1a2b3c4d5e6f')).toBe(
			'2c1b0a4e-7f31-4c2a-9d0b-1a2b3c4d5e6f',
		)
		expect(servedPuzzleId('956')).toBeUndefined()
		expect(servedPuzzleId('')).toBeUndefined()
		expect(servedPuzzleId(undefined)).toBeUndefined()
	})
})
