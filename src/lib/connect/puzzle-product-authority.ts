/**
 * Pure product-authority planner for Puzzled primary play (PuzzleService).
 * Default connect: sole Connect densify — dual REST play success fail-closed.
 */
import {
	type GetDailyInput,
	type GetPuzzleInput,
	type SubmitGuessInput,
	validateGetDailyInput,
	validateGetPuzzleInput,
	validateSubmitGuessInput,
} from './puzzle-domain'

export type PuzzleProductAuthorityMode = 'rest' | 'connect' | 'connect_required'

export function resolvePuzzleProductAuthorityMode(
	_env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): PuzzleProductAuthorityMode {
	// HARD PATH: densified play is sole Connect — REST dual opt-out deleted.
	return 'connect'
}

export function planPuzzleGetDailyProduct(
	input: GetDailyInput,
	env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
):
	| { mode: 'rest'; connect: null }
	| {
			mode: 'connect' | 'connect_required'
			connect: { ok: true; value: GetDailyInput } | { ok: false; error: string }
			failClosed: boolean
	  } {
	const mode = resolvePuzzleProductAuthorityMode(env)
	if (mode === 'rest') return { mode: 'rest', connect: null }
	const value: GetDailyInput = {
		gameSlug: input.gameSlug,
		difficulty: input.difficulty,
		puzzleId: input.puzzleId,
		hasCompleted: input.hasCompleted,
	}
	const err = validateGetDailyInput(value)
	const failClosed = true
	if (err) return { mode, connect: { ok: false, error: err }, failClosed }
	return { mode, connect: { ok: true, value }, failClosed }
}

export function planPuzzleGetPuzzleProduct(
	input: GetPuzzleInput,
	env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
):
	| { mode: 'rest'; connect: null }
	| {
			mode: 'connect' | 'connect_required'
			connect: { ok: true; value: GetPuzzleInput } | { ok: false; error: string }
			failClosed: boolean
	  } {
	const mode = resolvePuzzleProductAuthorityMode(env)
	if (mode === 'rest') return { mode: 'rest', connect: null }
	const err = validateGetPuzzleInput(input)
	const failClosed = true
	if (err) return { mode, connect: { ok: false, error: err }, failClosed }
	return { mode, connect: { ok: true, value: input }, failClosed }
}

export function planPuzzleSubmitGuessProduct(
	input: SubmitGuessInput,
	env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
):
	| { mode: 'rest'; connect: null }
	| {
			mode: 'connect' | 'connect_required'
			connect: { ok: true; value: SubmitGuessInput } | { ok: false; error: string }
			failClosed: boolean
	  } {
	const mode = resolvePuzzleProductAuthorityMode(env)
	if (mode === 'rest') return { mode: 'rest', connect: null }
	const err = validateSubmitGuessInput(input)
	const failClosed = true
	if (err) return { mode, connect: { ok: false, error: err }, failClosed }
	return { mode, connect: { ok: true, value: input }, failClosed }
}

/**
 * Whether dual REST play residual may densify after a Connect admit attempt.
 * Under connect modes: fail-closed — never dual REST product success.
 * REST residual only for explicit rest opt-out / skipped admit.
 */
export function shouldUseRestPlayResidual(
	admit: null | {
		mode: string
		ok?: boolean
		failClosed?: boolean
		skipped?: boolean
	},
): boolean {
	if (!admit) return false
	if (admit.mode === 'rest' || admit.skipped) return true
	// connect / connect_required: sole Connect, never dual REST residual
	return false
}
