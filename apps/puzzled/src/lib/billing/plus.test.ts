import { describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import { GetSubscriptionResponseSchema } from '@/gen/connect/puzzled/v1/billing_pb'
import { planById } from './catalogue'
import { isPlayLocked, isPlusRequiredError, subscriptionView, yearlySavingPercent } from './plus'

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

	test('the yearly saving is a whole percent of twelve monthly payments', () => {
		const saving = (id: string, currency: string) => {
			const monthly = planById(id.replace('_yearly', '_monthly'))!
			const yearly = planById(id)!
			return yearlySavingPercent(monthly.unit_amounts[currency], yearly.unit_amounts[currency])
		}
		expect(saving('individual_yearly', 'usd')).toBe(33)
		expect(saving('individual_yearly', 'gbp')).toBe(31)
		expect(saving('family_yearly', 'usd')).toBe(32)
		expect(saving('family_yearly', 'gbp')).toBe(32)
		// A yearly price that does not save anything shows no badge.
		const monthly = planById('individual_monthly')!
		expect(yearlySavingPercent(monthly.unit_amounts.usd, monthly.unit_amounts.usd * 20)).toBe(null)
		expect(yearlySavingPercent(0, monthly.unit_amounts.usd)).toBe(null)
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
