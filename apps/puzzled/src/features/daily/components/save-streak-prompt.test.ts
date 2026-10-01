import { describe, expect, test } from 'bun:test'
import { shouldOfferStreakSave } from './save-streak-prompt'

describe('save your streak after a finish', () => {
	test('a guest with two days qualifies, but one day or archive play does not', () => {
		expect(shouldOfferStreakSave(false, true, 2)).toBe(true)
		expect(shouldOfferStreakSave(false, true, 10)).toBe(true)
		expect(shouldOfferStreakSave(false, true, 1)).toBe(false)
		expect(shouldOfferStreakSave(false, false, 10)).toBe(false)
		expect(shouldOfferStreakSave(true, true, 10)).toBe(false)
	})
})
