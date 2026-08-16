/**
 * Client parser for the solution-safe Match payload served by Connect.
 *
 * Cards and totalSets are playable without listing the winning triples.
 */

import type { Card, PatternMatchClientData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseCard(raw: unknown): Card {
	if (!isRecord(raw)) throw new Error('[pattern-match] invalid card')
	if (typeof raw.id !== 'number' || !Number.isInteger(raw.id)) {
		throw new Error('[pattern-match] card id required')
	}
	if (raw.shape !== 'diamond' && raw.shape !== 'oval' && raw.shape !== 'squiggle') {
		throw new Error('[pattern-match] invalid shape')
	}
	if (raw.color !== 'red' && raw.color !== 'green' && raw.color !== 'purple') {
		throw new Error('[pattern-match] invalid color')
	}
	if (raw.fill !== 'solid' && raw.fill !== 'striped' && raw.fill !== 'empty') {
		throw new Error('[pattern-match] invalid fill')
	}
	if (raw.count !== 1 && raw.count !== 2 && raw.count !== 3) {
		throw new Error('[pattern-match] invalid count')
	}
	return {
		id: raw.id,
		shape: raw.shape,
		color: raw.color,
		fill: raw.fill,
		count: raw.count,
	}
}

export function parsePatternMatchClientPayload(data: unknown): PatternMatchClientData {
	if (!isRecord(data)) throw new Error('[pattern-match] invalid puzzle payload')
	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data || 'validSets' in data) {
		throw new Error('[pattern-match] solution-bearing puzzle payload is not client-safe')
	}
	if (!Array.isArray(data.cards) || data.cards.length === 0) {
		throw new Error('[pattern-match] cards required')
	}
	if (
		typeof data.totalSets !== 'number' ||
		!Number.isInteger(data.totalSets) ||
		data.totalSets < 1
	) {
		throw new Error('[pattern-match] totalSets must be a positive integer')
	}
	return {
		cards: data.cards.map(parseCard),
		totalSets: data.totalSets,
	}
}
