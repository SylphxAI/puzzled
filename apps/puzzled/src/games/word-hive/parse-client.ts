/**
 * Client parser for the Hive payload served by Connect.
 *
 * Valid words are part of the playable hive (needed to accept a word).
 * Wrapped {puzzleData, solution} payloads are rejected.
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

export function parseWordHiveClientPayload(data: unknown): SpellingBeePuzzleClientData {
	if (!isRecord(data)) throw new Error('[word-hive] invalid puzzle payload')
	if ('puzzleData' in data || 'solution' in data || 'solutionJson' in data) {
		throw new Error('[word-hive] solution-bearing puzzle payload is not client-safe')
	}
	if (typeof data.centerLetter !== 'string' || data.centerLetter.length !== 1) {
		throw new Error('[word-hive] centerLetter required')
	}
	if (typeof data.maxScore !== 'number' || !Number.isInteger(data.maxScore) || data.maxScore < 1) {
		throw new Error('[word-hive] maxScore must be a positive integer')
	}
	return {
		centerLetter: data.centerLetter.toUpperCase(),
		outerLetters: parseLetters(data.outerLetters, 'outerLetters'),
		maxScore: data.maxScore,
		validWords: parseLettersList(data.validWords, 'validWords'),
		pangrams: parseLettersList(data.pangrams, 'pangrams'),
	}
}

function parseLettersList(raw: unknown, label: string): string[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		throw new Error(`[word-hive] ${label} required`)
	}
	return raw.map((word) => {
		if (typeof word !== 'string' || word.length === 0) {
			throw new Error(`[word-hive] ${label} must be words`)
		}
		return word.toUpperCase()
	})
}
