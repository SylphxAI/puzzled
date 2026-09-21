import { describe, expect, test } from 'bun:test'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { buildResultCard, type ResultCardInput, type ResultCardStrings } from './result-card'
import {
	paintResultCard,
	RESULT_CARD_SIZE,
	resultCardBlob,
	resultCardFileName,
	resultCardPalette,
} from './result-card-render'

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

const THEMES: GameColorTheme[] = [
	'emerald',
	'cyan',
	'violet',
	'amber',
	'pink',
	'rose',
	'blue',
	'sky',
	'orange',
	'lime',
	'slate',
]

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

/**
 * Minimal 2D context that records what was painted. No canvas, no DOM - the
 * point is to prove what the renderer *asks* to draw, including that no
 * solution text ever reaches a fillText call.
 */
function recordingContext() {
	const texts: string[] = []
	const fills: string[] = []
	const strokes: string[] = []
	const state = {
		fillStyle: '' as unknown,
		strokeStyle: '' as unknown,
		lineWidth: 0,
		font: '',
		textAlign: 'left' as string,
		textBaseline: 'alphabetic' as string,
	}
	const gradient = () => ({ addColorStop: () => undefined })
	const ctx = {
		get fillStyle() {
			return state.fillStyle
		},
		set fillStyle(value: unknown) {
			state.fillStyle = value
		},
		get strokeStyle() {
			return state.strokeStyle
		},
		set strokeStyle(value: unknown) {
			state.strokeStyle = value
		},
		get font() {
			return state.font
		},
		set font(value: string) {
			state.font = value
		},
		get textAlign() {
			return state.textAlign
		},
		set textAlign(value: string) {
			state.textAlign = value
		},
		get textBaseline() {
			return state.textBaseline
		},
		set textBaseline(value: string) {
			state.textBaseline = value
		},
		lineWidth: 0,
		save: () => undefined,
		restore: () => undefined,
		beginPath: () => undefined,
		closePath: () => undefined,
		moveTo: () => undefined,
		lineTo: () => undefined,
		arcTo: () => undefined,
		fillRect: () => undefined,
		fill: () => {
			fills.push(String(state.fillStyle))
		},
		stroke: () => {
			strokes.push(String(state.strokeStyle))
		},
		fillText: (text: string) => {
			texts.push(String(text))
		},
		measureText: (text: string) => ({ width: text.length * 20 }),
		createRadialGradient: gradient,
		createLinearGradient: gradient,
	}
	return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, fills, strokes }
}

describe('resultCardPalette', () => {
	test('every module theme has a palette whose accent matches the theme pattern', () => {
		// theme-colors.ts embeds the theme's rgba() triple in its Tailwind
		// pattern class; the canvas palette must carry the same colour, or the
		// card and the module would visibly diverge.
		for (const theme of THEMES) {
			const palette = resultCardPalette(theme)
			const pattern = getGameColors(theme).pattern
			const match = pattern.match(/rgba\((\d+),(\d+),(\d+)/)
			expect(match).not.toBeNull()
			if (!match) continue
			const hex =
				'#' +
				[match[1], match[2], match[3]]
					.map((part) => Number(part).toString(16).padStart(2, '0'))
					.join('')
			expect(palette.accent).toBe(hex)
		}
	})

	test('covers exactly the themes the modules declare', () => {
		expect(THEMES.length).toBe(11)
		for (const theme of THEMES) {
			expect(typeof resultCardPalette(theme).bg).toBe('string')
		}
	})
})

describe('paintResultCard', () => {
	test('draws the module, the day, the status, the chips and the deep link', () => {
		const rec = recordingContext()
		paintResultCard(rec.ctx, buildResultCard(baseInput()), STRINGS)
		const painted = rec.texts.join('\n')
		expect(painted).toContain('Five')
		expect(rec.texts).toContain('Sep 21, 2026')
		expect(rec.texts).toContain('Solved!')
		expect(painted).toContain('3 of 6')
		expect(painted).toContain('4')
		expect(painted).toContain('One to five minutes')
		expect(painted).toContain('puzzled.gg/games/word-guess?mode=archive&date=2026-09-21')
	})

	test('never paints solution or answer content, even when it rides the input', () => {
		const contaminated = {
			...baseInput(),
			solution: 'CROWN',
			guesses: ['CROWN', 'BLIMP'],
			answerGrid: [['C', 'R', 'O', 'W', 'N']],
		} as unknown as ResultCardInput
		const rec = recordingContext()
		paintResultCard(rec.ctx, buildResultCard(contaminated), STRINGS)
		const painted = rec.texts.join('\n')
		expect(painted).not.toContain('CROWN')
		expect(painted).not.toContain('BLIMP')
	})

	test('paints pattern tiles in the theme accent, near and miss fills', () => {
		const rec = recordingContext()
		const model = buildResultCard(baseInput({ pattern: [['hit', 'near', 'miss']] }))
		paintResultCard(rec.ctx, model, STRINGS)
		const palette = resultCardPalette('emerald')
		expect(rec.fills).toContain(palette.accent)
		expect(rec.fills).toContain(palette.tileNear)
		expect(rec.fills).toContain(palette.tileMiss)
	})

	test('keeps one common chrome across modules: same text, different palette', () => {
		const a = recordingContext()
		const b = recordingContext()
		paintResultCard(
			a.ctx,
			buildResultCard(baseInput({ theme: 'cyan', pattern: [['hit']] })),
			STRINGS,
		)
		paintResultCard(
			b.ctx,
			buildResultCard(baseInput({ theme: 'violet', pattern: [['hit']] })),
			STRINGS,
		)
		expect(a.texts).toEqual(b.texts)
		expect(a.fills).not.toEqual(b.fills)
	})

	test('renders the lost status through the same chrome', () => {
		const rec = recordingContext()
		paintResultCard(rec.ctx, buildResultCard(baseInput({ status: 'lost', attempts: 6 })), STRINGS)
		expect(rec.texts).toContain('Not this time')
		expect(rec.texts.join('\n')).not.toContain('Solved!')
	})

	test('is deterministic: two paints of one model record identical calls', () => {
		const a = recordingContext()
		const b = recordingContext()
		const model = buildResultCard(baseInput({ pattern: [['hit', 'miss'], ['near']] }))
		paintResultCard(a.ctx, model, STRINGS)
		paintResultCard(b.ctx, model, STRINGS)
		expect(a.texts).toEqual(b.texts)
		expect(a.fills).toEqual(b.fills)
		expect(a.strokes).toEqual(b.strokes)
	})

	test('renders without a day or pattern, when the run has neither', () => {
		const rec = recordingContext()
		const model = buildResultCard(
			baseInput({
				puzzleDate: null,
				attempts: null,
				maxAttempts: null,
				timeSpentMs: null,
				currentStreak: null,
			}),
		)
		paintResultCard(rec.ctx, model, STRINGS)
		const painted = rec.texts.join('\n')
		expect(painted).toContain('Five')
		expect(painted).toContain('puzzled.gg/games/word-guess')
		expect(painted).not.toContain('undefined')
		expect(painted).not.toContain('NaN')
	})
})

describe('resultCardBlob', () => {
	test('returns null without a DOM so callers fall back to the text share', async () => {
		expect(await resultCardBlob(buildResultCard(baseInput()), STRINGS)).toBeNull()
	})

	test('exports the card size the layout is designed for', () => {
		expect(RESULT_CARD_SIZE).toBe(1080)
	})
})

describe('resultCardFileName', () => {
	test('names files per module and day', () => {
		expect(resultCardFileName(buildResultCard(baseInput()))).toBe(
			'puzzled-result-word-guess-2026-09-21.png',
		)
	})

	test('drops the day when the run has none', () => {
		expect(resultCardFileName(buildResultCard(baseInput({ puzzleDate: null })))).toBe(
			'puzzled-result-word-guess.png',
		)
	})

	test('sanitizes unexpected slug characters', () => {
		expect(resultCardFileName(buildResultCard(baseInput({ gameSlug: 'Word Groups!?' })))).toBe(
			'puzzled-result-word-groups-2026-09-21.png',
		)
	})
})
