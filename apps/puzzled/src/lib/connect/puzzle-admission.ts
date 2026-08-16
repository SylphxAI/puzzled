/**
 * Product-authority admission shell for PuzzleService generated Connect path.
 * HARD PATH: sole Connect — no REST dual residual skip path.
 */
import { getDaily, getPuzzle, submitGuess } from './puzzle-client'
import type { GetDailyInput, GetPuzzleInput, SubmitGuessInput } from './puzzle-domain'
import {
	planPuzzleGetDailyProduct,
	planPuzzleGetPuzzleProduct,
	planPuzzleSubmitGuessProduct,
} from './puzzle-product-authority'

export type PuzzleAdmitOk<T> = {
	mode: 'connect'
	ok: true
	response: T
	failClosed: true
}

export type PuzzleAdmitFail = {
	mode: 'connect'
	ok: false
	error: string
	failClosed: true
}

export async function admitGetDailyViaConnect(
	input: GetDailyInput,
): Promise<PuzzleAdmitOk<Awaited<ReturnType<typeof getDaily>>> | PuzzleAdmitFail> {
	const plan = planPuzzleGetDailyProduct(input)
	if (!plan.connect.ok) {
		return {
			mode: plan.mode,
			ok: false,
			error: plan.connect.error,
			failClosed: true,
		}
	}
	try {
		const response = await getDaily(plan.connect.value)
		return { mode: plan.mode, ok: true, response, failClosed: true }
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e)
		return { mode: plan.mode, ok: false, error, failClosed: true }
	}
}

export async function admitGetPuzzleViaConnect(
	input: GetPuzzleInput,
): Promise<PuzzleAdmitOk<Awaited<ReturnType<typeof getPuzzle>>> | PuzzleAdmitFail> {
	const plan = planPuzzleGetPuzzleProduct(input)
	if (!plan.connect.ok) {
		return {
			mode: plan.mode,
			ok: false,
			error: plan.connect.error,
			failClosed: true,
		}
	}
	try {
		const response = await getPuzzle(plan.connect.value)
		return { mode: plan.mode, ok: true, response, failClosed: true }
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e)
		return { mode: plan.mode, ok: false, error, failClosed: true }
	}
}

export async function admitSubmitGuessViaConnect(
	input: SubmitGuessInput,
): Promise<PuzzleAdmitOk<Awaited<ReturnType<typeof submitGuess>>> | PuzzleAdmitFail> {
	const plan = planPuzzleSubmitGuessProduct(input)
	if (!plan.connect.ok) {
		return {
			mode: plan.mode,
			ok: false,
			error: plan.connect.error,
			failClosed: true,
		}
	}
	try {
		const response = await submitGuess(plan.connect.value)
		return { mode: plan.mode, ok: true, response, failClosed: true }
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e)
		return { mode: plan.mode, ok: false, error, failClosed: true }
	}
}
