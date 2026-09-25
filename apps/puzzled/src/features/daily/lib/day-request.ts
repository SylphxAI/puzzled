/**
 * Dated-deep-link resolution for a module page (G1).
 *
 * A share card links `/games/<slug>?mode=archive&date=YYYY-MM-DD`. The landing
 * has to answer two questions from that query alone: which product day, and is
 * this the archive or today's ritual?
 *
 * The answer is: **the day decides, the flag only corroborates.** A day that is
 * a real calendar day strictly before today (Asia/Hong_Kong) is an archive day
 * whether or not the flag survived the paste — links shared before the flag
 * existed still land on their day. Today, the future and malformed days are not
 * archive days, so a crafted `mode=archive` cannot archive *today*, and the
 * archive badge can never render over today's board.
 *
 * Admission and entitlement are not decided here: the page forwards the day to
 * Connect, where the kernel serves the dated puzzle, refuses a future day, and
 * derives completion for (identity, module, day_key).
 */

import type { GameMode } from '@/lib/db/schema'
import { resolveArchiveDayKey } from '@/lib/product-day'

export type GameDayRequest = {
	mode: GameMode
	/** The archive day key; absent for today's ritual. */
	puzzleDate?: string
}

export type GameDayQuery = {
	mode?: string | undefined
	date?: string | undefined
}

export function resolveGameDayRequest(query: GameDayQuery, now: Date = new Date()): GameDayRequest {
	const puzzleDate = resolveArchiveDayKey(query.date, now)
	if (puzzleDate) return { mode: 'archive', puzzleDate }
	return { mode: 'daily' }
}
