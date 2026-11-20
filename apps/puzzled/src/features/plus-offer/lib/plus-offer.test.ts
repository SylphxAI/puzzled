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
	resolvePricingCheckoutTrigger,
	seenMilestones,
	selectOfferPrices,
	showResultPlusCard,
} from './plus-offer'

const offer = { gameCount: 19, dayKey: '2026-10-29' }
const today = { puzzleDate: '2026-10-29' }

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
	test('shows after any free daily finish, never an archive run', () => {
		expect(showResultPlusCard(offer, { ...today, mode: 'daily', gameSlug: 'sudoku' })).toBe(true)
		expect(showResultPlusCard(offer, { ...today, mode: 'daily', gameSlug: 'nonogram' })).toBe(true)
		expect(showResultPlusCard(offer, { ...today, mode: 'archive', gameSlug: 'sudoku' })).toBe(false)
	})
	test('never promotes an earlier, future or unknown result day', () => {
		for (const puzzleDate of ['2026-10-28', '2026-10-30', undefined]) {
			expect(
				showResultPlusCard(offer, { ...today, mode: 'daily', gameSlug: 'sudoku', puzzleDate }),
			).toBe(false)
		}
	})
	test('shows nothing without an offer', () => {
		expect(showResultPlusCard(null, { ...today, mode: 'daily', gameSlug: 'sudoku' })).toBe(false)
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
	test('each locale resolves every offer string including 3-day pass and 3/3 picks-used prompt', () => {
		const keys = [
			'resultTitle',
			'resultBody',
			'resultPrice',
			'resultPriceWithPass',
			'resultPassPrice',
			'resultPicksUsedBadge',
			'resultPicksUsedTitle',
			'resultPicksUsedBody',
			'day3Title',
			'day7Title',
			'milestoneBody',
		]
		for (const locale of locales) {
			const plus = resolveLocale(locale).plus as { offer: Record<string, string> }
			for (const key of keys) {
				expect(plus.offer[key]?.length, `${locale} plus.offer.${key}`).toBeGreaterThan(0)
			}
			expect(plus.offer.resultTitle).toContain('{count}')
			expect(plus.offer.resultPriceWithPass).toContain('{passPrice}')
			expect(plus.offer.resultPriceWithPass).toContain('{price}')
			expect(plus.offer.resultPicksUsedBadge).toContain('{used}')
			expect(plus.offer.resultPicksUsedBadge).toContain('{total}')
			expect(plus.offer.resultPicksUsedTitle).toContain('{total}')
			expect(plus.offer.resultPicksUsedBody).toContain('{count}')
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
	test('no locale leaks stale "1 free puzzle", "midnight UTC", or Cantonese in zh-TW', () => {
		const staleSingular =
			/\b(1|one) free puzzle\b|\btoday's free puzzle\b|\btoday's featured puzzle\b|midnight utc/i
		const cantoneseInTw = /[唔嘅啲喺咁咗嘢係佢冇揀]|聽日|玩齊|剔選|現時|續期|往日題庫|往日題目/
		for (const locale of locales) {
			const resolved = resolveLocale(locale)
			expect(JSON.stringify(resolved), locale).not.toMatch(staleSingular)
			const onboarding = resolved.onboarding as { dailyPuzzleDesc: string }
			expect(onboarding.dailyPuzzleDesc, `${locale} onboarding.dailyPuzzleDesc`).toMatch(/UTC\+8/)
		}
		const zhTw = resolveLocale('zh-TW')
		expect(JSON.stringify(zhTw.plus), 'zh-TW plus').not.toMatch(cantoneseInTw)
		expect(JSON.stringify(zhTw.catalog), 'zh-TW catalog').not.toMatch(/[唔嘅啲喺咁咗嘢係佢冇揀]/)
		expect(JSON.stringify(zhTw.stats), 'zh-TW stats').not.toMatch(/[唔嘅啲喺咁咗嘢係佢冇揀]/)
	})
})

describe('offer price selection and paywall trigger attribution', () => {
	test('selectOfferPrices formats both 3-Day Pass and Yearly Plus in one currency', () => {
		const cards = [
			{
				id: 'individual_once' as const,
				family: false,
				interval: 'once' as const,
				amountMinor: 299,
				currency: 'usd',
				trialDays: 0,
				accessDays: 3,
			},
			{
				id: 'individual_yearly' as const,
				family: false,
				interval: 'year' as const,
				amountMinor: 3999,
				currency: 'usd',
				trialDays: 0,
				accessDays: 0,
			},
		]
		expect(selectOfferPrices(cards, 'usd', 'en-US')).toEqual({
			yearlyPrice: '$39.99',
			passPrice: '$2.99',
			passDays: 3,
		})
	})

	test('resolvePricingCheckoutTrigger attributes known paywall entries distinctly and ignores ad mediums', () => {
		expect(
			resolvePricingCheckoutTrigger({
				trigger: 'game_unlock',
				fallback: 'pricing_card',
			}),
		).toBe('game_unlock')
		expect(
			resolvePricingCheckoutTrigger({
				utmMedium: 'result_card',
				fallback: 'pricing_card',
			}),
		).toBe('result_card')
		expect(
			resolvePricingCheckoutTrigger({
				entrySurface: 'stats_banner',
				fallback: 'pricing_card',
			}),
		).toBe('stats_banner')
		expect(
			resolvePricingCheckoutTrigger({
				utmMedium: 'cpc',
				fallback: 'pricing_card',
			}),
		).toBe('pricing_card')
		expect(
			resolvePricingCheckoutTrigger({
				utmMedium: 'cpc',
				fallback: 'pricing_family_card',
			}),
		).toBe('pricing_family_card')
	})
})
