/**
 * Client parser for the solution-safe Arithmo payload served by Connect.
 */

import { type ArithmoPuzzleClientData, EQUATION_LENGTH } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseArithmoClientPayload(data: unknown): ArithmoPuzzleClientData {
	if (!isRecord(data)) throw new Error('[arithmo] invalid puzzle payload')
	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data || 'equation' in data) {
		throw new Error('[arithmo] solution-bearing puzzle payload is not client-safe')
	}
	if (data.length !== EQUATION_LENGTH) {
		throw new Error(`[arithmo] length must be ${EQUATION_LENGTH}`)
	}
	return { length: EQUATION_LENGTH }
}
