/**
 * Client parser for the solution-safe Letter Boxed payload served by Connect.
 */

import type { LetterBox, LetterBoxedPuzzleData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseSide(raw: unknown, label: string): [string, string, string] {
	if (!Array.isArray(raw) || raw.length !== 3) {
		throw new Error(`[word-box] ${label} must have 3 letters`)
	}
	const letters = raw.map((letter) => {
		if (typeof letter !== 'string' || letter.length !== 1) {
			throw new Error(`[word-box] ${label} must be letters`)
		}
		return letter.toUpperCase()
	})
	return [letters[0], letters[1], letters[2]]
}

export function parseWordBoxClientPayload(data: unknown): LetterBoxedPuzzleData {
	if (!isRecord(data)) throw new Error('[word-box] invalid puzzle payload')
	if (
		'puzzleData' in data ||
		'solution' in data ||
		'solutionJson' in data ||
		'allLetters' in data
	) {
		throw new Error('[word-box] solution-bearing puzzle payload is not client-safe')
	}
	if (!isRecord(data.box)) throw new Error('[word-box] box required')
	const box: LetterBox = {
		top: parseSide(data.box.top, 'top'),
		right: parseSide(data.box.right, 'right'),
		bottom: parseSide(data.box.bottom, 'bottom'),
		left: parseSide(data.box.left, 'left'),
	}
	return { box }
}
