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
