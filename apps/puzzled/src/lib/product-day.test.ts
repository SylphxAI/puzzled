import { describe, expect, test } from 'bun:test'
import {
	isServedPuzzleId,
	isValidDayKey,
	ordinal0FromDayKey,
	PRODUCT_DAY_TZ,
	parseDayKey,
	productDayKey,
	resolveArchiveDayKey,
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

describe('isValidDayKey', () => {
	test('accepts real calendar days', () => {
		expect(isValidDayKey('2026-08-12')).toBe(true)
		expect(isValidDayKey('2028-02-29')).toBe(true)
	})

	test('rejects impossible and malformed days', () => {
		for (const value of [
			'2026-02-30',
			'2027-02-29',
			'2026-13-01',
			'2026-00-10',
			'2026-8-12',
			'20260812',
			'nope',
			'',
		]) {
			expect(isValidDayKey(value)).toBe(false)
		}
	})

	test('trims surrounding whitespace', () => {
		expect(isValidDayKey(' 2026-08-12 ')).toBe(true)
	})
})

describe('parseDayKey', () => {
	test('parses the parts of a well-formed key, trimming the edges', () => {
		expect(parseDayKey('2026-09-21')).toEqual({ year: 2026, month: 9, day: 21 })
		expect(parseDayKey(' 2026-09-21 ')).toEqual({ year: 2026, month: 9, day: 21 })
	})

	test('is shape-only: impossible calendar days parse for the arithmetic', () => {
		// The two old copies diverged exactly here: `isValidDayKey` rejected days
		// the arithmetic accepted and carried through Date.UTC.
		expect(parseDayKey('2026-02-30')).toEqual({ year: 2026, month: 2, day: 30 })
		expect(isValidDayKey('2026-02-30')).toBe(false)
		expect(ordinal0FromDayKey('2026-02-30')).toBe(60) // the arithmetic lands on 2026-03-02

		expect(parseDayKey('2026-13-01')).toEqual({ year: 2026, month: 13, day: 1 })
		expect(isValidDayKey('2026-13-01')).toBe(false)
		expect(ordinal0FromDayKey('2026-13-01')).toBe(365) // the arithmetic lands on 2027-01-01
	})

	test('rejects malformed shapes and non-strings', () => {
		for (const value of ['2026-9-21', '20260921', '2026/09/21', 'nope', '', undefined, null]) {
			expect(parseDayKey(value)).toBeUndefined()
		}
	})
})

describe('resolveArchiveDayKey', () => {
	const hktNoon = new Date('2026-09-19T04:00:00Z') // 2026-09-19 12:00 HKT

	test('resolves a real past day', () => {
		expect(resolveArchiveDayKey('2026-09-10', hktNoon)).toBe('2026-09-10')
	})

	test('today is not an archive day', () => {
		expect(resolveArchiveDayKey('2026-09-19', hktNoon)).toBeUndefined()
	})

	test('future, impossible and missing days are not archive days', () => {
		expect(resolveArchiveDayKey('2026-09-20', hktNoon)).toBeUndefined()
		expect(resolveArchiveDayKey('2026-02-30', hktNoon)).toBeUndefined()
		expect(resolveArchiveDayKey('nope', hktNoon)).toBeUndefined()
		expect(resolveArchiveDayKey('', hktNoon)).toBeUndefined()
		expect(resolveArchiveDayKey(undefined, hktNoon)).toBeUndefined()
	})

	test('the boundary is the HKT product day, not UTC midnight', () => {
		// 2026-09-18T15:59:59Z is 23:59:59 HKT on the 18th: the 18th is still today.
		const beforeRollover = new Date('2026-09-18T15:59:59Z')
		expect(resolveArchiveDayKey('2026-09-18', beforeRollover)).toBeUndefined()
		expect(resolveArchiveDayKey('2026-09-17', beforeRollover)).toBe('2026-09-17')
		// One second later HKT has rolled to the 19th, so the 18th becomes archive.
		const afterRollover = new Date('2026-09-18T16:00:00Z')
		expect(resolveArchiveDayKey('2026-09-18', afterRollover)).toBe('2026-09-18')
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
