import { describe, expect, test } from 'bun:test'
import {
	budgetFailures,
	markdownTable,
	percentile,
	summarise,
} from '../e2e-tests/web-vitals-support'

describe('web vitals gate maths', () => {
	test('p75 is nearest rank', () => {
		expect(percentile([10, 20, 30, 40], 75)).toBe(30)
		expect(percentile([5], 75)).toBe(5)
		expect(percentile([], 75)).toBeNull()
	})

	test('a regression over budget fails, within budget passes', () => {
		const ok = summarise('/', [
			{ lcp: 1000, inp: 100 },
			{ lcp: 1200, inp: 150 },
			{ lcp: 1100, inp: 120 },
			{ lcp: 5000, inp: 900 },
		])
		expect(budgetFailures(ok)).toEqual([])
		const bad = summarise('/games', [
			{ lcp: 3000, inp: 700 },
			{ lcp: 3200, inp: 800 },
		])
		expect(budgetFailures(bad)).toHaveLength(2)
	})

	test('a route with no sample fails the gate', () => {
		const empty = summarise('/x', [{ lcp: null, inp: null }])
		expect(budgetFailures(empty)).toHaveLength(2)
	})

	test('the report names every route', () => {
		const table = markdownTable([summarise('/', [{ lcp: 900, inp: 80 }])])
		expect(table).toContain('| / | 1 | 900 ms | 80 ms |')
	})
})
