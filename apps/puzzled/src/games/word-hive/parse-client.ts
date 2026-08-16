/**
 * Client parser for the solution-safe Hive payload served by Connect.
 *
 * GetDaily sends letters + score/word counts. Valid words stay in Rust.
 */

import type { SpellingBeePuzzleClientData } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseLetters(raw: unknown, label: string): string[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		throw new Error(`[word-hive] ${label} required`)
	}
	return raw.map((letter) => {
		if (typeof letter !== 'string' || letter.length !== 1) {
			throw new Error(`[word-hive] ${label} must be single letters`)
		}
		return letter.toUpperCase()
	})
}

function parseCount(raw: unknown, label: string): number {
	if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
		throw new Error(`[word-hive] ${label} must be a positive integer`)
	}
	return raw
}

export function parseWordHiveClientPayload(data: unknown): SpellingBeePuzzleClientData {
	if (!isRecord(data)) throw new Error('[word-hive] invalid puzzle payload')
	if (
		'puzzleData' in data ||
		'solution' in data ||
		'solutionJson' in data ||
		'validWords' in data ||
		'pangrams' in data
	) {
		throw new Error('[word-hive] solution-bearing puzzle payload is not client-safe')
	}
	if (typeof data.centerLetter !== 'string' || data.centerLetter.length !== 1) {
		throw new Error('[word-hive] centerLetter required')
	}
	return {
		centerLetter: data.centerLetter.toUpperCase(),
		outerLetters: parseLetters(data.outerLetters, 'outerLetters'),
		maxScore: parseCount(data.maxScore, 'maxScore'),
		wordCount: parseCount(data.wordCount, 'wordCount'),
		pangramCount: parseCount(data.pangramCount, 'pangramCount'),
	}
}
