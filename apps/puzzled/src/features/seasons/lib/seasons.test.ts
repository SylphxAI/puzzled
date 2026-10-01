import { describe, expect, test } from 'bun:test'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'
import { buildResultCard, resultCardTextAlternative } from '../../daily/lib/result-card'
import { formatRitualShareText, shareTextLooksNonSpoiler } from '../../daily/lib/share-text'
import { SEASONS, seasonForDayKey, seasonForInstant, seasonGreeting } from './seasons'

const id = (key: string) => seasonForDayKey(key)?.id ?? null

describe('seasonForDayKey', () => {
	test('single days and range edges are inclusive', () => {
		expect(id('2026-02-16')).toBeNull()
		expect(id('2026-02-17')).toBe('lunarNewYear')
		expect(id('2026-02-19')).toBe('lunarNewYear')
		expect(id('2026-02-20')).toBeNull()
		expect(id('2027-02-06')).toBe('lunarNewYear')
		expect(id('2027-02-08')).toBe('lunarNewYear')
		expect(id('2026-04-03')).toBe('easter')
		expect(id('2026-04-06')).toBe('easter')
		expect(id('2027-03-28')).toBe('easter')
		expect(id('2026-06-19')).toBe('dragonBoat')
		expect(id('2027-06-09')).toBe('dragonBoat')
		expect(id('2026-09-25')).toBe('midAutumn')
		expect(id('2027-09-15')).toBe('midAutumn')
		expect(id('2026-10-30')).toBeNull()
		expect(id('2026-10-31')).toBe('halloween')
		expect(id('2026-11-01')).toBeNull()
		expect(id('2026-12-23')).toBeNull()
		expect(id('2026-12-24')).toBe('christmas')
		expect(id('2026-12-26')).toBe('christmas')
		expect(id('2026-12-27')).toBeNull()
	})

	test('the year boundary is one New Year season', () => {
		expect(id('2026-12-30')).toBeNull()
		expect(id('2026-12-31')).toBe('newYear')
		expect(id('2027-01-01')).toBe('newYear')
		expect(id('2027-01-02')).toBeNull()
		expect(id('2027-12-31')).toBe('newYear')
		expect(id('2028-01-01')).toBe('newYear')
	})

	test('an ordinary day, empty or malformed input has no season', () => {
		expect(id('2026-09-21')).toBeNull()
		expect(seasonForDayKey(null)).toBeNull()
		expect(seasonForDayKey(undefined)).toBeNull()
		expect(seasonForDayKey('')).toBeNull()
	})
})

describe('seasonForInstant uses the Hong Kong product day', () => {
	test('16:00 UTC is already the next day in Hong Kong', () => {
		// 2026-12-23 16:00Z = 2026-12-24 00:00 HKT
		expect(seasonForInstant(new Date('2026-12-23T15:59:59Z'))).toBeNull()
		expect(seasonForInstant(new Date('2026-12-23T16:00:00Z'))?.id).toBe('christmas')
		// 2026-12-26 15:59Z is still the 26th in HKT; 16:00Z is the 27th
		expect(seasonForInstant(new Date('2026-12-26T15:59:59Z'))?.id).toBe('christmas')
		expect(seasonForInstant(new Date('2026-12-26T16:00:00Z'))).toBeNull()
	})

	test('year boundary in Hong Kong time', () => {
		expect(seasonForInstant(new Date('2026-12-30T16:00:00Z'))?.id).toBe('newYear')
		expect(seasonForInstant(new Date('2027-01-01T15:59:59Z'))?.id).toBe('newYear')
		expect(seasonForInstant(new Date('2027-01-01T16:00:00Z'))).toBeNull()
	})
})

describe('the list itself', () => {
	test('ranges are real, ordered and never overlap between seasons', () => {
		const all = SEASONS.flatMap((s) => s.ranges.map((r) => ({ id: s.id, ...r })))
		for (const r of all) {
			expect(r.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
			expect(r.from <= r.to).toBe(true)
		}
		all.sort((a, b) => (a.from < b.from ? -1 : 1))
		for (let i = 1; i < all.length; i += 1) {
			const prev = all[i - 1]
			const cur = all[i]
			expect((prev?.to ?? '') < (cur?.from ?? '')).toBe(true)
		}
		expect(new Set(SEASONS.map((s) => s.id)).size).toBe(SEASONS.length)
	})

	test('every season has a greeting in every shipped locale', () => {
		for (const locale of ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN'] as const) {
			const home = resolveLocale(locale).home as { seasons?: Record<string, string> }
			for (const season of SEASONS) {
				expect(
					`${locale}.${season.id}:${home.seasons?.[season.id]?.trim() ? 'ok' : 'missing'}`,
				).toBe(`${locale}.${season.id}:ok`)
			}
		}
	})

	test('seasonGreeting reads the home catalogue only on a themed day', () => {
		const t = (key: string) => `[${key}]`
		expect(seasonGreeting(t, '2026-12-25')).toBe('[seasons.christmas]')
		expect(seasonGreeting(t, '2026-09-21')).toBeNull()
	})
})

describe('share caption and card', () => {
	const base = {
		origin: 'https://puzzled.gg',
		gameSlug: 'word-guess',
		gameName: 'Five',
		status: 'won' as const,
		attempts: 3,
	}

	test('the caption has the greeting only when one is passed, and never an answer', () => {
		const themed = formatRitualShareText({
			...base,
			puzzleDate: '2026-12-25',
			greeting: 'Merry Christmas',
		})
		const plain = formatRitualShareText({ ...base, puzzleDate: '2026-09-21' })
		expect(themed.startsWith('Merry Christmas\n')).toBe(true)
		expect(plain).not.toContain('Merry')
		expect(shareTextLooksNonSpoiler(themed)).toBe(true)
		const contaminated = formatRitualShareText({
			...base,
			greeting: 'Merry Christmas',
			solution: 'CROWN',
		} as never)
		expect(contaminated).not.toContain('CROWN')
	})

	test('the model and its text alternative are themed only on a seasonal day', () => {
		const strings = {
			statusWon: 'Solved!',
			statusLost: 'Not this time',
			attemptsLabel: 'Attempts',
			scoreLabel: 'Score',
			streakLabel: 'Streak',
			timeLabel: 'Time',
			mistakesLabel: 'Mistakes',
			timeUnder1m: 'a',
			timeUnder5m: 'b',
			timeOver5m: 'c',
			attemptsOf: '{attempts} of {max}',
			attemptsCount: '{attempts} attempts',
			scorePoints: '{score} points',
			streakDays: '{days}-day streak',
			patternSummary: 'p',
			altOnDay: ' on {day}',
			altTemplate: 'Puzzled - {game}{day}. {result}',
			altDetailsTemplate: ' {details}.',
			altLinkTemplate: ' Play: {link}',
			detailSeparator: ', ',
			seasonGreeting: 'Happy Halloween',
		}
		const input = { ...base, theme: 'slate' as const, mode: 'daily' as const }
		const themed = buildResultCard({ ...input, puzzleDate: '2026-10-31' })
		const plain = buildResultCard({ ...input, puzzleDate: '2026-10-30' })
		expect(themed.season?.id).toBe('halloween')
		expect(plain.season).toBeNull()
		expect(resultCardTextAlternative(themed, strings)).toContain('Happy Halloween')
		// A greeting handed to a non-seasonal card is ignored: the model decides.
		expect(resultCardTextAlternative(plain, strings)).not.toContain('Happy Halloween')
		expect(JSON.stringify(themed)).not.toMatch(/solution|answer/i)
	})
})
