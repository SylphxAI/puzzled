import { describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import {
	GetSubscriptionResponseSchema,
	ListPlansResponseSchema,
} from '@/gen/connect/puzzled/v1/billing_pb'
import {
	currencyForLocale,
	formatPrice,
	isPlayLocked,
	isPlusRequiredError,
	planCards,
	subscriptionView,
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
		})
		expect(cards[1].currency).toBe('usd')
		expect(formatPrice(399, 'gbp', 'en-GB')).toBe('£3.99')
		expect(yearlySavingPercent(499, 3999)).toBe(33)
		expect(yearlySavingPercent(499, 6000)).toBe(null)
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
