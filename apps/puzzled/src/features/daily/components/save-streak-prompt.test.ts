import { describe, expect, test } from 'bun:test'
import { shouldOfferStreakSave, shouldShowStreakCard, signupHref } from './save-streak-prompt'

describe('save your streak after a finish', () => {
	test('a guest with two days qualifies, but one day or archive play does not', () => {
		expect(shouldOfferStreakSave(false, true, 2)).toBe(true)
		expect(shouldOfferStreakSave(false, true, 10)).toBe(true)
		expect(shouldOfferStreakSave(false, true, 1)).toBe(false)
		expect(shouldOfferStreakSave(false, false, 10)).toBe(false)
		expect(shouldOfferStreakSave(true, true, 10)).toBe(false)
	})
})

describe('the first-finish card', () => {
	test('a guest with a streak of one already sees the card; the modal waits for two', () => {
		expect(shouldShowStreakCard(false, true, 1)).toBe(true)
		expect(shouldShowStreakCard(false, true, 0)).toBe(false)
		expect(shouldShowStreakCard(false, false, 3)).toBe(false)
		expect(shouldShowStreakCard(true, true, 3)).toBe(false)
		expect(shouldOfferStreakSave(false, true, 1)).toBe(false)
	})
	test('sign-up returns the player to the game they finished', () => {
		expect(signupHref('sudoku')).toEqual({
			pathname: '/signup',
			query: { callbackUrl: '/games/sudoku' },
		})
		expect(signupHref()).toEqual({ pathname: '/signup' })
	})
})

describe('first-finish and sign-up copy', () => {
	test('the guest ask and the sign-up card carry their reassurance lines in en-US', async () => {
		const onboarding = (await import('@/messages/en-US/onboarding.json')).default
		const auth = (await import('@/messages/en-US/auth.json')).default
		const home = (await import('@/messages/en-US/home.json')).default
		expect(onboarding.saveStreakNote.length).toBeGreaterThan(0)
		expect(auth.signupBenefitSaved.length).toBeGreaterThan(0)
		expect(home.day.guestNote.length).toBeGreaterThan(0)
	})
})
