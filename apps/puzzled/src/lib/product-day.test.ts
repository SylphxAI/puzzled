import { describe, expect, test } from 'bun:test'
import {
	isServedPuzzleId,
	ordinal0FromDayKey,
	PRODUCT_DAY_TZ,
	productDayKey,
	servedPuzzleId,
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
