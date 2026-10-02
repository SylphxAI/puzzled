import { describe, expect, test } from 'bun:test'
import { locales } from '@/lib/i18n/config'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'
import {
	dueMilestone,
	markSeen,
	parseSeen,
	plusOfferFor,
	plusOfferOpen,
	seenStorageKey,
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
	test('jumping past day 3 shows one prompt, and dismissing retires both', () => {
		expect(dueMilestone(8, [])).toBe(7)
		expect(markSeen([], 7)).toEqual([3, 7])
		expect(dueMilestone(8, markSeen([], 7))).toBeNull()
		expect(markSeen([3], 3)).toEqual([3])
	})
	test('stored state is parsed defensively and keyed per account', () => {
		expect(parseSeen(null)).toEqual([])
		expect(parseSeen('not json')).toEqual([])
		expect(parseSeen('{"a":1}')).toEqual([])
		expect(parseSeen('[3,"x",7.5,7]')).toEqual([3, 7])
		expect(seenStorageKey('u1')).not.toBe(seenStorageKey('u2'))
		expect(seenStorageKey(null)).toBe('puzzled:plus-prompt:v1:browser')
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
	test('the offer promises nothing but what Plus sells, with no urgency or refund claim', () => {
		const offerCopy = JSON.stringify(
			resolveLocale('en-US').plus && (resolveLocale('en-US').plus as { offer: unknown }).offer,
		)
		expect(offerCopy).not.toMatch(/refund|money-back|limited time|only today|hurry/i)
	})
})
