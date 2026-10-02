import { describe, expect, test } from 'bun:test'
import { locales } from '@/lib/i18n/config'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'
import {
	dueMilestone,
	idsToRecord,
	MILESTONE_IDS,
	offerAccess,
	plusOfferFor,
	plusOfferOpen,
	seenMilestones,
	showResultPlusCard,
} from './plus-offer'

const offer = { gameCount: 19, freeSlug: 'sudoku' }

describe('when a Plus prompt may show at all', () => {
	test('only while sales are open and the viewer is not entitled', () => {
		expect(plusOfferOpen({ salesOpen: true, entitled: false })).toBe(true)
		expect(plusOfferOpen({ salesOpen: false, entitled: false })).toBe(false)
		expect(plusOfferOpen({ salesOpen: true, entitled: true })).toBe(false)
		expect(plusOfferOpen({ salesOpen: false, entitled: true })).toBe(false)
	})
	test('a paying member or a closed store gets no offer', () => {
		expect(plusOfferFor({ salesOpen: true, entitled: false }, offer)).toEqual(offer)
		expect(plusOfferFor({ salesOpen: true, entitled: true }, offer)).toBeNull()
		expect(plusOfferFor({ salesOpen: false, entitled: false }, offer)).toBeNull()
	})
})

describe('the result-screen card', () => {
	test('shows after a daily finish of the free game only', () => {
		expect(showResultPlusCard(offer, { mode: 'daily', gameSlug: 'sudoku' })).toBe(true)
		expect(showResultPlusCard(offer, { mode: 'archive', gameSlug: 'sudoku' })).toBe(false)
		expect(showResultPlusCard(offer, { mode: 'daily', gameSlug: 'wordle' })).toBe(false)
	})
	test('shows nothing without an offer', () => {
		expect(showResultPlusCard(null, { mode: 'daily', gameSlug: 'sudoku' })).toBe(false)
	})
})

describe('day-3 and day-7 milestones', () => {
	test('nothing before day 3', () => {
		expect(dueMilestone(0, [])).toBeNull()
		expect(dueMilestone(2, [])).toBeNull()
	})
	test('day 3 and day 7 each show once', () => {
		expect(dueMilestone(3, [])).toBe(3)
		expect(dueMilestone(5, [3])).toBeNull()
		expect(dueMilestone(7, [3])).toBe(7)
		expect(dueMilestone(30, [3, 7])).toBeNull()
	})
	test('jumping past day 3 shows one prompt, and recording it retires both', () => {
		expect(dueMilestone(8, [])).toBe(7)
		expect(idsToRecord(7)).toEqual([MILESTONE_IDS[3], MILESTONE_IDS[7]])
		expect(idsToRecord(3)).toEqual([MILESTONE_IDS[3]])
	})
	test('seen state is read from the dismissed-notices cookie, with no account id', () => {
		expect(seenMilestones(undefined)).toEqual([])
		expect(seenMilestones('garbage.not-a-uuid')).toEqual([])
		expect(seenMilestones(idsToRecord(3).join('.'))).toEqual([3])
		expect(dueMilestone(8, seenMilestones(idsToRecord(7).join('.')))).toBeNull()
		expect(dueMilestone(8, seenMilestones(idsToRecord(3).join('.')))).toBe(7)
	})
})

describe('offers fail closed when Money cannot confirm', () => {
	const open = { salesOpen: true, entitled: false }
	test('a failed signed-in subscription read gives no offer', () => {
		const access = offerAccess(true, 'failed', true)
		expect(access).toEqual({ salesOpen: false, entitled: false })
		expect(plusOfferOpen(access)).toBe(false)
	})
	test('a failed plans read gives a guest no offer', () => {
		expect(plusOfferOpen(offerAccess(false, 'failed', 'failed'))).toBe(false)
	})
	test('confirmed reads decide as before', () => {
		expect(plusOfferOpen(offerAccess(true, open, 'failed'))).toBe(true)
		expect(plusOfferOpen(offerAccess(true, { salesOpen: true, entitled: true }, true))).toBe(false)
		expect(plusOfferOpen(offerAccess(false, 'failed', true))).toBe(true)
		expect(plusOfferOpen(offerAccess(false, 'failed', false))).toBe(false)
	})
})

describe('copy ships in every locale', () => {
	test('each locale resolves every offer string', () => {
		const keys = ['resultTitle', 'resultBody', 'day3Title', 'day7Title', 'milestoneBody']
		for (const locale of locales) {
			const plus = resolveLocale(locale).plus as { offer: Record<string, string> }
			for (const key of keys) {
				expect(plus.offer[key]?.length, `${locale} plus.offer.${key}`).toBeGreaterThan(0)
			}
			expect(plus.offer.resultTitle).toContain('{count}')
			expect(plus.offer.milestoneBody).toContain('{count}')
		}
	})
	test('no locale carries urgency or a refund claim, and the titles take the real day count', () => {
		const banned =
			/refund|money-back|limited time|only today|hurry|退款|退錢|退还|限時|限时|立即|马上|馬上/i
		for (const locale of locales) {
			const plus = resolveLocale(locale).plus as { offer: Record<string, string> }
			expect(JSON.stringify(plus.offer), locale).not.toMatch(banned)
			expect(plus.offer.day3Title, locale).toContain('{days}')
			expect(plus.offer.day7Title, locale).toContain('{days}')
		}
	})
})
