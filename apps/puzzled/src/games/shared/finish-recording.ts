/**
 * What a finished game session records (presentation layer).
 *
 * `useGameSession` submitted only `mode === 'daily'`, so an archive board was
 * never recorded even though the Connect submit path already accepts a past day
 * (`lib/api/hooks.ts` `SaveResultInput.archiveDate`) and the kernel derives the
 * mode from the requested date and guards one finish per
 * (user, module, day_key) — see `crates/puzzled-server/src/bootstrap/
 * connect_puzzle.rs` `SubmitGuess`.
 *
 * The decision lives here so it can be asserted without a React renderer:
 *
 * - `daily` — today's ritual. The served day is submitted only while it is
 *   still the product day (Asia/Hong_Kong); across HKT midnight the day is
 *   omitted so the server derives it, and a finish that straddles the
 *   roll-over is never mistaken for an archive read (which demands
 *   entitlement).
 * - `archive` — a dated finish. Without the day the board was served for
 *   there is nothing honest to record: the server would read a missing day as
 *   today, so the session records nothing instead.
 */

import type { GameMode } from '@/lib/db/schema'
import { isValidDayKey, productDayKey } from '@/lib/product-day'

export type FinishRecording =
	| { record: true; mode: GameMode; puzzleDate?: string; archiveDate?: string }
	| { record: false; reason: 'archive_day_unknown' }

export function finishRecordingFor(input: {
	mode?: GameMode
	/** Product day key the board was served for, when the page knew it. */
	puzzleDate?: string
	now?: Date
}): FinishRecording {
	const day = typeof input.puzzleDate === 'string' ? input.puzzleDate.trim() : ''

	if (input.mode === 'archive') {
		if (!isValidDayKey(day)) return { record: false, reason: 'archive_day_unknown' }
		return { record: true, mode: 'archive', archiveDate: day }
	}

	// Daily: the pre-existing submission shape — no day unless the served day is
	// still the product day.
	const now = input.now ?? new Date()
	return {
		record: true,
		mode: 'daily',
		...(isValidDayKey(day) && day === productDayKey(now) ? { puzzleDate: day } : {}),
	}
}
