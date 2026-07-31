/**
 * Pure product-authority planner for Puzzled primary play (PuzzleService).
 * HARD PATH: densified play is sole Connect — REST dual success path deleted.
 */
import {
	type GetDailyInput,
	type GetPuzzleInput,
	type SubmitGuessInput,
	validateGetDailyInput,
	validateGetPuzzleInput,
	validateSubmitGuessInput,
} from './puzzle-domain'

/** Sole densified product authority for play surfaces. */
export type PuzzleProductAuthorityMode = 'connect'

export function resolvePuzzleProductAuthorityMode(
	_env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): PuzzleProductAuthorityMode {
	// HARD PATH: always connect. REST dual residual opt-out deleted.
	return 'connect'
}

export type PuzzleConnectPlan<T> = {
	mode: 'connect'
	connect: { ok: true; value: T } | { ok: false; error: string }
	failClosed: true
}

export function planPuzzleGetDailyProduct(
	input: GetDailyInput,
	env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): PuzzleConnectPlan<GetDailyInput> {
	const mode = resolvePuzzleProductAuthorityMode(env)
	const value: GetDailyInput = {
		gameSlug: input.gameSlug,
		difficulty: input.difficulty,
		puzzleId: input.puzzleId,
		hasCompleted: input.hasCompleted,
	}
	const err = validateGetDailyInput(value)
	if (err) return { mode, connect: { ok: false, error: err }, failClosed: true }
	return { mode, connect: { ok: true, value }, failClosed: true }
}

export function planPuzzleGetPuzzleProduct(
	input: GetPuzzleInput,
	env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): PuzzleConnectPlan<GetPuzzleInput> {
	const mode = resolvePuzzleProductAuthorityMode(env)
	const err = validateGetPuzzleInput(input)
	if (err) return { mode, connect: { ok: false, error: err }, failClosed: true }
	return { mode, connect: { ok: true, value: input }, failClosed: true }
}

export function planPuzzleSubmitGuessProduct(
	input: SubmitGuessInput,
	env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): PuzzleConnectPlan<SubmitGuessInput> {
	const mode = resolvePuzzleProductAuthorityMode(env)
	const err = validateSubmitGuessInput(input)
	if (err) return { mode, connect: { ok: false, error: err }, failClosed: true }
	return { mode, connect: { ok: true, value: input }, failClosed: true }
}

/**
 * Dual REST play residual permanently deleted under sole Connect.
 * Always false — kept as a named fail-closed fence for call sites.
 */
export function shouldUseRestPlayResidual(
	_admit: null | {
		mode: string
		ok?: boolean
		failClosed?: boolean
		skipped?: boolean
	},
): boolean {
	return false
}
