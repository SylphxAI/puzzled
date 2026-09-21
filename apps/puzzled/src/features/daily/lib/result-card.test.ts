import { describe, expect, test } from 'bun:test'
import {
	buildResultCard,
	formatCardDayKey,
	RESULT_CARD_PATTERN_MAX_COLS,
	RESULT_CARD_PATTERN_MAX_ROWS,
	type ResultCardInput,
	type ResultCardStrings,
	type ResultCardTile,
	resultCardChips,
	resultCardTextAlternative,
	resultCardTimeBand,
} from './result-card'

const STRINGS: ResultCardStrings = {
	statusWon: 'Solved!',
	statusLost: 'Not this time',
	attemptsLabel: 'Attempts',
	scoreLabel: 'Score',
	streakLabel: 'Streak',
	timeLabel: 'Time',
	mistakesLabel: 'Mistakes',
	timeUnder1m: 'Under a minute',
	timeUnder5m: 'One to five minutes',
	timeOver5m: 'Over five minutes',
	attemptsOf: '{attempts} of {max}',
	attemptsCount: '{attempts} attempts',
	scorePoints: '{score} points',
	streakDays: '{days}-day streak',
	patternSummary: 'Pattern: {hit} hit / {near} near / {miss} miss',
	altOnDay: ' on {day}',
	altTemplate: 'Puzzled result - {game}{day}. {result}',
	altDetailsTemplate: ' {details}.',
	altLinkTemplate: ' Play: {link}',
	detailSeparator: ', ',
}

function baseInput(overrides: Partial<ResultCardInput> = {}): ResultCardInput {
	return {
		origin: 'https://puzzled.gg',
		gameSlug: 'word-guess',
		gameName: 'Five',
		theme: 'emerald',
		mode: 'daily',
		status: 'won',
		locale: 'en-US',
		puzzleDate: '2026-09-21',
		attempts: 3,
		maxAttempts: 6,
		timeSpentMs: 74_000,
		currentStreak: 4,
		...overrides,
	}
}

describe('buildResultCard', () => {
	test('labels the day, the module and a dated deep link', () => {
		const model = buildResultCard(baseInput())
		expect(model.dayKey).toBe('2026-09-21')
		expect(model.dayDisplay).toBe('Sep 21, 2026')
		expect(model.gameName).toBe('Five')
		expect(model.theme).toBe('emerald')
		expect(model.deepLink).toBe('puzzled.gg/games/word-guess?mode=archive&date=2026-09-21')
		expect(model.timeBand).toBe('under5m')
		expect(model.currentStreak).toBe(4)
	})

	test('falls back to no day when the key is invalid, and never fakes one', () => {
		const model = buildResultCard(baseInput({ puzzleDate: '2026-02-30' }))
		expect(model.dayKey).toBeNull()
		expect(model.dayDisplay).toBeNull()
		expect(model.deepLink).toBe('puzzled.gg/games/word-guess')
	})

	test('never carries the solution or an answer grid, even when passed in', () => {
		// The result surfaces keep the solution in a sibling prop; this input
		// simulates a caller accidentally spreading it into the card input.
		const contaminated = {
			...baseInput(),
			solution: 'CROWN',
			answerGrid: [['C', 'R', 'O', 'W', 'N']],
			guesses: ['CROWN', 'BLIMP'],
		} as unknown as ResultCardInput
		const model = buildResultCard(contaminated)
		const serialized = JSON.stringify(model)
		expect(serialized).not.toContain('CROWN')
		expect(serialized).not.toContain('BLIMP')
		expect(serialized).not.toContain('C,R,O,W,N')
		// The allowlist itself: nothing outside these keys may ever serialise.
		expect(Object.keys(model).sort()).toEqual([
			'attempts',
			'currentStreak',
			'dayDisplay',
			'dayKey',
			'deepLink',
			'gameName',
			'gameSlug',
			'hintsUsed',
			'maxAttempts',
			'mistakes',
			'mode',
			'pattern',
			'score',
			'status',
			'theme',
			'timeBand',
		])
	})

	test('coerces unknown tile values to miss, so no text can ride a pattern', () => {
		const model = buildResultCard(
			baseInput({
				pattern: [
					['hit', 'near'],
					['CROWN', 'miss'],
				] as unknown as ResultCardTile[][],
			}),
		)
		expect(model.pattern).toEqual([
			['hit', 'near'],
			['miss', 'miss'],
		])
	})

	test('caps the pattern so a card can never become an answer-grid dump', () => {
		const big = Array.from({ length: 20 }, () =>
			Array.from({ length: 20 }, () => 'hit' as ResultCardTile),
		)
		const model = buildResultCard(baseInput({ pattern: big }))
		expect(model.pattern?.length).toBe(RESULT_CARD_PATTERN_MAX_ROWS)
		expect(model.pattern?.[0]?.length).toBe(RESULT_CARD_PATTERN_MAX_COLS)
	})

	test('drops empty rows and a zero streak', () => {
		const model = buildResultCard(baseInput({ pattern: [[], ['hit']], currentStreak: 0 }))
		expect(model.pattern).toEqual([['hit']])
		expect(model.currentStreak).toBeNull()
	})
})

describe('resultCardTimeBand', () => {
	test('buckets durations; exact durations never leave the device', () => {
		expect(resultCardTimeBand(59_999)).toBe('under1m')
		expect(resultCardTimeBand(60_000)).toBe('under5m')
		expect(resultCardTimeBand(299_999)).toBe('under5m')
		expect(resultCardTimeBand(300_000)).toBe('over5m')
		expect(resultCardTimeBand(0)).toBeNull()
		expect(resultCardTimeBand(null)).toBeNull()
		expect(resultCardTimeBand(Number.NaN)).toBeNull()
	})
})

describe('formatCardDayKey', () => {
	test('formats the product day zone-stably', () => {
		expect(formatCardDayKey('2026-09-21', 'en-US')).toBe('Sep 21, 2026')
		expect(formatCardDayKey('2026-09-21', 'zh-HK')).toContain('2026')
	})
})

describe('resultCardChips', () => {
	test('orders chips attempts, score, streak, time band; the fifth fact is dropped', () => {
		const model = buildResultCard(baseInput({ score: 1240, mistakes: 2, hintsUsed: 1 }))
		expect(resultCardChips(model, STRINGS)).toEqual([
			{ label: 'Attempts', value: '3 of 6' },
			{ label: 'Score', value: '1240' },
			{ label: 'Streak', value: '4' },
			{ label: 'Time', value: 'One to five minutes' },
		])
	})

	test('shows mistakes when no time band competes for the last slot', () => {
		const model = buildResultCard(baseInput({ score: 1240, mistakes: 2, timeSpentMs: null }))
		expect(resultCardChips(model, STRINGS)).toEqual([
			{ label: 'Attempts', value: '3 of 6' },
			{ label: 'Score', value: '1240' },
			{ label: 'Streak', value: '4' },
			{ label: 'Mistakes', value: '2' },
		])
	})

	test('omits chips with no data', () => {
		const model = buildResultCard(
			baseInput({
				attempts: null,
				maxAttempts: null,
				score: null,
				mistakes: null,
				currentStreak: null,
				timeSpentMs: null,
			}),
		)
		expect(resultCardChips(model, STRINGS)).toEqual([])
	})
})

describe('resultCardTextAlternative', () => {
	test('is a complete localized sentence with no leftover tokens', () => {
		const model = buildResultCard(baseInput())
		const alt = resultCardTextAlternative(model, STRINGS)
		expect(alt).not.toMatch(/[{}]/)
		expect(alt).toContain('Five')
		expect(alt).toContain('Sep 21, 2026')
		expect(alt).toContain('Solved!')
		expect(alt).toContain('3 of 6')
		expect(alt).toContain('4-day streak')
		expect(alt).toContain('One to five minutes')
		expect(alt).toContain('puzzled.gg/games/word-guess?mode=archive&date=2026-09-21')
		expect(alt.toLowerCase()).not.toContain('solution')
	})

	test('stays clean when the run has almost no data', () => {
		const model = buildResultCard(
			baseInput({
				puzzleDate: null,
				attempts: null,
				maxAttempts: null,
				score: null,
				timeSpentMs: null,
				currentStreak: null,
			}),
		)
		const alt = resultCardTextAlternative(model, STRINGS)
		expect(alt).toBe('Puzzled result - Five. Solved! Play: puzzled.gg/games/word-guess')
		expect(alt).not.toContain('  ')
	})

	test('describes the pattern in counts, never in content', () => {
		const model = buildResultCard(baseInput({ pattern: [['hit', 'near', 'miss']] }))
		const alt = resultCardTextAlternative(model, STRINGS)
		expect(alt).toContain('Pattern: 1 hit / 1 near / 1 miss')
	})
})
