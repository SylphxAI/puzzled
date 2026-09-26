/**
 * Client parser for GetDaily word-box payloads.
 *
 * The server serves `{ box }` with the example solution stripped. The legacy
 * wrapped `{ puzzleData, solution }` shape is accepted and its solution
 * dropped: the browser judges the finish by the rules (dictionary words,
 * chained, using all twelve letters) and the server validates the words.
 */

import type { LetterBox, LetterBoxedPuzzleData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const

function side(value: unknown): [string, string, string] {
	if (!Array.isArray(value) || value.length !== 3) {
		throw new Error('[word-box] each side has three letters')
	}
	const letters = value.map((letter) =>
		typeof letter === 'string' && /^[a-z]$/i.test(letter) ? letter.toUpperCase() : '',
	)
	if (letters.some((letter) => !letter)) throw new Error('[word-box] each side has three letters')
	return [letters[0] as string, letters[1] as string, letters[2] as string]
}

export function parseWordBoxClientPayload(data: unknown): LetterBoxedPuzzleData {
	if (!isRecord(data)) throw new Error('[word-box] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	if (!isRecord(inner.box)) throw new Error('[word-box] box is required')
	const raw = inner.box
	const box = Object.fromEntries(SIDES.map((name) => [name, side(raw[name])])) as LetterBox
	return { box }
}
