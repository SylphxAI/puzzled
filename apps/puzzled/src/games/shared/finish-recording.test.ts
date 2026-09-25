/**
 * Archive finishes (F3): the recording decision, without a React renderer.
 *
 * An archive board is dated; the kernel records one finish
 * per (user, module, day_key) for past days too, so the client must record the
 * day it was served for — and must never let a missing day fall through to the
 * server's "today" default as a ritually-counted daily finish.
 */
import { describe, expect, test } from 'bun:test'
import { finishRecordingFor } from './finish-recording'

/** 2026-09-19T04:00:00Z = 12:00 HKT on 2026-09-19, so the product day is the 19th. */
const NOW = new Date('2026-09-19T04:00:00Z')

describe('finishRecordingFor', () => {
	test('daily submits the served day while it is still the product day', () => {
		expect(finishRecordingFor({ mode: 'daily', puzzleDate: '2026-09-19', now: NOW })).toEqual({
			record: true,
			mode: 'daily',
			puzzleDate: '2026-09-19',
		})
	})

	test('daily drops a day that rolled over, so the server derives it', () => {
		// Served on the 18th, finished after HKT midnight: the explicit day would
		// read as an archive request and demand entitlement.
		expect(finishRecordingFor({ mode: 'daily', puzzleDate: '2026-09-18', now: NOW })).toEqual({
			record: true,
			mode: 'daily',
		})
	})

	test('daily without a day keeps the original shape', () => {
		expect(finishRecordingFor({ mode: 'daily', now: NOW })).toEqual({ record: true, mode: 'daily' })
		expect(finishRecordingFor({ now: NOW })).toEqual({ record: true, mode: 'daily' })
		// A day the calendar does not have is not forwarded either.
		expect(finishRecordingFor({ mode: 'daily', puzzleDate: '2026-02-30', now: NOW })).toEqual({
			record: true,
			mode: 'daily',
		})
	})

	test('archive records the day it was served for, as archive', () => {
		expect(finishRecordingFor({ mode: 'archive', puzzleDate: '2026-09-16', now: NOW })).toEqual({
			record: true,
			mode: 'archive',
			archiveDate: '2026-09-16',
		})
	})

	test('archive without a real served day records nothing', () => {
		for (const puzzleDate of [undefined, '', '   ', 'nope', '2026-02-30', '2026-9-16']) {
			expect(finishRecordingFor({ mode: 'archive', puzzleDate, now: NOW })).toEqual({
				record: false,
				reason: 'archive_day_unknown',
			})
		}
	})
})
