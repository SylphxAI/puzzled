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

/**
 * Resolve Connect SubmitGuess seed from product save input.
 * Prefer explicit seed, then numeric puzzleId, else stable hash of puzzleId.
 */
export function resolveSubmitGuessSeed(input: {
	seed?: number
	puzzleId?: string
	puzzleNumber?: number
}): number | null {
	if (typeof input.seed === 'number' && Number.isFinite(input.seed)) {
		return Math.trunc(input.seed)
	}
	if (typeof input.puzzleNumber === 'number' && Number.isFinite(input.puzzleNumber)) {
		return Math.trunc(input.puzzleNumber)
	}
	const id = (input.puzzleId ?? '').trim()
	if (!id) return null
	if (/^-?\d+$/.test(id)) {
		const n = Number(id)
		if (Number.isFinite(n)) return Math.trunc(n)
	}
	// FNV-1a 32-bit — deterministic densify envelope when puzzleId is opaque (uuid).
	let h = 0x811c9dc5
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i)
		h = Math.imul(h, 0x01000193)
	}
	const n = h | 0
	return n === 0 ? 1 : Math.abs(n)
}
