/**
 * The dated-deep-link contract (G1).
 *
 * `resolveGameDayRequest` is what the module page uses to turn a query string
 * into the day and the mode it asks the server for. These tests pin both halves
 * of the contract:
 *
 *  - a shared dated link resolves the SHARED day, with or without the archive
 *    flag, so a link shared before the flag existed still lands on that day;
 *  - today, the future and malformed days are not archive days — the request
 *    stays today's ritual, so the archive badge can never be shown over today's
 *    board and a crafted flag cannot summon another day's content.
 */
import { describe, expect, test } from 'bun:test'
import { resolveGameDayRequest } from './day-request'

/** 2026-09-19T04:00Z = 2026-09-19 12:00 HKT, so the product day is 2026-09-19. */
const NOW = new Date('2026-09-19T04:00:00Z')

describe('resolveGameDayRequest', () => {
	test('a shared dated link resolves the shared day', () => {
		expect(resolveGameDayRequest({ mode: 'archive', date: '2026-09-10' }, NOW)).toEqual({
			mode: 'archive',
			puzzleDate: '2026-09-10',
		})
	})

	test('a legacy dated link without the flag resolves the same day', () => {
		expect(resolveGameDayRequest({ date: '2026-09-10' }, NOW)).toEqual({
			mode: 'archive',
			puzzleDate: '2026-09-10',
		})
	})

	test('the day before the product day is an archive day', () => {
		expect(resolveGameDayRequest({ date: '2026-09-18' }, NOW)).toEqual({
			mode: 'archive',
			puzzleDate: '2026-09-18',
		})
	})

	test("no day asks for today's ritual", () => {
		expect(resolveGameDayRequest({}, NOW)).toEqual({ mode: 'daily' })
		expect(resolveGameDayRequest({ mode: 'archive' }, NOW)).toEqual({ mode: 'daily' })
		expect(resolveGameDayRequest({ date: '' }, NOW)).toEqual({ mode: 'daily' })
	})

	test('the flag never overrides the day', () => {
		// Both directions: the flag cannot archive today, and it cannot re-open a
		// past day as daily. The day is the authority.
		expect(resolveGameDayRequest({ mode: 'archive', date: '2026-09-19' }, NOW)).toEqual({
			mode: 'daily',
		})
		expect(resolveGameDayRequest({ mode: 'daily', date: '2026-09-10' }, NOW)).toEqual({
			mode: 'archive',
			puzzleDate: '2026-09-10',
		})
	})

	test('a future day is not an archive day', () => {
		expect(resolveGameDayRequest({ mode: 'archive', date: '2026-09-20' }, NOW)).toEqual({
			mode: 'daily',
		})
	})

	test('malformed and impossible days are ignored', () => {
		for (const date of ['nope', '2026-9-10', '20260910', '2026-02-30', '2026-13-01', '   ']) {
			expect(resolveGameDayRequest({ mode: 'archive', date }, NOW)).toEqual({ mode: 'daily' })
		}
	})

	test('the roll-over is the HKT product day, not UTC midnight', () => {
		const beforeRollover = new Date('2026-09-18T15:59:59Z') // 23:59:59 HKT on the 18th
		expect(resolveGameDayRequest({ date: '2026-09-18' }, beforeRollover)).toEqual({ mode: 'daily' })
		expect(resolveGameDayRequest({ date: '2026-09-17' }, beforeRollover)).toEqual({
			mode: 'archive',
			puzzleDate: '2026-09-17',
		})
		const afterRollover = new Date('2026-09-18T16:00:00Z') // 00:00 HKT on the 19th
		expect(resolveGameDayRequest({ date: '2026-09-18' }, afterRollover)).toEqual({
			mode: 'archive',
			puzzleDate: '2026-09-18',
		})
	})
})
