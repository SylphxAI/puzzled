/**
 * PuzzleService pure domain (puzzled.v1) — FCIS for GetPuzzle / GetDaily / SubmitGuess.
 */

export type GetPuzzleInput = {
	gameSlug: string
	seed: number
	difficulty?: string
}

export type GetDailyInput = {
	gameSlug: string
	difficulty?: string
	puzzleId?: string
	hasCompleted?: boolean
}

export type SubmitGuessInput = {
	gameSlug: string
	seed: number
	difficulty?: string
	status: 'won' | 'lost'
	attempts: number
	timeSpentMs: number
	/** JSON-serialisable submission payload (e.g. { finalGrid: number[][] }). */
	submission?: unknown
	/** Pre-stringified submission when already JSON. */
	submissionJson?: string
}

export function validateGetPuzzleInput(input: GetPuzzleInput): string | null {
	if (!input.gameSlug.trim()) return 'game_slug_required'
	if (input.gameSlug.length > 64) return 'game_slug_too_long'
	if (!Number.isFinite(input.seed)) return 'seed_required'
	return null
}

export function validateGetDailyInput(input: GetDailyInput): string | null {
	if (!input.gameSlug.trim()) return 'game_slug_required'
	if (input.gameSlug.length > 64) return 'game_slug_too_long'
	return null
}

export function validateSubmitGuessInput(input: SubmitGuessInput): string | null {
	if (!input.gameSlug.trim()) return 'game_slug_required'
	if (input.gameSlug.length > 64) return 'game_slug_too_long'
	if (!Number.isFinite(input.seed)) return 'seed_required'
	if (input.status !== 'won' && input.status !== 'lost') return 'status_required_won_or_lost'
	if (!Number.isFinite(input.attempts) || input.attempts < 0) return 'attempts_invalid'
	if (!Number.isFinite(input.timeSpentMs) || input.timeSpentMs < 0) return 'time_spent_ms_invalid'
	return null
}

export function encodeSubmissionJson(input: SubmitGuessInput): string {
	if (typeof input.submissionJson === 'string' && input.submissionJson.length > 0) {
		return input.submissionJson
	}
	if (input.submission === undefined || input.submission === null) return ''
	try {
		return JSON.stringify(input.submission)
	} catch {
		return ''
	}
}
