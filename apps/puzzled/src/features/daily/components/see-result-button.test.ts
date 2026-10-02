import { describe, expect, test } from 'bun:test'
import { shouldOfferResult } from './see-result-button'

describe('result reopen offer', () => {
	test('offered only after a finish whose modal was closed', () => {
		expect(shouldOfferResult(false, false)).toBe(false)
		expect(shouldOfferResult(true, true)).toBe(false)
		expect(shouldOfferResult(true, false)).toBe(true)
	})
	test('close then reopen cycles the offer', () => {
		let open = true
		expect(shouldOfferResult(true, open)).toBe(false)
		open = false // modal closed
		expect(shouldOfferResult(true, open)).toBe(true)
		open = true // button pressed
		expect(shouldOfferResult(true, open)).toBe(false)
	})
})
