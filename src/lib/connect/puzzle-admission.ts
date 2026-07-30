/**
 * Product-authority admission shell for primary Puzzle play RPCs.
 * Hard path: when connect_* mode, call Connect client.
 * Dual REST residual is call-site gated: only when not failClosed.
 */
import { getDaily, getPuzzle, submitGuess } from './puzzle-client'
import type { GetDailyInput, GetPuzzleInput, SubmitGuessInput } from './puzzle-domain'
import {
	planPuzzleGetDailyProduct,
	planPuzzleGetPuzzleProduct,
	planPuzzleSubmitGuessProduct,
} from './puzzle-product-authority'

export { shouldUseRestPlayResidual } from './puzzle-product-authority'

export async function admitGetDailyViaConnect(input: GetDailyInput): Promise<
	| { mode: 'rest'; skipped: true; failClosed: false }
	| {
			mode: 'connect' | 'connect_required'
			ok: true
			response: Awaited<ReturnType<typeof getDaily>>
			failClosed: boolean
	  }
	| {
			mode: 'connect' | 'connect_required'
			ok: false
			error: string
			failClosed: boolean
	  }
> {
	const plan = planPuzzleGetDailyProduct(input)
	if (plan.mode === 'rest' || !plan.connect) {
		return { mode: 'rest', skipped: true, failClosed: false }
	}
	if (!plan.connect.ok) {
		return {
			mode: plan.mode,
			ok: false,
			error: plan.connect.error,
			failClosed: plan.failClosed,
		}
	}
	try {
		const response = await getDaily(plan.connect.value)
		return {
			mode: plan.mode,
			ok: true,
			response,
			failClosed: plan.failClosed,
		}
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e)
		return {
			mode: plan.mode,
			ok: false,
			error,
			failClosed: plan.failClosed,
		}
	}
}

export async function admitGetPuzzleViaConnect(input: GetPuzzleInput): Promise<
	| { mode: 'rest'; skipped: true; failClosed: false }
	| {
			mode: 'connect' | 'connect_required'
			ok: true
			response: Awaited<ReturnType<typeof getPuzzle>>
			failClosed: boolean
	  }
	| {
			mode: 'connect' | 'connect_required'
			ok: false
			error: string
			failClosed: boolean
	  }
> {
	const plan = planPuzzleGetPuzzleProduct(input)
	if (plan.mode === 'rest' || !plan.connect) {
		return { mode: 'rest', skipped: true, failClosed: false }
	}
	if (!plan.connect.ok) {
		return {
			mode: plan.mode,
			ok: false,
			error: plan.connect.error,
			failClosed: plan.failClosed,
		}
	}
	try {
		const response = await getPuzzle(plan.connect.value)
		return {
			mode: plan.mode,
			ok: true,
			response,
			failClosed: plan.failClosed,
		}
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e)
		return {
			mode: plan.mode,
			ok: false,
			error,
			failClosed: plan.failClosed,
		}
	}
}

export async function admitSubmitGuessViaConnect(input: SubmitGuessInput): Promise<
	| { mode: 'rest'; skipped: true; failClosed: false }
	| {
			mode: 'connect' | 'connect_required'
			ok: true
			response: Awaited<ReturnType<typeof submitGuess>>
			failClosed: boolean
	  }
	| {
			mode: 'connect' | 'connect_required'
			ok: false
			error: string
			failClosed: boolean
	  }
> {
	const plan = planPuzzleSubmitGuessProduct(input)
	if (plan.mode === 'rest' || !plan.connect) {
		return { mode: 'rest', skipped: true, failClosed: false }
	}
	if (!plan.connect.ok) {
		return {
			mode: plan.mode,
			ok: false,
			error: plan.connect.error,
			failClosed: plan.failClosed,
		}
	}
	try {
		const response = await submitGuess(plan.connect.value)
		return {
			mode: plan.mode,
			ok: true,
			response,
			failClosed: plan.failClosed,
		}
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e)
		return {
			mode: plan.mode,
			ok: false,
			error,
			failClosed: plan.failClosed,
		}
	}
}
