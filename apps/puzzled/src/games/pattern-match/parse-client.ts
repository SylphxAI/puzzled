/**
 * Client parser for GetDaily pattern-match payloads.
 *
 * The server serves `{ cards, totalSets }` with the solution (`validSets`)
 * stripped. The legacy wrapped `{ puzzleData, solution }` shape is accepted and
 * its solution dropped: each chosen trio is judged by the rules
 * (`isValidSet`), and the server still validates the submission.
 */

import type { Card, Color, Count, Fill, PatternMatchClientData, Shape } from './types'

const SHAPES: readonly Shape[] = ['diamond', 'oval', 'squiggle']
const COLORS: readonly Color[] = ['red', 'green', 'purple']
const FILLS: readonly Fill[] = ['solid', 'striped', 'empty']
const COUNTS: readonly Count[] = [1, 2, 3]

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function pick<T>(allowed: readonly T[], value: unknown, what: string): T {
	const found = allowed.find((option) => option === value)
	if (found === undefined) throw new Error(`[pattern-match] invalid card ${what}`)
	return found
}

function parseCard(value: unknown): Card {
	if (!isRecord(value) || typeof value.id !== 'number') {
		throw new Error('[pattern-match] invalid card')
	}
	return {
		id: value.id,
		shape: pick(SHAPES, value.shape, 'shape'),
		color: pick(COLORS, value.color, 'color'),
		fill: pick(FILLS, value.fill, 'fill'),
		count: pick(COUNTS, value.count, 'count'),
	}
}

export function parsePatternMatchClientPayload(data: unknown): PatternMatchClientData {
	if (!isRecord(data)) throw new Error('[pattern-match] invalid puzzle payload')
	const inner = isRecord(data.puzzleData) ? data.puzzleData : data
	if (!Array.isArray(inner.cards) || inner.cards.length === 0) {
		throw new Error('[pattern-match] cards are required')
	}
	const cards = inner.cards.map(parseCard)
	const totalSets = inner.totalSets
	if (typeof totalSets !== 'number' || !Number.isInteger(totalSets) || totalSets < 1) {
		throw new Error('[pattern-match] totalSets must be a positive integer')
	}
	return { cards, totalSets }
}
