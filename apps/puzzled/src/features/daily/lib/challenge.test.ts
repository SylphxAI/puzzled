import { describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import { GetSharedResultResponseSchema } from '@/gen/connect/puzzled/v1/puzzle_pb'
import { attributionCookieValue } from '@/lib/attribution'
import { CHALLENGE_KEY } from '@/lib/storage-keys'
import {
	landingPlayTarget,
	parseShareId,
	recallChallenge,
	rememberChallenge,
	type SharedResult,
	sharedResultCard,
	toSharedResult,
} from './challenge'
import { resultCardChips, resultCardStringsFrom, resultCardTextAlternative } from './result-card'
import { shareLandingPath } from './share-text'

const ID = '0b6f5d6e-2c8a-4a53-9f0e-6a4d3f1c9e11'

const strings = resultCardStringsFrom((key) => `{${key}}`)

function memoryStore(initial: Record<string, string> = {}) {
	const data = { ...initial }
	return {
		data,
		getItem: (key: string) => data[key] ?? null,
		setItem: (key: string, value: string) => {
			data[key] = value
		},
	}
}

describe('parseShareId', () => {
	test('accepts the api-issued uuid only', () => {
		expect(parseShareId(ID)).toBe(ID)
		expect(parseShareId(` ${ID.toUpperCase()} `)).toBe(ID)
		expect(parseShareId('res_42')).toBeNull()
		expect(parseShareId(`${ID}x`)).toBeNull()
		expect(parseShareId('')).toBeNull()
		expect(parseShareId(undefined)).toBeNull()
	})
})

describe('a shared result is non-spoiler by construction', () => {
	const wire = create(GetSharedResultResponseSchema, {
		gameSlug: 'word-guess',
		puzzleDate: '2026-09-28',
		difficulty: '',
		status: 'won',
		attempts: 3,
		timeSpentMs: BigInt(75_000),
	})

	test('the wire type carries only card facts: no solution, grid, or sharer identity', () => {
		expect(GetSharedResultResponseSchema.fields.map((field) => field.name).sort()).toEqual([
			'attempts',
			'difficulty',
			'game_slug',
			'puzzle_date',
			'score',
			'status',
			'time_spent_ms',
		])
	})

	test('maps to the card facts; 0 attempts means the module does not count them', () => {
		expect(toSharedResult(wire)).toEqual({
			gameSlug: 'word-guess',
			dayKey: '2026-09-28',
			status: 'won',
			attempts: 3,
			score: null,
			timeSpentMs: 75_000,
			difficulty: null,
		})
		expect(toSharedResult(create(GetSharedResultResponseSchema, { status: 'lost' })).attempts).toBe(
			null,
		)
	})

	test('the landing card shows a time band, not the exact time, and links to the play page', () => {
		const card = sharedResultCard(toSharedResult(wire), {
			origin: 'https://puzzled.gg',
			gameName: 'Word Guess',
			theme: 'slate',
			locale: 'en-US',
		})
		expect(card.timeBand).toBe('under5m')
		const chips = resultCardChips(card, strings).map((chip) => chip.value)
		expect(chips).toEqual(['3', '{timeUnder5m}'])
		expect(JSON.stringify(card)).not.toContain('75000')
		expect(resultCardTextAlternative(card, strings)).not.toContain('75')
	})
})

describe('ref attribution', () => {
	test('a share link lands with its share id as the first-touch ref', () => {
		const path = shareLandingPath(ID)
		const [pathname, search] = path.split('?')
		const cookie = attributionCookieValue(`?${search}`, pathname ?? '/', 1790000000000)
		const decoded = new URLSearchParams(decodeURIComponent(cookie ?? ''))
		// `r` is what the api stores as account_attribution.ref and reads as the share id.
		expect(decoded.get('r')).toBe(ID)
		expect(decoded.get('p')).toBe('/daily')
		expect(decoded.get('at')).toBe('1790000000000')
	})
})

describe('challenge memory', () => {
	test('is recalled only for the same module and day', () => {
		const store = memoryStore()
		rememberChallenge(store, { shareId: ID, gameSlug: 'word-guess', dayKey: '2026-09-28' })
		expect(recallChallenge(store, 'word-guess', '2026-09-28')).toBe(ID)
		expect(recallChallenge(store, 'sudoku', '2026-09-28')).toBeNull()
		expect(recallChallenge(store, 'word-guess', '2026-09-29')).toBeNull()
	})

	test('a tampered or blocked store yields nothing instead of throwing', () => {
		expect(recallChallenge(memoryStore({ [CHALLENGE_KEY]: '{oops' }), 'word-guess', 'd')).toBeNull()
		expect(
			recallChallenge(
				memoryStore({
					[CHALLENGE_KEY]: JSON.stringify({ shareId: 'x', gameSlug: 'word-guess', dayKey: 'd' }),
				}),
				'word-guess',
				'd',
			),
		).toBeNull()
		const blocked = {
			getItem: () => {
				throw new Error('blocked')
			},
			setItem: () => {
				throw new Error('blocked')
			},
		}
		expect(recallChallenge(blocked, 'word-guess', 'd')).toBeNull()
		expect(() =>
			rememberChallenge(blocked, { shareId: ID, gameSlug: 'word-guess', dayKey: 'd' }),
		).not.toThrow()
		expect(recallChallenge(null, 'word-guess', 'd')).toBeNull()
	})
})

describe('landingPlayTarget', () => {
	const today = { dayKey: '2026-09-28', freeGameSlug: 'word-guess' }
	const shared = (over: Partial<SharedResult>) => ({
		gameSlug: 'word-guess',
		dayKey: '2026-09-28',
		...over,
	})

	test("promises a comparison only for today's free puzzle", () => {
		expect(landingPlayTarget(shared({}), today)).toEqual({
			gameSlug: 'word-guess',
			sameAsShared: true,
		})
		expect(landingPlayTarget(shared({ dayKey: '2026-09-27' }), today).sameAsShared).toBe(false)
		expect(landingPlayTarget(shared({ gameSlug: 'sudoku' }), today)).toEqual({
			gameSlug: 'word-guess',
			sameAsShared: false,
		})
	})
})
