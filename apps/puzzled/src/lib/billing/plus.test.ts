import { describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import {
	GetSubscriptionResponseSchema,
	ListPlansResponseSchema,
} from '@/gen/connect/puzzled/v1/billing_pb'
import {
	currencyForLocale,
	formatPrice,
	formatTrialEnd,
	isPlayLocked,
	isPlusRequiredError,
	planCards,
	showsCurrentPlan,
	subscriptionView,
	trialBannerEndMs,
	trialEndDate,
	yearlySavingPercent,
} from './plus'

describe('Puzzled Plus presentation', () => {
	test('nothing is locked while sales are closed or for a subscriber', () => {
		const game = { slug: 'sudoku', freeSlug: 'crowns', archive: true }
		expect(isPlayLocked({ salesOpen: false, entitled: false }, game)).toBe(false)
		expect(isPlayLocked({ salesOpen: true, entitled: true }, game)).toBe(false)
	})

	test('only the free daily game stays open without Plus', () => {
		const access = { salesOpen: true, entitled: false }
		expect(isPlayLocked(access, { slug: 'crowns', freeSlug: 'crowns', archive: false })).toBe(false)
		expect(isPlayLocked(access, { slug: 'sudoku', freeSlug: 'crowns', archive: false })).toBe(true)
		expect(isPlayLocked(access, { slug: 'crowns', freeSlug: 'crowns', archive: true })).toBe(true)
	})

	test('Connect refusal codes are recognised', () => {
		expect(isPlusRequiredError('[permission_denied] plus_required')).toBe(true)
		expect(isPlusRequiredError('plus_required_archive')).toBe(true)
		expect(isPlusRequiredError('future_puzzle_date')).toBe(false)
	})

	test('cards use the locale currency and fall back to dollars', () => {
		const plans = create(ListPlansResponseSchema, {
			plans: [
				{
					id: 'individual_monthly',
					interval: 'month',
					prices: [
						{ currency: 'usd', unitAmountMinor: BigInt(499) },
						{ currency: 'gbp', unitAmountMinor: BigInt(399) },
					],
				},
				{
					id: 'family_yearly',
					family: true,
					interval: 'year',
					prices: [{ currency: 'usd', unitAmountMinor: BigInt(6499) }],
				},
			],
		}).plans
		expect(currencyForLocale('en-GB')).toBe('gbp')
		expect(currencyForLocale('zh-HK')).toBe('usd')
		const cards = planCards(plans, 'gbp')
		expect(cards[0]).toEqual({
			id: 'individual_monthly',
			family: false,
			interval: 'month',
			currency: 'gbp',
			amountMinor: 399,
			trialDays: 0,
		})
		expect(cards[1].currency).toBe('usd')
		expect(formatPrice(399, 'gbp', 'en-GB')).toBe('£3.99')
		expect(yearlySavingPercent(499, 3999)).toBe(33)
		expect(yearlySavingPercent(499, 6000)).toBe(null)
	})

	test('a reverse-trial viewer still sees the buy button; a subscriber sees the current plan', () => {
		expect(
			showsCurrentPlan({ salesOpen: true, entitled: true, trialEndsMs: 1_790_000_000_000 }),
		).toBe(false)
		expect(showsCurrentPlan({ salesOpen: true, entitled: true, trialEndsMs: null })).toBe(true)
		expect(showsCurrentPlan({ salesOpen: true, entitled: false })).toBe(false)
		expect(showsCurrentPlan(null)).toBe(false)
	})

	test('a trial plan carries its days and a real end date', () => {
		const plans = create(ListPlansResponseSchema, {
			plans: [
				{
					id: 'individual_yearly',
					interval: 'year',
					trialDays: 7,
					prices: [{ currency: 'usd', unitAmountMinor: BigInt(3999) }],
				},
			],
		}).plans
		expect(planCards(plans, 'usd')[0].trialDays).toBe(7)
		const now = new Date('2026-10-01T23:30:00Z')
		expect(trialEndDate(now, 7, 'en-US', 'UTC')).toBe('October 8, 2026')
		// A US evening viewer sees their own day, not the server's.
		expect(trialEndDate(new Date('2026-10-01T02:00:00Z'), 7, 'en-US', 'America/Los_Angeles')).toBe(
			'October 7, 2026',
		)
		expect(trialEndDate(now, 0, 'en-US')).toBe(null)
	})

	test('the reverse trial reads as its own source with a real end', () => {
		const view = subscriptionView(
			create(GetSubscriptionResponseSchema, {
				salesOpen: true,
				entitled: true,
				source: 'trial',
				trialEndsMs: BigInt(1_790_000_000_000),
			}),
		)
		expect(view).toMatchObject({ entitled: true, source: 'trial', trialEndsMs: 1_790_000_000_000 })
		const none = subscriptionView(create(GetSubscriptionResponseSchema, { source: 'none' }))
		expect(none.trialEndsMs).toBe(null)
	})

	test('subscription view reads optional fields as null', () => {
		const view = subscriptionView(
			create(GetSubscriptionResponseSchema, { salesOpen: true, source: 'none' }),
		)
		expect(view).toMatchObject({ entitled: false, source: 'none', planId: null, family: null })
		const owner = subscriptionView(
			create(GetSubscriptionResponseSchema, {
				salesOpen: true,
				entitled: true,
				source: 'plus',
				planId: 'family_monthly',
				currentPeriodEndMs: BigInt(1000),
				family: { role: 'owner', inviteCode: 'ABCDEFGHJK', maxMembers: 4, members: [] },
			}),
		)
		expect(owner.periodEndMs).toBe(1000)
		expect(owner.family?.inviteCode).toBe('ABCDEFGHJK')
	})
})

describe('trial ending banner', () => {
	const DAY = 86_400_000
	const now = Date.UTC(2026, 9, 3, 12, 0, 0)
	const trial = (over: Partial<Parameters<typeof trialBannerEndMs>[0]> = {}) => ({
		status: 'trialing',
		cancelAtPeriodEnd: false,
		periodEndMs: now + 2 * DAY,
		...over,
	})

	test('shows in the last three days, boundary included', () => {
		expect(trialBannerEndMs(trial({ periodEndMs: now + 3 * DAY }), now)).toBe(now + 3 * DAY)
		expect(trialBannerEndMs(trial({ periodEndMs: now + 1 }), now)).toBe(now + 1)
	})

	test('stays hidden just over three days out and after the end', () => {
		expect(trialBannerEndMs(trial({ periodEndMs: now + 3 * DAY + 1 }), now)).toBeNull()
		expect(trialBannerEndMs(trial({ periodEndMs: now }), now)).toBeNull()
		expect(trialBannerEndMs(trial({ periodEndMs: now - DAY }), now)).toBeNull()
		expect(trialBannerEndMs(trial({ periodEndMs: null }), now)).toBeNull()
	})

	test('stays hidden when not trialing or already cancelled', () => {
		expect(trialBannerEndMs(trial({ status: 'active' }), now)).toBeNull()
		expect(trialBannerEndMs(trial({ status: null }), now)).toBeNull()
		expect(trialBannerEndMs(trial({ cancelAtPeriodEnd: true }), now)).toBeNull()
	})

	test('the date is written in the viewer locale and time zone', () => {
		const end = Date.UTC(2026, 9, 5, 23, 30, 0)
		expect(formatTrialEnd(end, 'en-US', 'UTC')).toBe('October 5, 2026')
		expect(formatTrialEnd(end, 'en-GB', 'UTC')).toBe('5 October 2026')
		// 23:30 UTC is already the next day in Hong Kong.
		expect(formatTrialEnd(end, 'en-US', 'Asia/Hong_Kong')).toBe('October 6, 2026')
		expect(formatTrialEnd(end, 'zh-HK', 'Asia/Hong_Kong')).toBe('2026年10月6日')
	})
})
